import { prisma } from "./db";
import { chat, extractText, extractToolUses, llmConfigured } from "./llm/anthropic";
import { consultBrain } from "./agent/consult-brain";

// bRRAIn intelligence layer. Generation runs on the real Claude engine
// (lib/llm/anthropic) grounded with bRRAIn retrieval (consultBrain). When no
// ANTHROPIC_API_KEY is present it degrades to a deterministic stub so the build
// still runs keyless. `brainProvider` tracks the (future) official bRRAIn API.

export type BrainProvider = "STUB" | "AMB" | "BRRAIN";

export function brainProvider(): BrainProvider {
  if (process.env.BRRAIN_API_KEY && process.env.BRRAIN_API_URL) return "BRRAIN";
  if (process.env.BRRAIN_API_KEY) return "AMB";
  return "STUB";
}

export function brainConfigured(): boolean {
  return brainProvider() !== "STUB";
}

const PROVECTA_VOICE =
  "You are bRRAIn, the operating intelligence of Provecta Group — the first business-operations firm built on bRRAIn. " +
  "Voice: precise, senior-consultant, plain and confident; no fluff, no hype, no emojis. " +
  "Never invent facts, figures, names, or commitments; if something isn't grounded, say what you'd need. " +
  "Provecta Group is a Genius Co company.";

// Pull a few relevant bRRAIn snippets and render them as a grounding block.
async function grounding(query: string): Promise<string> {
  try {
    const snips = await consultBrain(query, { max: 4 });
    if (!snips.length) return "";
    return (
      "\n\nGrounding from the Provecta knowledge base (bRRAIn) — use only what's relevant:\n" +
      snips.map((s) => `--- ${s.path} ---\n${s.text}`).join("\n\n")
    );
  } catch {
    return "";
  }
}

export async function askBrain(prompt: string, opts?: { engagementId?: string }): Promise<string> {
  const provider = brainProvider();
  let response: string;

  if (llmConfigured()) {
    try {
      const ground = await grounding(prompt);
      const res = await chat({
        system: PROVECTA_VOICE + ground,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 900,
        temperature: 0.4,
      });
      response = extractText(res.content) || stubAnswer(prompt);
    } catch {
      response = stubAnswer(prompt);
    }
  } else {
    response = stubAnswer(prompt);
  }

  await prisma.brainQuery.create({
    data: { prompt, response, provider, engagementId: opts?.engagementId },
  }).catch(() => {});
  return response;
}

function stubAnswer(prompt: string): string {
  return `Grounded answer (local bRRAIn): ${prompt.slice(0, 140)}…`;
}

// Draft a support / client reply — real, grounded, honest.
export async function draftReply(
  subject: string,
  lastMessage: string,
  opts?: { engagementId?: string }
): Promise<string> {
  const provider = brainProvider();
  let response: string;

  if (llmConfigured()) {
    try {
      const ground = await grounding(`${subject} ${lastMessage}`);
      const res = await chat({
        system:
          PROVECTA_VOICE +
          " Write a concise, helpful reply to the client. Be specific and honest; do not over-promise dates, money, or outcomes. " +
          "If you cannot resolve it, say a Provecta specialist is on it and give the realistic next step." +
          ground,
        messages: [
          { role: "user", content: `Ticket subject: ${subject}\nClient's latest message: ${lastMessage || "(none)"}\n\nWrite the reply.` },
        ],
        maxTokens: 500,
        temperature: 0.4,
      });
      response = extractText(res.content) || stubReply(subject, lastMessage);
    } catch {
      response = stubReply(subject, lastMessage);
    }
  } else {
    response = stubReply(subject, lastMessage);
  }

  await prisma.brainQuery.create({
    data: { prompt: `Draft reply: ${subject}`, response, provider, engagementId: opts?.engagementId },
  }).catch(() => {});
  return response;
}

function stubReply(subject: string, lastMessage: string): string {
  const ref = lastMessage ? ` On your note — "${lastMessage.slice(0, 80)}" — ` : " ";
  return `Hi, thanks for reaching out about "${subject}". We've logged this and a Provecta specialist is reviewing it now.${ref}we'll follow up with concrete next steps within one business day. — Provecta Group`;
}

