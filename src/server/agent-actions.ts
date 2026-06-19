"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { recordApproval } from "@/lib/autonomy";

// Approve a proposed AgentRun → execute + advance the autonomy ramp for its category.
export async function approveRun(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const run = await prisma.agentRun.findUnique({ where: { id } });
  if (!run || run.status !== "AWAITING_REVIEW") return;
  await prisma.agentRun.update({ where: { id }, data: { status: "DONE" } });
  await recordApproval(run.actionCategory); // advances SUGGEST→AUTO_WITH_REVIEW→AUTONOMOUS (reversible only)
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "AGENT_RUN_APPROVE", entity: "AgentRun", entityId: id, meta: run.actionCategory } });
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/autonomy");
}

export async function rejectRun(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const run = await prisma.agentRun.findUnique({ where: { id } });
  if (!run || run.status !== "AWAITING_REVIEW") return;
  await prisma.agentRun.update({ where: { id }, data: { status: "REJECTED" } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "AGENT_RUN_REJECT", entity: "AgentRun", entityId: id, meta: run.actionCategory } });
  revalidatePath("/admin/approvals");
}
