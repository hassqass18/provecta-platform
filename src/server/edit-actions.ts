"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Local copies of the small form helpers (the crud.ts ones are private/not exported).
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dateOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(v) : null;
};
const dollarsToMinor = (fd: FormData, k: string) => Math.round((Number(fd.get(k)) || 0) * 100);
const numOrNull = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v !== null && String(v).trim() !== "" ? Number(v) : null;
};

async function audit(actorId: string, action: string, entity: string, entityId?: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}

const refresh = (engagementId: string) => revalidatePath(`/admin/engagements/${engagementId}`);

// ── Engagement (full edit incl. dates, currency, status) ──────────────────
export async function editEngagementFull(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (!id) return;
  await prisma.engagement.update({
    where: { id },
    data: {
      name: str(fd, "name") || undefined,
      summary: str(fd, "summary") || null,
      currency: str(fd, "currency") || undefined,
      budgetMinor: dollarsToMinor(fd, "budget"),
      startDate: dateOrNull(fd, "startDate"),
      targetEndDate: dateOrNull(fd, "targetEndDate"),
      status: str(fd, "status") || undefined,
    },
  });
  await audit(admin.id, "ENGAGEMENT_EDIT_FULL", "Engagement", id);
  refresh(id);
}

// ── Charter (upsert by engagementId) ──────────────────────────────────────
export async function upsertCharter(fd: FormData) {
  const admin = await requireAdmin();
  const engagementId = str(fd, "engagementId");
  if (!engagementId) return;
  const data = {
    objectives: str(fd, "objectives") || null,
    scope: str(fd, "scope") || null,
    outOfScope: str(fd, "outOfScope") || null,
    sponsor: str(fd, "sponsor") || null,
    successCriteria: str(fd, "successCriteria") || null,
  };
  await prisma.charter.upsert({
    where: { engagementId },
    update: data,
    create: { engagementId, ...data },
  });
  await audit(admin.id, "CHARTER_UPSERT", "Charter", engagementId);
  refresh(engagementId);
}

// ── Milestones ────────────────────────────────────────────────────────────
export async function editMilestone(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.milestone.update({
    where: { id },
    data: {
      title: str(fd, "title") || undefined,
      description: str(fd, "description") || null,
      status: str(fd, "status") || undefined,
      dueDate: dateOrNull(fd, "dueDate"),
      clientVisible: fd.get("clientVisible") !== null,
    },
  });
  await audit(admin.id, "MILESTONE_EDIT", "Milestone", id);
  refresh(engagementId);
}

export async function deleteMilestone(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  // FKs are RESTRICT: detach tasks before deleting the milestone.
  await prisma.task.updateMany({ where: { milestoneId: id }, data: { milestoneId: null } });
  await prisma.milestone.delete({ where: { id } });
  await audit(admin.id, "MILESTONE_DELETE", "Milestone", id);
  refresh(engagementId);
}

// ── KPIs ──────────────────────────────────────────────────────────────────
export async function editKpi(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.kpi.update({
    where: { id },
    data: {
      label: str(fd, "label") || undefined,
      value: Number(fd.get("value")) || 0,
      unit: str(fd, "unit") || null,
      target: numOrNull(fd, "target"),
    },
  });
  await audit(admin.id, "KPI_EDIT", "Kpi", id);
  refresh(engagementId);
}

export async function deleteKpi(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.kpi.delete({ where: { id } });
  await audit(admin.id, "KPI_DELETE", "Kpi", id);
  refresh(engagementId);
}

// ── SLAs ──────────────────────────────────────────────────────────────────
export async function editSla(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.sla.update({
    where: { id },
    data: {
      metric: str(fd, "metric") || undefined,
      target: str(fd, "target") || "—",
      actual: str(fd, "actual") || null,
      status: str(fd, "status") || undefined,
    },
  });
  await audit(admin.id, "SLA_EDIT", "Sla", id);
  refresh(engagementId);
}

export async function deleteSla(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.sla.delete({ where: { id } });
  await audit(admin.id, "SLA_DELETE", "Sla", id);
  refresh(engagementId);
}

// ── Tasks ─────────────────────────────────────────────────────────────────
export async function editTask(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.task.update({
    where: { id },
    data: {
      title: str(fd, "title") || undefined,
      status: str(fd, "status") || undefined,
      priority: str(fd, "priority") || undefined,
    },
  });
  await audit(admin.id, "TASK_EDIT", "Task", id);
  refresh(engagementId);
}

export async function deleteTask(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const engagementId = str(fd, "engagementId");
  if (!id || !engagementId) return;
  await prisma.task.delete({ where: { id } });
  await audit(admin.id, "TASK_DELETE", "Task", id);
  refresh(engagementId);
}
