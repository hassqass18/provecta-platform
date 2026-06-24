import { prisma } from "@/lib/db";
import { chat, extractText, extractToolUses, llmConfigured, type ChatMessage, type ContentBlock } from "@/lib/llm/anthropic";
import { ensureAutonomyPolicy, canAutoExecute } from "@/lib/autonomy";
import { guardClientReply } from "@/lib/agent/guardrails";
import { getClientContext, renderClientContext } from "./context";
import { buildClientAgentPrompt } from "./client-prompt";
import { CLIENT_TOOLS, dispatchClientTool, type ConvoCtx } from "./client-tools";
import { sendOnChannel } from "@/server/comms/transport";
import { sendComm } from "@/server/comms/send";
import { sendPushToTenantClients } from "@/server/notifications/push";

const MAX_TOOL_ITERS = 3;
type HistTurn = { role: "user" | "assistant"; content: string; ts: string };

// Entry point: an INBOUND_TICKET event → run the bRRAIn client agent.
export async function converseFromTicket(ticketId: string): Promise<{ status: string; reply?: string }> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tenant: true, messages: { where: { author: "CLIENT" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!ticket) return { status: "no-ticket" };

  const tenant = ticket.tenant;
  const channel = (tenant.preferredChannel || ticket.channel || "PORTAL").toUpperCase();
  const address = tenant.channelAddress || tenant.slug;
  const inboundText = ticket.messages[0]?.body ?? ticket.subject;
  const clientAskedAboutContract = /\bcontract(s|ual)?\b|\bagreement\b|\bclause\b|\bterms?\b/i.test(inboundText);

  const eng = await prisma.engagement.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, select: { id: true } });

  // conversation state
  const state = await prisma.conversationState.upsert({
    where: { tenantId_channel_address: { tenantId: tenant.id, channel, address } },
    create: { tenantId: tenant.id, channel, address, history: [], lastInboundAt: new Date() },
    update: { lastInboundAt: new Date() },
  });
  const history: HistTurn[] = Array.isArray(state.history) ? (state.history as unknown as HistTurn[]) : [];
  history.push({ role: "user", content: inboundText, ts: new Date().toISOString() });

  const personnelNames = (await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] }, name: { not: null } }, select: { name: true } }))
    .map((u) => u.name as string)
    .filter(Boolean);

  const ctx: ConvoCtx = { tenantId: tenant.id, ticketId, engagementId: eng?.id ?? null, channel, address, doNotQuote: [], escalated: false, resolved: false };

  let draft = "";
  if (!llmConfigured()) {
    draft = "Thanks for your message — the Provecta team has it and will follow up shortly.";
  } else {
    const facts = renderClientContext(await getClientContext(tenant.id));
    const system = buildClientAgentPrompt(facts);
    const messages: ChatMessage[] = history.map((h) => ({ role: h.role, content: h.content }));
    try {
      for (let i = 0; i < MAX_TOOL_ITERS; i++) {
        const res = await chat({ system, messages, tools: CLIENT_TOOLS, maxTokens: 600, temperature: 0.4 });
        if (res.stop_reason === "tool_use") {
          const uses = extractToolUses(res.content);
          const results: ContentBlock[] = [];
          for (const u of uses) {
            const out = await dispatchClientTool(u, ctx);
            results.push({ type: "tool_result", tool_use_id: u.id, content: out });
          }
          messages.push({ role: "assistant", content: res.content });
          messages.push({ role: "user", content: results });
          continue;
        }
        draft = extractText(res.content);
        break;
      }
    } catch (e) {
      draft = "Give me a moment — the Provecta team will follow up shortly.";
      await prisma.auditLog.create({ data: { action: "AGENT_LLM_ERROR", entity: "Ticket", entityId: ticketId, meta: String(e).slice(0, 200) } });
    }
  }

  // Output guardrail (two-sided: context-side tags + this output-side filter)
  const guard = guardClientReply({ draft: draft || "Thanks — the Provecta team will follow up shortly.", clientAskedAboutContract, personnelNames, doNotQuote: ctx.doNotQuote });
  let reply = guard.text;
  if (!guard.safe) {
    // a hard violation (e.g. would reveal internal/contract) → escalate, send a safe holding line
    if (!ctx.escalated) {
      await dispatchClientTool({ id: "guard", name: "escalate_to_human", input: { reason: `output guard blocked: ${guard.violations.join(", ")}`, urgency: "normal" } }, ctx);
    }
    reply = "Thanks for raising that — I want to get you a precise answer, so a Provecta specialist will follow up with you shortly.";
    await prisma.auditLog.create({ data: { action: "AGENT_GUARD_BLOCK", entity: "Ticket", entityId: ticketId, meta: guard.violations.join(",") } });
  }

  // Approve-first vs autonomous
  const policy = await ensureAutonomyPolicy("client-reply", "REVERSIBLE");
  const auto = canAutoExecute(policy.state, "REVERSIBLE"); // AUTONOMY_FREEZE + ramp respected

  if (auto) {
    await sendOnChannel(channel, address, reply); // gated transport; the Communication row is the auditable record
    await sendComm({ tenantId: tenant.id, engagementId: eng?.id ?? null, channel, actorType: "AGENT", body: reply, direction: "OUT", autonomyState: policy.state });
    // Push the reply to the client's devices (in-app thread + notification).
    await sendPushToTenantClients(tenant.id, { title: "Provecta", body: reply, data: { screen: "messages" } });
    history.push({ role: "assistant", content: reply, ts: new Date().toISOString() });
    await prisma.conversationState.update({ where: { id: state.id }, data: { history: history as unknown as object, escalated: ctx.escalated } });
    return { status: ctx.resolved ? "auto-resolved" : "auto-sent", reply };
  }

  // approve-first: queue the drafted reply for one-click human approval
  await prisma.agentRun.create({
    data: {
      trigger: "INBOUND_TICKET",
      actionCategory: "client-reply",
      riskClass: "REVERSIBLE",
      autonomyState: policy.state,
      status: "AWAITING_REVIEW",
      inputJson: { ticketId, inbound: inboundText },
      outputJson: { reply, channel, address, tenantId: tenant.id, engagementId: eng?.id ?? null, escalated: ctx.escalated },
    },
  });
  await prisma.conversationState.update({ where: { id: state.id }, data: { history: history as unknown as object, escalated: ctx.escalated } });
  return { status: "queued-for-approval", reply };
}