// Proposal-from-transcript: bRRAIn drafts a real, tailored proposal from the
// discovery transcript (grounded in bRRAIn). Falls back to a heuristic draft
// when the engine isn't keyed.
export async function proposalFromTranscript(
  title: string,
  transcript: string,
): Promise<{ bodyMd: string; suggestedBudgetMinor: number }> {
  if (llmConfigured()) {
    try {
      const ground = await grounding(`${title} ${transcript.slice(0, 500)}`);
      const res = await chat({
        system:
          PROVECTA_VOICE +
          " You are drafting a client proposal from a discovery transcript. Produce a complete, tailored proposal in Markdown with these sections: " +
          "Understanding (the client's specific situation + priorities), Recommended approach (phased, concrete to THIS client), Scope & deliverables, " +
          "Success criteria, Timeline (indicative), and Investment. Ground the approach in Provecta's bRRAIn-powered delivery model. " +
          "Do not invent client facts not present in the transcript. " +
          "After the Markdown, output a final line exactly: BUDGET_USD: <integer>  (your best indicative total in USD)." +
          ground,
        messages: [{ role: "user", content: `Proposal title: ${title}\n\nDiscovery transcript / notes:\n${transcript.slice(0, 12000)}` }],
        maxTokens: 2200,
        temperature: 0.5,
      });
      const text = extractText(res.content);
      const m = text.match(/BUDGET_USD:\s*\$?([\d,]+)/i);
      const usd = m ? Number(m[1].replace(/,/g, "")) : 0;
      const bodyMd = text.replace(/\n?BUDGET_USD:.*$/i, "").trim();
      if (bodyMd) {
        const suggestedBudgetMinor = usd > 0 ? usd * 100 : heuristicBudgetMinor(transcript);
        return { bodyMd, suggestedBudgetMinor };
      }
    } catch {
      // fall through to heuristic
    }
  }
  return heuristicProposal(title, transcript);
}

function heuristicBudgetMinor(transcript: string): number {
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  return Math.min(12_000_000, Math.max(1_500_000, wordCount * 1500));
}

function heuristicProposal(title: string, transcript: string): { bodyMd: string; suggestedBudgetMinor: number } {
  const sentences = transcript.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 20);
  const painPoints = sentences.slice(0, 4);
  const suggestedBudgetMinor = heuristicBudgetMinor(transcript);
  const bodyMd = `# Proposal — ${title}

## Understanding
Based on our discovery conversation, we identified the following priorities:
${painPoints.map((p) => `- ${p}`).join("\n") || "- (insufficient detail captured)"}

## Recommended approach
Provecta will deliver this as a phased Business Operations engagement on the bRRAIn-powered platform:

1. **Discovery & audit** — current-state map, KPI baseline, readiness (ADKAR) scorecard.
2. **Design & build** — native build of the operating model on the platform.
3. **Automation & integration** — connect the systems you already use into one source of truth.
4. **Enablement & handover** — training, runbooks, and a measured move to autonomous operations.

## Indicative investment
${(suggestedBudgetMinor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} (refined after scoping).

_Draft generated from the discovery transcript — review before sending._`;
  return { bodyMd, suggestedBudgetMinor };
}

// ── Engagement-plan generation (P3) ───────────────────────────────────────
// bRRAIn turns an engagement's scope (proposal/charter/transcripts) into a
// tailored delivery plan: phases (milestones) with nested deliverables + tasks,
// plus KPIs. Replaces the fixed `onboarding` template with something specific to
// THIS client. Real generation uses Claude tool-use for structured output and is
// grounded in bRRAIn; keyless it returns a sensible heuristic plan.

export type DeliverableKind = "DELIVERABLE" | "AUDIT" | "ARCHITECTURE" | "BUILD" | "REPORT";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface PlannedDeliverable {
  title: string;
  kind: DeliverableKind;
  detail?: string;
}
export interface PlannedTask {
  title: string;
  priority: TaskPriority;
}
export interface PlannedPhase {
  title: string;
  summary?: string;
  dayOffset: number; // days from engagement start for the phase milestone
  clientVisible: boolean;
  deliverables: PlannedDeliverable[];
  tasks: PlannedTask[];
}
export interface PlannedKpi {
  label: string;
  unit?: string;
  target?: number;
}
export interface EngagementPlan {
  phases: PlannedPhase[];
  kpis: PlannedKpi[];
}

export interface EngagementScope {
  name: string;
  summary?: string | null;
  budgetMinor?: number;
  currency?: string;
  charter?: {
    objectives?: string | null;
    scope?: string | null;
    outOfScope?: string | null;
    successCriteria?: string | null;
  } | null;
  proposalMd?: string | null;
  transcript?: string | null;
}

const DELIVERABLE_KINDS: DeliverableKind[] = ["DELIVERABLE", "AUDIT", "ARCHITECTURE", "BUILD", "REPORT"];
const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

