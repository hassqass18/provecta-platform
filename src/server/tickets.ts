import { prisma } from "@/lib/db";
import { sendComm } from "@/server/comms/send";
import { notifyTenantClients } from "@/server/notifications/fanout";

/**
 * Ticket lifecycle (Zendesk/ServiceNow model): OPEN → TRIAGED → IN_PROGRESS →
 * PENDING (waiting on client) → RESOLVED → CLOSED, with priority, assignment,
 * and first-response / resolution SLAs by priority.
 */

export const SLA_FIRST_RESPONSE_HOURS: Record<string, number> = { HIGH: 4, MEDIUM: 24, LOW: 72 };

export function slaInfo(t: { priority: string; createdAt: Date; firstResponseAt: Date | null }) {
  const hours = SLA_FIRST_RESPONSE_HOURS[t.priority] ?? 24;
  const dueAt = new Date(t.createdAt.getTime() + hours * 3600_000);
  if (t.firstResponseAt) {
    return { state: t.firstResponseAt <= dueAt ? "met" : "missed", dueAt, targetHours: hours };
  }
  return { state: Date.now() > dueAt.getTime() ? "breached" : "on-track", dueAt, targetHours: hours };
}

const OPEN_STATES = ["OPEN", "TRIAGED", "IN_PROGRESS", "PENDING"];

export async function listTickets(status?: string) {
  const where = status === "OPEN_ALL" || !status ? { status: { in: OPEN_STATES } } : status === "ALL" ? {} : { status };
  const tickets = await prisma.ticket.findMany({
    where, orderBy: { createdAt: "desc" }, take: 100,
    include: { tenant: { select: { name: true } } },
  });
  const assigneeIds = [...new Set(tickets.map((t) => t.assigneeId).filter(Boolean) as string[])];
  const users = assigneeIds.length ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } }) : [];
  const nameOf = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return tickets.map((t) => ({
    id: t.id, subject: t.subject, channel: t.channel, status: t.status, priority: t.priority,
    client: t.tenant.name, assigneeId: t.assigneeId, assigneeName: t.assigneeId ? nameOf[t.assigneeId] ?? null : null,
    createdAt: t.createdAt, sla: slaInfo(t),
  }));
}

export async function ticketDetail(id: string) {
  const t = await prisma.ticket.findUnique({ where: { id }, include: { tenant: { select: { name: true } }, messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) return null;
  const staff = await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } }, select: { id: true, name: true } });
  const assignee = t.assigneeId ? staff.find((s) => s.id === t.assigneeId) ?? null : null;
  return {
    ticket: {
      id: t.id, subject: t.subject, channel: t.channel, status: t.status, priority: t.priority,
      client: t.tenant.name, tenantId: t.tenantId, engagementId: t.engagementId,
      assigneeId: t.assigneeId, assigneeName: assignee?.name ?? null, sla: slaInfo(t), createdAt: t.createdAt,
    },
    messages: t.messages.map((m) => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt })),
    staff: staff.map((s) => ({ id: s.id, name: s.name })),
  };
}

export async function ticketAction(
  id: string,
  input: { action: "SET_STATUS" | "SET_PRIORITY" | "ASSIGN" | "REPLY"; value?: string | null; body?: string },
) {
  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) throw new Error("ticket not found");

  if (input.action === "SET_STATUS") {
    const status = String(input.value);
    const resolved = ["RESOLVED", "CLOSED"].includes(status);
    await prisma.ticket.update({ where: { id }, data: { status, resolvedAt: resolved ? t.resolvedAt ?? new Date() : t.resolvedAt } });
    await notifyTenantClients(t.tenantId, "UPDATE", `Your request “${t.subject}” is now ${status.replace("_", " ").toLowerCase()}`);
    return { ok: true, status };
  }
  if (input.action === "SET_PRIORITY") {
    await prisma.ticket.update({ where: { id }, data: { priority: String(input.value) } });
    return { ok: true };
  }
  if (input.action === "ASSIGN") {
    await prisma.ticket.update({ where: { id }, data: { assigneeId: input.value || null } });
    return { ok: true };
  }
  // REPLY — staff response to the client, sets first-response SLA.
  const body = (input.body ?? "").trim();
  if (!body) throw new Error("empty reply");
  await prisma.ticketMessage.create({ data: { ticketId: id, author: "AGENT", body } });
  await prisma.ticket.update({
    where: { id },
    data: { firstResponseAt: t.firstResponseAt ?? new Date(), status: t.status === "OPEN" ? "IN_PROGRESS" : t.status },
  });
  await sendComm({ tenantId: t.tenantId, engagementId: t.engagementId ?? null, channel: t.channel, actorType: "HUMAN", body, direction: "OUT" });
  await notifyTenantClients(t.tenantId, "REPLY", `Provecta replied to “${t.subject}”`);
  return { ok: true };
}
