"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { recordApproval, ensureAutonomyPolicy, canAutoExecute } from "@/lib/autonomy";
import { draftReply, draftDeliverable, type DeliverableKind } from "@/lib/brain";
import { generateAndStagePlan } from "@/server/engagement/plan";
import { getEngagementMaterials } from "@/server/rag/engagement-context";
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

  // Phase started → emit PHASE_READY (queues a drafting suggestion in the agent
  // loop) and, when the deliverable-drafting ramp has graduated to AUTONOMOUS,
  // have bRRAIn draft this phase's not-yet-drafted deliverables automatically.
  if (next === "IN_PROGRESS" && current.status !== "IN_PROGRESS") {
    await emitEvent("PHASE_READY", "Milestone", id, { engagementId: current.engagementId, title: current.title }).catch(() => {});
    await autoDraftPhaseDeliverables(id, current.engagementId, admin.id).catch(() => {});
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
    await emitEvent("PROPOSAL_ACCEPTED", "Engagement", id, { status }).catch(() => {});
    const planned = await prisma.milestone.count({ where: { engagementId: id, source: "BRAIN" } });
    if (planned === 0) {
      await generateAndStagePlan(id, admin.id).catch(() => {});
    }
  }

  revalidatePath(`/admin/engagements/${id}`);
  revalidatePath("/admin/engagements");
}

// Explicit "Generate plan with bRRAIn" button on the engagement page.
export async function generateEngagementPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;
  await generateAndStagePlan(id, admin.id);
  revalidatePath(`/admin/engagements/${id}`);
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
  const materials = await getEngagementMaterials(d.engagementId, d.engagement.tenant.id, { maxChars: 14000 });
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

// P6: when a phase starts and the deliverable-drafting ramp has graduated to
// AUTONOMOUS, bRRAIn drafts that phase's not-yet-drafted deliverables. Until the
// ramp graduates (default SUGGEST), this is a no-op — the PHASE_READY event has
// already queued the suggestion and the operator drafts via the button.
// Best-effort and bounded (≤3 per phase) so the triggering action stays snappy.
async function autoDraftPhaseDeliverables(milestoneId: string, engagementId: string, actorId: string | null) {
  const policy = await ensureAutonomyPolicy("deliverable-drafting", "REVERSIBLE");
  if (!canAutoExecute(policy.state, "REVERSIBLE")) return;

  const pending = await prisma.deliverable.findMany({
    where: { milestoneId, OR: [{ detail: null }, { detail: "" }] },
    orderBy: { orderIndex: "asc" },
    take: 3,
  });
  if (pending.length === 0) return;

  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { charter: true, tenant: { select: { id: true } } },
  });
  if (!eng) return;

  const phase = await prisma.milestone.findUnique({ where: { id: milestoneId }, select: { title: true } });
  const materials = await getEngagementMaterials(engagementId, eng.tenant.id, { maxChars: 14000 });

  // A full draft now takes ~35-50s, so only ~1 fits inside the 60s function
  // window. Draft as many as the remaining wall-clock allows (each with a
  // generous budget for full content) and leave the rest PENDING — the next
  // PHASE event / agent tick / manual button picks them up. Never run past the
  // window or the advancing action would time out.
  const startedAt = Date.now();
  const WINDOW_MS = 55_000; // headroom under maxDuration=60
  const PER_DRAFT_MS = 55_000;
  let drafted = 0;
  for (const d of pending) {
    if (Date.now() - startedAt + PER_DRAFT_MS > WINDOW_MS) break; // not enough time for another full draft
    const { detail, provider } = await draftDeliverable(
      {
        title: d.title,
        kind: d.kind as DeliverableKind,
        phaseTitle: phase?.title ?? null,
        engagementName: eng.name,
        charter: eng.charter,
        materials: materials || null,
      },
      { engagementId, budgetMs: PER_DRAFT_MS, perRequestTimeoutMs: PER_DRAFT_MS - 1_000 },
    );
    await prisma.deliverable.update({ where: { id: d.id }, data: { detail } });
    await audit(actorId, "DELIVERABLE_AUTODRAFTED", "Deliverable", d.id, `${provider} · ${detail.length} chars`);
    drafted++;
  }
  if (drafted < pending.length) {
    console.info("autoDraft.deferred", { milestoneId, drafted, deferred: pending.length - drafted });
  }
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
