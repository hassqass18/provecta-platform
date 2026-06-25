import { prisma } from "@/lib/db";
import { sendComm } from "@/server/comms/send";
import { sendPushToUsers } from "@/server/notifications/push";
import { notifyTenantClients } from "@/server/notifications/fanout";
import { emitEvent } from "@/lib/events/emit";

/**
 * Collaboration: comments + approvals on milestones / deliverables / documents.
 * Clients act from the app; staff act from the admin cockpit; every action
 * mirrors to the Communication ledger + the other side's notifications so the
 * client dashboard and the super-admin back office stay in lockstep.
 */

export type TargetType = "MILESTONE" | "DELIVERABLE" | "DOCUMENT" | "ENGAGEMENT";
export type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

// The Communication ledger speaks AGENT | HUMAN | CLIENT; staff map to HUMAN.
function commActor(t: "CLIENT" | "STAFF" | "AGENT"): "CLIENT" | "HUMAN" | "AGENT" {
  return t === "STAFF" ? "HUMAN" : t;
}

export type TargetRef = { tenantId: string; engagementId: string | null; label: string };

// Resolve the owning tenant + engagement (+ a human label) for any target.
export async function resolveTarget(targetType: string, targetId: string): Promise<TargetRef | null> {
  if (targetType === "MILESTONE") {
    const m = await prisma.milestone.findUnique({ where: { id: targetId }, include: { engagement: true } });
    if (!m) return null;
    return { tenantId: m.engagement.tenantId, engagementId: m.engagementId, label: m.title };
  }
  if (targetType === "DELIVERABLE") {
    const d = await prisma.deliverable.findUnique({ where: { id: targetId }, include: { engagement: true } });
    if (!d) return null;
    return { tenantId: d.engagement.tenantId, engagementId: d.engagementId, label: d.title };
  }
  if (targetType === "DOCUMENT") {
    const doc = await prisma.document.findUnique({ where: { id: targetId } });
    if (!doc) return null;
    return { tenantId: doc.tenantId, engagementId: doc.engagementId ?? null, label: doc.name };
  }
  if (targetType === "ENGAGEMENT") {
    const e = await prisma.engagement.findUnique({ where: { id: targetId } });
    if (!e) return null;
    return { tenantId: e.tenantId, engagementId: e.id, label: e.name };
  }
  return null;
}

export async function listComments(targetType: string, targetId: string) {
  const rows = await prisma.comment.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map((c) => ({
    id: c.id,
    authorType: c.authorType,
    authorName: c.authorName,
    body: c.body,
    createdAt: c.createdAt,
  }));
}

// Notify all internal (admin/staff) users in-app + via push — the back-office side.
export async function notifyAdmins(type: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({ data: admins.map((u) => ({ userId: u.id, type, body })) });
  await sendPushToUsers(admins.map((u) => u.id), { title: "Provecta · client action", body, data: data ?? { screen: "admin" } });
}

export async function postComment(input: {
  targetType: TargetType;
  targetId: string;
  authorType: "CLIENT" | "STAFF" | "AGENT";
  authorId?: string | null;
  authorName?: string | null;
  body: string;
}) {
  const ref = await resolveTarget(input.targetType, input.targetId);
  if (!ref) throw new Error("target not found");

  const comment = await prisma.comment.create({
    data: {
      tenantId: ref.tenantId,
      engagementId: ref.engagementId,
      targetType: input.targetType,
      targetId: input.targetId,
      authorType: input.authorType,
      authorId: input.authorId ?? null,
      authorName: input.authorName ?? null,
      body: input.body,
    },
  });

  // Mirror onto the Communication ledger and notify the other side.
  await sendComm({
    tenantId: ref.tenantId,
    engagementId: ref.engagementId,
    channel: "APP",
    actorType: commActor(input.authorType),
    body: `💬 ${ref.label}: ${input.body}`,
    direction: input.authorType === "CLIENT" ? "IN" : "OUT",
  });

  if (input.authorType === "CLIENT") {
    await notifyAdmins("CLIENT_COMMENT", `${input.authorName ?? "Client"} commented on “${ref.label}”: ${input.body}`, { screen: "admin" });
  } else {
    await notifyTenantClients(ref.tenantId, "REPLY", `Provecta commented on “${ref.label}”`);
  }

  return { comment, ref };
}

export async function postApproval(input: {
  targetType: "MILESTONE" | "DELIVERABLE";
  targetId: string;
  decision: Decision;
  note?: string | null;
  actorType: "CLIENT" | "STAFF";
  actorId?: string | null;
  actorName?: string | null;
}) {
  const ref = await resolveTarget(input.targetType, input.targetId);
  if (!ref) throw new Error("target not found");

  const status = input.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED";

  await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        tenantId: ref.tenantId,
        engagementId: ref.engagementId,
        targetType: input.targetType,
        targetId: input.targetId,
        decision: input.decision,
        note: input.note ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
      },
    });
    if (input.targetType === "MILESTONE") {
      await tx.milestone.update({ where: { id: input.targetId }, data: { approvalStatus: status } });
    } else {
      await tx.deliverable.update({ where: { id: input.targetId }, data: { approvalStatus: status } });
    }
  });

  const verb =
    input.decision === "APPROVED" ? "approved" : input.decision === "REJECTED" ? "rejected" : "requested changes on";
  const line = `${input.actorName ?? (input.actorType === "CLIENT" ? "Client" : "Provecta")} ${verb} “${ref.label}”${input.note ? `: ${input.note}` : ""}`;

  await sendComm({
    tenantId: ref.tenantId,
    engagementId: ref.engagementId,
    channel: "APP",
    actorType: commActor(input.actorType),
    body: `✅ ${line}`,
    direction: input.actorType === "CLIENT" ? "IN" : "OUT",
  });

  if (input.actorType === "CLIENT") {
    await notifyAdmins("CLIENT_APPROVAL", line, { screen: "admin" });
    await emitEvent("CLIENT_APPROVAL", input.targetType, input.targetId, { decision: input.decision, tenantId: ref.tenantId });
  } else {
    await notifyTenantClients(ref.tenantId, "UPDATE", line);
  }

  return { status, ref };
}
