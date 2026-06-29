"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { recordApproval } from "@/lib/autonomy";
import { draftReply, generateEngagementPlan, draftDeliverable, type DeliverableKind } from "@/lib/brain";
import { stageEngagementPlan } from "@/server/staging";
import { emitEvent } from "@/lib/events/emit";
import { emitClientUpdate } from "@/server/notifications/fanout";
import { recomputeSnapshot } from "@/server/dashboards/metrics";

function ticketCategory(channel: string, subject: string): string {
  if (/status|call|milestone|progress/i.test(subject)) return "milestone-status-reply";
  return `ticket-${channel.toLowerCase()}`;
}

async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}

const MILESTONE_NEXT: Record<string, string> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: "COMPLETED",
  BLOCKED: "IN_PROGRESS",
};

export async function advanceMilestone(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const current = await prisma.milestone.findUnique({ where: { id } });
  if (!current) return;
  const next = MILESTONE_NEXT[current.status] ?? "IN_PROGRESS";
  await prisma.milestone.update({
    where: { id },
    data: { status: next, completedAt: next === "COMPLETED" ? new Date() : null },
  });
  await audit(admin.id, "MILESTONE_ADVANCE", "Milestone", id, `${current.status}→${next}`);

  // Milestone reached → emit a DomainEvent (agent loop picks it up), send an
  // artifact-grounded (honesty-gated) client update via the Communication ledger,
  // and refresh the live snapshot.
  if (next === "COMPLETED") {
    await emitEvent("MILESTONE_COMPLETED", "Milestone", id, { engagementId: current.engagementId, title: current.title });
    const eng = await prisma.engagement.findUnique({ where: { id: current.engagementId }, select: { tenantId: true, name: true } });
    if (eng) {
      await emitClientUpdate({
        tenantId: eng.tenantId,
        engagementId: current.engagementId,
        body: `Milestone "${current.title}" completed on ${eng.name}.`,
        claim: "MILESTONE_COMPLETE",
        backing: { milestoneStatus: "COMPLETED" },
      });
      await recomputeSnapshot(current.engagementId);
      await audit(admin.id, "CLIENT_NOTIFY", "Engagement", current.engagementId, "milestone complete → client update logged");
    }
  }
  revalidatePath(`/admin/engagements/${current.engagementId}`);
}

export async function setEngagementStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const before = await prisma.engagement.findUnique({ where: { id }, select: { status: true } });
  await prisma.engagement.update({ where: { id }, data: { status } });
  await audit(admin.id, "ENGAGEMENT_STATUS", "Engagement", id, status);

  // On proposal accept (→ ACTIVE), have bRRAIn generate the tailored delivery
  // plan if one hasn't been generated yet. Best-effort: never block the status
  // change on it.
  if (status === "ACTIVE" && before?.status !== "ACTIVE") {
    const planned = await prisma.milestone.count({ where: { engagementId: id, source: "BRAIN" } });
    if (planned === 0) {
      await generateAndStagePlan(id, admin.id).catch(() => {});
    }
  }

  revalidatePath(`/admin/engagements/${id}`);
  revalidatePath("/admin/engagements");
}

// Assemble an engagement's scope, ask bRRAIn for the tailored plan, and stage it.
// Shared by the explicit "Generate plan" action and the auto-trigger on accept.
async function generateAndStagePlan(engagementId: string, actorId: string | null) {
  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { charter: true, proposal: true, tenant: { select: { id: true, name: true } } },
  });
  if (!eng) return null;

  const transcripts = await prisma.transcript.findMany({
    where: { OR: [{ engagementId }, { tenantId: eng.tenantId }] },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const transcript = transcripts.map((t) => `# ${t.title}\n${t.body}`).join("\n\n").slice(0, 16000);

  const { plan, provider } = await generateEngagementPlan(
    {
      name: eng.name,
      summary: eng.summary,
      budgetMinor: eng.budgetMinor,
      currency: eng.currency,
      charter: eng.charter,
      proposalMd: eng.proposal?.bodyMd ?? null,
      transcript: transcript || null,
    },
    { engagementId },
  );

  const result = await stageEngagementPlan(engagementId, plan);
  await audit(
    actorId,
    "ENGAGEMENT_PLAN_STAGED",
    "Engagement",
    engagementId,
    `${provider} · ${result.milestones} phases · created=${result.created}`,
  );
  return result;
}

// Explicit "Generate plan with bRRAIn" button on the engagement page.
export async function generateEngagementPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;
  await generateAndStagePlan(id, admin.id);
  revalidatePath(`/admin/engagements/${id}`);
}

