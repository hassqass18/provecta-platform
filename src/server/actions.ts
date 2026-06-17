"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { recordApproval } from "@/lib/autonomy";

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
  revalidatePath(`/admin/engagements/${current.engagementId}`);
}

export async function setEngagementStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await prisma.engagement.update({ where: { id }, data: { status } });
  await audit(admin.id, "ENGAGEMENT_STATUS", "Engagement", id, status);
  revalidatePath(`/admin/engagements/${id}`);
  revalidatePath("/admin/engagements");
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
  await audit(user.id, "TICKET_CREATE", "Ticket", ticket.id, "portal");
  revalidatePath("/portal");
}
