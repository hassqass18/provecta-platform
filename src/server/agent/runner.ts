import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import { ensureAutonomyPolicy, canAutoExecute } from "../../lib/autonomy";
import { askBrain } from "../../lib/brain";
import { converseFromTicket } from "./converse";

// Agent runner: turns a queued DomainEvent into a three-step AgentRun
// (PLANNER → EXECUTOR/critic gate → CRITIC). The autonomy policy for the
// resolved action category decides whether the executor fires automatically or
// the run lands in the approvals queue (AWAITING_REVIEW).

type RiskClass = "REVERSIBLE" | "IRREVERSIBLE" | "REGULATED";

interface ActionResolution {
  actionCategory: string;
  riskClass: RiskClass;
}

const EVENT_ACTION_MAP: Record<string, ActionResolution> = {
  MILESTONE_COMPLETED: { actionCategory: "milestone-notification", riskClass: "REVERSIBLE" },
  DOCUMENT_INGESTED: { actionCategory: "document-filing", riskClass: "REVERSIBLE" },
  INBOUND_TICKET: { actionCategory: "ticket-reply", riskClass: "REVERSIBLE" },
  INVOICE_OVERDUE: { actionCategory: "invoice-reminder", riskClass: "REVERSIBLE" },
  PROPOSAL_ACCEPTED: { actionCategory: "engagement-planning", riskClass: "REVERSIBLE" },
  PHASE_READY: { actionCategory: "deliverable-drafting", riskClass: "REVERSIBLE" },
};

const DEFAULT_ACTION: ActionResolution = {
  actionCategory: "generic",
  riskClass: "REVERSIBLE",
};

function resolveAction(type: string): ActionResolution {
  return EVENT_ACTION_MAP[type] ?? DEFAULT_ACTION;
}

function asInputJson(payload: unknown): Prisma.InputJsonValue {
  if (payload === undefined || payload === null) return {};
  return payload as Prisma.InputJsonValue;
}

export interface ProcessEventInput {
  id: string;
  type: string;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
}

export interface ProcessEventResult {
  runId: string;
  status: string;
}

export async function processEvent(event: ProcessEventInput): Promise<ProcessEventResult> {
  // Inbound client messages are handled by the bRRAIn conversation agent
  // (reason → tools → guardrail → send/approve-first), not the generic loop.
  if (event.type === "INBOUND_TICKET" && event.entityId) {
    try {
      const r = await converseFromTicket(event.entityId);
      return { runId: "inbound", status: r.status };
    } catch (err) {
      await prisma.auditLog.create({
        data: { action: "AGENT_CONVERSE_ERROR", entity: "Ticket", entityId: event.entityId, meta: String(err).slice(0, 200) },
      });
      return { runId: "inbound", status: "FAILED" };
    }
  }

  const { actionCategory, riskClass } = resolveAction(event.type);
  const policy = await ensureAutonomyPolicy(actionCategory, riskClass);

  // Create the run up front so any later failure can be attributed to it.
  const run = await prisma.agentRun.create({
    data: {
      trigger: event.type,
      actionCategory,
      riskClass,
      autonomyState: policy.state,
      status: "PROPOSED",
      inputJson: asInputJson(event.payload),
    },
  });

  try {
    // ── PLANNER ───────────────────────────────────────────────────────
    // A brain failure must never abort the pipeline: degrade to a stub plan
    // and, below, force propose-only (no auto-execute on a degraded plan).
    let plan: string;
    let brainOk = true;
    try {
      plan = await askBrain(
        `Plan a ${actionCategory} response for ${event.type} (${event.entity} ${event.entityId ?? ""}).`
      );
    } catch {
      brainOk = false;
      plan = `[stub plan] Unable to reach brain; propose-only ${actionCategory} for ${event.type}.`;
    }

    await prisma.agentStep.create({
      data: {
        runId: run.id,
        idx: 0,
        role: "PLANNER",
        outputJson: { plan } satisfies Prisma.InputJsonValue,
      },
    });

    // ── Decision gate ─────────────────────────────────────────────────
    const auto = brainOk && canAutoExecute(policy.state, riskClass);

    let status: string;
    if (auto) {
      // EXECUTOR records intent only — concrete comms/notifications are wired
      // by the caller. The audit row marks the autonomous action.
      const audit = await prisma.auditLog.create({
        data: {
          action: "AGENT_AUTO_EXECUTE",
          entity: event.entity,
          entityId: event.entityId ?? null,
          meta: JSON.stringify({ runId: run.id, actionCategory, eventType: event.type }),
        },
      });

      await prisma.agentStep.create({
        data: {
          runId: run.id,
          idx: 1,
          role: "EXECUTOR",
          outputJson: { executed: true } satisfies Prisma.InputJsonValue,
        },
      });

      status = "AUTO_EXECUTED";
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status, auditLogId: audit.id },
      });
    } else {
      status = "AWAITING_REVIEW";
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status },
      });
    }

    // ── CRITIC ────────────────────────────────────────────────────────
    const score = auto ? 90 : 50;
    await prisma.agentStep.create({
      data: {
        runId: run.id,
        idx: 2,
        role: "CRITIC",
        outputJson: { score } satisfies Prisma.InputJsonValue,
      },
    });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { criticScore: score },
    });

    return { runId: run.id, status };
  } catch (err) {
    // Hard failure: never throw out of processEvent. Mark the run FAILED so the
    // queue can move on and the failure is visible in the run history.
    const message = err instanceof Error ? err.message : String(err);
    try {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          outputJson: { error: message } satisfies Prisma.InputJsonValue,
        },
      });
    } catch {
      // Swallow — best-effort status write; original failure already captured.
    }
    return { runId: run.id, status: "FAILED" };
  }
}