// Concatenate an engagement's grounding materials (recent transcripts + the text
// of uploaded documents) for use as deliverable-drafting context.
async function engagementMaterials(engagementId: string, tenantId: string): Promise<string> {
  const transcripts = await prisma.transcript.findMany({
    where: { OR: [{ engagementId }, { tenantId }] },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  const parts = transcripts.map((t) => `# ${t.title}\n${t.body}`);
  return parts.join("\n\n").slice(0, 16000);
}

// "Draft with bRRAIn" on a deliverable: generate real content into Deliverable.detail
// for operator review. Drafting keeps the deliverable internal (clientVisible stays
// as-is) until an operator publishes it.
export async function draftDeliverableAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;

  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: {
      engagement: { include: { charter: true, tenant: { select: { id: true } } } },
    },
  });
  if (!d) return;

  const phase = d.milestoneId
    ? await prisma.milestone.findUnique({ where: { id: d.milestoneId }, select: { title: true } })
    : null;
  const materials = await engagementMaterials(d.engagementId, d.engagement.tenant.id);
  const { detail, provider } = await draftDeliverable(
    {
      title: d.title,
      kind: d.kind as DeliverableKind,
      phaseTitle: phase?.title ?? null,
      engagementName: d.engagement.name,
      charter: d.engagement.charter,
      materials: materials || null,
    },
    { engagementId: d.engagementId },
  );

  await prisma.deliverable.update({ where: { id }, data: { detail } });
  await audit(admin.id, "DELIVERABLE_DRAFTED", "Deliverable", id, `${provider} · ${detail.length} chars`);
  revalidatePath(`/admin/engagements/${d.engagementId}`);
}

export async function approveTicketAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) return;
  await prisma.ticket.update({ where: { id }, data: { status: "RESOLVED" } });
  await prisma.ticketMessage.create({
    data: { ticketId: id, author: "AGENT", body: `Approved proposed action: ${t.proposedAction ?? "(none)"}` },
  });
  await recordApproval(ticketCategory(t.channel, t.subject));
  await audit(admin.id, "TICKET_APPROVE", "Ticket", id);
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/autonomy");
}

export async function setTicketStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await prisma.ticket.update({ where: { id }, data: { status } });
  await audit(admin.id, "TICKET_STATUS", "Ticket", id, status);
  revalidatePath("/admin/tickets");
}

// bRRAIn drafts a reply for the ticket → admin reviews/approves it.
export async function aiDraftTicketReply(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!t) return;
  const last = t.messages[0]?.body ?? "";
  const draft = await draftReply(t.subject, last, { engagementId: t.engagementId ?? undefined });
  await prisma.ticket.update({ where: { id }, data: { proposedAction: draft } });
  await prisma.ticketMessage.create({
    data: { ticketId: id, author: "SYSTEM", body: `bRRAIn drafted a reply (pending approval): ${draft}` },
  });
  await audit(admin.id, "AI_DRAFT_REPLY", "Ticket", id);
  revalidatePath("/admin/tickets");
}

export async function markInvoicePaid(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === "PAID") return;
  await prisma.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  await prisma.payment.create({
    data: { invoiceId: id, amountMinor: inv.amountMinor, currency: inv.currency, method: inv.method ?? "MANUAL", providerRef: "manual_admin" },
  });
  await audit(admin.id, "INVOICE_PAID", "Invoice", id);
  revalidatePath("/admin/invoices");
}

// Client raises a ticket from the portal.
export async function createPortalTicket(formData: FormData) {
  const user = await requireUser();
  if (!user.tenantId) return;
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject) return;
  const engagement = await prisma.engagement.findFirst({ where: { tenantId: user.tenantId } });
  const ticket = await prisma.ticket.create({
    data: {
      tenantId: user.tenantId,
      engagementId: engagement?.id,
      subject,
      channel: "PORTAL",
      status: "OPEN",
      priority: "MEDIUM",
      autonomyState: "SUGGEST",
      proposedAction: "Triage pending — routed to Provecta.",
    },
  });
  if (body) {
    await prisma.ticketMessage.create({ data: { ticketId: ticket.id, author: "CLIENT", body } });
  }
  // Notify the back office (logged) so stakeholders stay abreast.
  const admins = await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } } });
  for (const a of admins) {
    await prisma.notification.create({ data: { userId: a.id, type: "TICKET", body: `New portal ticket: "${subject}"` } });
  }
  await audit(user.id, "TICKET_CREATE", "Ticket", ticket.id, "portal");
  revalidatePath("/portal");
}

// Mark the current user's notifications read.
export async function markAllRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/admin/notifications");
  revalidatePath("/portal");
}
