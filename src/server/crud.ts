"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

async function audit(actorId: string, action: string, entity: string, entityId?: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dateOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(v) : null;
};
const dollarsToMinor = (fd: FormData, k: string) => Math.round((Number(fd.get(k)) || 0) * 100);

// ── Clients ───────────────────────────────────────────────────────────
export async function createClient(formData: FormData) {
  const admin = await requireAdmin();
  const name = str(formData, "name");
  if (!name) return;
  // Onboarding: the client's main point of communication. Inbound on this channel
  // (matched by channelAddress) routes to this client and is their pull source.
  const preferredChannel = str(formData, "preferredChannel") || null;
  const channelAddress = str(formData, "channelAddress") || null;
  const t = await prisma.tenant.create({
    data: { name, slug: slugify(name), type: "CLIENT", preferredChannel, channelAddress },
  });
  // P1C durable outbox: pull the client's brain finals + auto-stage an onboarding
  // project. Drained idempotently by /api/cron/agent-tick (Vercel-safe, retryable).
  await prisma.ingestJob.createMany({
    data: [
      { tenantId: t.id, kind: "PULL_FINALS", status: "PENDING" },
      { tenantId: t.id, kind: "STAGE_PROJECT", status: "PENDING", payload: { templateKey: "onboarding" } },
    ],
  });
  await audit(admin.id, "CLIENT_CREATE", "Tenant", t.id, preferredChannel ? `${name} · ${preferredChannel}` : name);
  revalidatePath("/admin/clients");
}

// Approve a brain-pulled document for client visibility (client-approval finality).
export async function approveDocument(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.document.update({ where: { id }, data: { clientVisible: true } });
  await audit(admin.id, "DOCUMENT_APPROVE", "Document", id);
  revalidatePath("/admin/brain");
}

// ── Engagements ───────────────────────────────────────────────────────
export async function createEngagement(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  const name = str(formData, "name");
  if (!tenantId || !name) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;
  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const eng = await prisma.engagement.create({
    data: {
      tenantId,
      name,
      code,
      status: str(formData, "status") || "ACTIVE",
      summary: str(formData, "summary") || null,
      budgetMinor: dollarsToMinor(formData, "budget"),
      currency: str(formData, "currency") || "USD",
      startDate: dateOrNull(formData, "startDate"),
      targetEndDate: dateOrNull(formData, "targetEndDate"),
      charter: str(formData, "objectives")
        ? { create: { objectives: str(formData, "objectives"), sponsor: str(formData, "sponsor") || tenant.name } }
        : undefined,
    },
  });
  await audit(admin.id, "ENGAGEMENT_CREATE", "Engagement", eng.id, code);
  redirect(`/admin/engagements/${eng.id}`);
}

export async function editEngagement(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.engagement.update({
    where: { id },
    data: {
      name: str(formData, "name") || undefined,
      summary: str(formData, "summary") || null,
      budgetMinor: dollarsToMinor(formData, "budget"),
      startDate: dateOrNull(formData, "startDate"),
      targetEndDate: dateOrNull(formData, "targetEndDate"),
    },
  });
  await audit(admin.id, "ENGAGEMENT_EDIT", "Engagement", id);
  revalidatePath(`/admin/engagements/${id}`);
}

// ── Milestones & tasks ────────────────────────────────────────────────
export async function addMilestone(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  if (!engagementId || !title) return;
  const count = await prisma.milestone.count({ where: { engagementId } });
  const m = await prisma.milestone.create({
    data: {
      engagementId,
      title,
      description: str(formData, "description") || null,
      dueDate: dateOrNull(formData, "dueDate"),
      orderIndex: count + 1,
    },
  });
  await audit(admin.id, "MILESTONE_CREATE", "Milestone", m.id, title);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function addTask(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  if (!engagementId || !title) return;
  await prisma.task.create({
    data: {
      engagementId,
      milestoneId: str(formData, "milestoneId") || null,
      title,
      priority: str(formData, "priority") || "MEDIUM",
    },
  });
  await audit(admin.id, "TASK_CREATE", "Task", engagementId, title);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

// ── KPIs & SLAs ───────────────────────────────────────────────────────
export async function addKpi(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const label = str(formData, "label");
  if (!engagementId || !label) return;
  await prisma.kpi.create({
    data: {
      engagementId,
      label,
      value: Number(formData.get("value")) || 0,
      unit: str(formData, "unit") || null,
      target: formData.get("target") ? Number(formData.get("target")) : null,
    },
  });
  await audit(admin.id, "KPI_CREATE", "Kpi", engagementId, label);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function addSla(formData: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(formData, "engagementId");
  const metric = str(formData, "metric");
  if (!engagementId || !metric) return;
  await prisma.sla.create({
    data: {
      engagementId,
      metric,
      target: str(formData, "target") || "—",
      status: str(formData, "status") || "MEETING",
    },
  });
  await audit(admin.id, "SLA_CREATE", "Sla", engagementId, metric);
  revalidatePath(`/admin/engagements/${engagementId}`);
}

// ── Invoices ──────────────────────────────────────────────────────────
export async function createInvoice(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  if (!tenantId) return;
  const count = await prisma.invoice.count();
  const number = `INV-2026-${String(count + 1).padStart(4, "0")}`;
  const inv = await prisma.invoice.create({
    data: {
      tenantId,
      engagementId: str(formData, "engagementId") || null,
      number,
      status: str(formData, "status") || "DRAFT",
      amountMinor: dollarsToMinor(formData, "amount"),
      currency: str(formData, "currency") || "USD",
      method: str(formData, "method") || null,
      issuedAt: new Date(),
      dueAt: dateOrNull(formData, "dueAt"),
    },
  });
  await audit(admin.id, "INVOICE_CREATE", "Invoice", inv.id, number);
  revalidatePath("/admin/invoices");
}

// ── Tickets (admin-created) ───────────────────────────────────────────
export async function createTicketAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const tenantId = str(formData, "tenantId");
  const subject = str(formData, "subject");
  if (!tenantId || !subject) return;
  const engagement = await prisma.engagement.findFirst({ where: { tenantId } });
  const t = await prisma.ticket.create({
    data: {
      tenantId,
      engagementId: engagement?.id,
      subject,
      channel: str(formData, "channel") || "PORTAL",
      status: "OPEN",
      priority: str(formData, "priority") || "MEDIUM",
      autonomyState: "SUGGEST",
      proposedAction: "Triage pending.",
    },
  });
  await audit(admin.id, "TICKET_CREATE", "Ticket", t.id, "admin");
  revalidatePath("/admin/tickets");
}