const PLAN_TOOL = {
  name: "emit_engagement_plan",
  description:
    "Emit the tailored delivery plan for this engagement: ordered phases (each a milestone) with their deliverables and tasks, plus the KPIs that prove the engagement is working.",
  input_schema: {
    type: "object",
    properties: {
      phases: {
        type: "array",
        description: "3–7 ordered delivery phases, specific to this client's scope.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short phase title, e.g. 'Discovery & current-state audit'." },
            summary: { type: "string", description: "One line: what this phase delivers." },
            dayOffset: { type: "integer", description: "Whole days from engagement start when this phase is due." },
            clientVisible: { type: "boolean", description: "false only for internal-only phases." },
            deliverables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  kind: { type: "string", enum: DELIVERABLE_KINDS },
                  detail: { type: "string", description: "One or two sentences on the deliverable's content." },
                },
                required: ["title", "kind"],
              },
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  priority: { type: "string", enum: TASK_PRIORITIES },
                },
                required: ["title"],
              },
            },
          },
          required: ["title", "dayOffset", "deliverables", "tasks"],
        },
      },
      kpis: {
        type: "array",
        description: "2–5 measurable KPIs tied to the engagement's success criteria.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            unit: { type: "string", description: "%, days, count, $, hours or score." },
            target: { type: "number" },
          },
          required: ["label"],
        },
      },
    },
    required: ["phases", "kpis"],
  } as Record<string, unknown>,
};

