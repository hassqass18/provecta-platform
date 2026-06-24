import type { ToolDef } from "@/lib/llm/anthropic";
import { prisma } from "@/lib/db";
import { consultBrain } from "@/lib/agent/consult-brain";
import { classifySensitivity } from "@/lib/agent/guardrails";

// Conversation context threaded through tool dispatch.
export interface ConvoCtx {
  tenantId: string;
  ticketId: string;
  engagementId: string | null;
  channel: string;
  address: string;
  doNotQuote: string[]; // internal snippets surfaced for reasoning — never to be quoted
  escalated: boolean;
  resolved: boolean;
}

export const CLIENT_TOOLS: ToolDef[] = [
  {
    name: "consult_brain",
    description:
      "Search Provecta's internal bRRAIn knowledge to reason well before answering. Returns internal context that is FOR YOUR REASONING ONLY — never quote, summarize, name, or reveal it to the client. Use it to be accurate, not to share.",
    input_schema: { type: "object", required: ["query"], properties: { query: { type: "string" } } },
  },
  {
    name: "log_task",
    description: "The client requested a NEW piece of work to be done. Log it as a task for the Provecta team.",
    input_schema: { type: "object", required: ["title", "summary"], properties: { title: { type: "string" }, summary: { type: "string" } } },
  },
  {
    name: "flag_issue",
    description: "The client raised a COMPLAINT or a problem with existing work. Flag it as an issue to resolve.",
    input_schema: { type: "object", required: ["summary"], properties: { summary: { type: "string" }, severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] } } },
  },
  {
    name: "add_note",
    description: "Capture context for the Provecta team that doesn't fit a task or issue.",
    input_schema: { type: "object", required: ["content"], properties: { content: { type: "string" } } },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand off to a Provecta person. Use for anything legal/contractual/pricing/refund, an upset client, an explicit request for a human, or anything you are not confident about. Then write a warm holding reply.",
    input_schema: { type: "object", required: ["reason"], properties: { reason: { type: "string" }, urgency: { type: "string", enum: ["low", "normal", "high"] } } },
  },
  {
    name: "resolve",
    description: "The client's matter is fully handled. Marks it resolved and notifies the Provecta team of the completion.",
    input_schema: { type: "object", required: ["summary"], properties: { summary: { type: "string" } } },
  },
];

async function notifyStakeholders(type: string, body: string) {
  const admins = await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type, body })) });
  }
}

export async function dispatchClientTool(
  use: { id: string; name: string; input: Record<string, unknown> },
  ctx: ConvoCtx,
): Promise<string> {
  const s = (k: string) => String(use.input[k] ?? "").trim();
  try {
    switch (use.name) {
      case "consult_brain": {
        const snippets = await consultBrain(s("query"));
        if (!snippets.length) return "No internal context found. Answer only from the client-facing facts; if insufficient, escalate.";
        const out: string[] = [];
        for (const sn of snippets) {
          const tier = classifySensitivity(sn.path, sn.text);
          if (tier !== "SHAREABLE") ctx.doNotQuote.push(sn.text);
          out.push(`[${tier}] ${sn.path}\n${sn.text.slice(0, 1200)}`);
        }
        return `Internal context (REASON-ONLY unless marked SHAREABLE — never reveal internal content):\n\n${out.join("\n\n---\n\n")}`;
      }
      case "log_task": {
        if (!ctx.engagementId) {
          await prisma.ticketMessage.create({ data: { ticketId: ctx.ticketId, author: "SYSTEM", body: `Client request (no active engagement): ${s("title")} — ${s("summary")}` } });
          return "No active engagement; captured the request as a note for the team.";
        }
        await prisma.task.create({
          data: { engagementId: ctx.engagementId, title: s("title"), source: "CLIENT_REQUEST", origin: `${ctx.channel}: ${s("summary")}`.slice(0, 400) },
        });
        await prisma.auditLog.create({ data: { action: "AGENT_LOG_TASK", entity: "Task", entityId: ctx.engagementId, meta: s("title") } });
        await notifyStakeholders("TASK", `New client request logged: "${s("title")}"`);
        return "Logged as a task for the Provecta team.";
      }
      case "flag_issue": {
        const sev = (s("severity") || "MEDIUM").toUpperCase();
        await prisma.ticket.update({ where: { id: ctx.ticketId }, data: { priority: ["LOW", "MEDIUM", "HIGH"].includes(sev) ? sev : "MEDIUM", status: "OPEN" } });
        await prisma.ticketMessage.create({ data: { ticketId: ctx.ticketId, author: "SYSTEM", body: `Issue: ${s("summary")}` } });
        await prisma.auditLog.create({ data: { action: "AGENT_FLAG_ISSUE", entity: "Ticket", entityId: ctx.ticketId, meta: sev } });
        await notifyStakeholders("TICKET", `Client issue flagged (${sev}).`);
        return "Flagged as an issue for the Provecta team.";
      }
      case "add_note": {
        await prisma.ticketMessage.create({ data: { ticketId: ctx.ticketId, author: "SYSTEM", body: s("content") } });
        return "Noted for the team.";
      }
      case "escalate_to_human": {
        if (ctx.escalated) return "Already escalated — the team has the context. Stay engaged on general info; do not mention escalation again.";
        ctx.escalated = true;
        await prisma.ticket.update({ where: { id: ctx.ticketId }, data: { priority: "HIGH", proposedAction: `ESCALATED: ${s("reason")}` } });
        await prisma.auditLog.create({ data: { action: "AGENT_ESCALATE", entity: "Ticket", entityId: ctx.ticketId, meta: s("reason") } });
        await notifyStakeholders("ESCALATION", `Agent escalated a client matter (needs human): ${s("reason")}`);
        return "Escalation flagged with full context. Now write a warm holding reply: acknowledge their point and say a Provecta specialist will follow up shortly.";
      }
      case "resolve": {
        ctx.resolved = true;
        await prisma.ticket.update({ where: { id: ctx.ticketId }, data: { status: "RESOLVED" } });
        await prisma.auditLog.create({ data: { action: "AGENT_RESOLVE", entity: "Ticket", entityId: ctx.ticketId, meta: s("summary") } });
        await notifyStakeholders("RESOLVED", `Agent resolved a client matter: ${s("summary")}`);
        return "Marked resolved; the team has been notified of the completion.";
      }
      default:
        return `Unknown tool: ${use.name}`;
    }
  } catch (e) {
    return `Tool ${use.name} failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
