"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { recordApproval } from "@/lib/autonomy";
import { sendOnChannel } from "@/server/comms/transport";
import { sendComm } from "@/server/comms/send";

// Approve a proposed AgentRun → execute + advance the autonomy ramp for its category.
export async function approveRun(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const run = await prisma.agentRun.findUnique({ where: { id } });
  if (!run || run.status !== "AWAITING_REVIEW") return;

  // Client-reply runs carry a drafted reply — approving SENDS it (transport gated)
  // and logs it on the Communication ledger.
  if (run.actionCategory === "client-reply" && run.outputJson) {
    const o = run.outputJson as { reply?: string; channel?: string; address?: string; tenantId?: string; engagementId?: string | null };
    if (o.reply && o.channel && o.address && o.tenantId) {
      await sendOnChannel(o.channel, o.address, o.reply); // gated transport
      await sendComm({ tenantId: o.tenantId, engagementId: o.engagementId ?? null, channel: o.channel, actorType: "AGENT", body: o.reply, direction: "OUT" });
    }
  }

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