function scopeText(s: EngagementScope): string {
  const c = s.charter;
  return [
    `Engagement: ${s.name}`,
    s.summary ? `Summary: ${s.summary}` : "",
    typeof s.budgetMinor === "number" && s.budgetMinor > 0
      ? `Budget: ${(s.budgetMinor / 100).toLocaleString("en-US", { style: "currency", currency: s.currency || "USD" })}`
      : "",
    c?.objectives ? `Objectives: ${c.objectives}` : "",
    c?.scope ? `Scope: ${c.scope}` : "",
    c?.outOfScope ? `Out of scope: ${c.outOfScope}` : "",
    c?.successCriteria ? `Success criteria: ${c.successCriteria}` : "",
    s.proposalMd ? `Proposal:\n${s.proposalMd.slice(0, 6000)}` : "",
    s.transcript ? `Discovery notes:\n${s.transcript.slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateEngagementPlan(
  scope: EngagementScope,
  opts?: { engagementId?: string },
): Promise<{ plan: EngagementPlan; provider: BrainProvider }> {
  const provider = brainProvider();
  const context = scopeText(scope);

  if (llmConfigured()) {
    try {
      const ground = await grounding(`${scope.name} ${scope.charter?.scope ?? scope.summary ?? ""}`);
      const res = await chat({
        system:
          PROVECTA_VOICE +
          " You are planning a Business Operations engagement delivered on the bRRAIn-powered platform. " +
          "Design the delivery plan tailored to THIS client's scope — not a generic template. " +
          "Phases should be a concrete path from discovery to handover; deliverables are real artifacts (audits, architectures, builds, reports); " +
          "tasks are the work to produce them; KPIs are measurable and tied to the success criteria. " +
          "Do not invent client facts beyond the scope provided. Call the emit_engagement_plan tool with the plan." +
          ground,
        messages: [{ role: "user", content: `Engagement scope:\n\n${context}\n\nProduce the tailored delivery plan.` }],
        tools: [PLAN_TOOL],
        toolChoice: { type: "tool", name: PLAN_TOOL.name },
        maxTokens: 3000,
        temperature: 0.4,
      });
      const call = extractToolUses(res.content).find((t) => t.name === PLAN_TOOL.name);
      if (call) {
        const plan = sanitizePlan(call.input);
        if (plan.phases.length) {
          await prisma.brainQuery
            .create({
              data: {
                prompt: `Generate engagement plan: ${scope.name}`,
                response: JSON.stringify(plan).slice(0, 8000),
                provider,
                engagementId: opts?.engagementId,
              },
            })
            .catch(() => {});
          return { plan, provider };
        }
      }
    } catch {
      // fall through to heuristic
    }
  }
  return { plan: heuristicPlan(scope), provider: "STUB" };
}

// Coerce arbitrary tool input into a bounded, well-typed EngagementPlan.
function sanitizePlan(input: unknown): EngagementPlan {
  const obj = (input ?? {}) as Record<string, unknown>;
  const rawPhases = Array.isArray(obj.phases) ? obj.phases : [];
  const rawKpis = Array.isArray(obj.kpis) ? obj.kpis : [];

  const phases: PlannedPhase[] = rawPhases.slice(0, 8).map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const day = Number(o.dayOffset);
    const deliverables = (Array.isArray(o.deliverables) ? o.deliverables : []).slice(0, 8).map((d) => {
      const dd = (d ?? {}) as Record<string, unknown>;
      const kind = String(dd.kind ?? "DELIVERABLE").toUpperCase();
      return {
        title: String(dd.title ?? "Deliverable").slice(0, 200),
        kind: (DELIVERABLE_KINDS.includes(kind as DeliverableKind) ? kind : "DELIVERABLE") as DeliverableKind,
        detail: dd.detail ? String(dd.detail).slice(0, 4000) : undefined,
      };
    });
    const tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 12).map((t) => {
      const tt = (t ?? {}) as Record<string, unknown>;
      const pr = String(tt.priority ?? "MEDIUM").toUpperCase();
      return {
        title: String(tt.title ?? "Task").slice(0, 200),
        priority: (TASK_PRIORITIES.includes(pr as TaskPriority) ? pr : "MEDIUM") as TaskPriority,
      };
    });
    return {
      title: String(o.title ?? `Phase ${i + 1}`).slice(0, 200),
      summary: o.summary ? String(o.summary).slice(0, 500) : undefined,
      dayOffset: Number.isFinite(day) ? Math.max(0, Math.min(720, Math.round(day))) : i * 14,
      clientVisible: o.clientVisible === false ? false : true,
      deliverables,
      tasks,
    };
  });

  const kpis: PlannedKpi[] = rawKpis.slice(0, 6).map((k) => {
    const o = (k ?? {}) as Record<string, unknown>;
    const target = Number(o.target);
    return {
      label: String(o.label ?? "KPI").slice(0, 160),
      unit: o.unit ? String(o.unit).slice(0, 16) : undefined,
      target: Number.isFinite(target) ? target : undefined,
    };
  });

  return { phases, kpis };
}

// Keyless fallback: a sensible, generic-but-structured plan so the flow works
// without an API key. Mirrors the onboarding arc but as a full plan object.
function heuristicPlan(scope: EngagementScope): EngagementPlan {
  const client = scope.name;
  return {
    phases: [
      {
        title: "Kickoff & access",
        summary: "Stand up the workspace, grant access, align on outcomes.",
        dayOffset: 0,
        clientVisible: true,
        deliverables: [{ title: "Engagement charter", kind: "DELIVERABLE", detail: "Objectives, scope, success criteria, sponsor." }],
        tasks: [
          { title: "Provision client workspace & logins", priority: "HIGH" },
          { title: "Confirm sponsor and weekly cadence", priority: "MEDIUM" },
        ],
      },
      {
        title: "Discovery & current-state audit",
        summary: "Map the current operating model and baseline the KPIs.",
        dayOffset: 7,
        clientVisible: true,
        deliverables: [{ title: `${client} current-state audit`, kind: "AUDIT", detail: "Findings, gaps, KPI baseline, ADKAR readiness." }],
        tasks: [
          { title: "Run discovery interviews", priority: "HIGH" },
          { title: "Inventory systems & data sources", priority: "MEDIUM" },
        ],
      },
      {
        title: "Operating model design",
        summary: "Design the target operating model on the platform.",
        dayOffset: 21,
        clientVisible: true,
        deliverables: [{ title: "Operating model & systems architecture", kind: "ARCHITECTURE", detail: "Target processes, data model, integrations." }],
        tasks: [{ title: "Draft target-state architecture", priority: "HIGH" }],
      },
      {
        title: "Build & integration",
        summary: "Build the model and connect existing systems into one source of truth.",
        dayOffset: 45,
        clientVisible: true,
        deliverables: [{ title: "Configured platform & integrations", kind: "BUILD", detail: "Native build plus specialist-rail integrations." }],
        tasks: [
          { title: "Build core workflows", priority: "HIGH" },
          { title: "Wire integrations", priority: "MEDIUM" },
        ],
      },
      {
        title: "Enablement & handover",
        summary: "Train the team and move to measured autonomous operations.",
        dayOffset: 60,
        clientVisible: true,
        deliverables: [{ title: "Runbooks & enablement report", kind: "REPORT", detail: "Training, runbooks, autonomy ramp plan." }],
        tasks: [{ title: "Deliver enablement sessions", priority: "MEDIUM" }],
      },
    ],
    kpis: [
      { label: "Onboarding completion", unit: "%", target: 100 },
      { label: "Time to first value (days)", unit: "days", target: 30 },
    ],
  };
}
