import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { resolveTarget, postApproval } from "@/server/collab";
import { notifyTenantClients } from "@/server/notifications/fanout";

const schema = z.object({
  targetType: z.enum(["MILESTONE", "DELIVERABLE"]),
  targetId: z.string().min(1),
  action: z.enum(["REQUEST_APPROVAL", "MARK_COMPLETE", "APPROVE"]),
});

// Admin moves a milestone/deliverable: ask the client to sign off, mark a phase
// complete, or approve on the client's behalf. All notify the client.
export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const { targetType, targetId, action } = parsed.data;

  const ref = await resolveTarget(targetType, targetId);
  if (!ref) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "APPROVE") {
    const { status } = await postApproval({
      targetType, targetId, decision: "APPROVED",
      actorType: "STAFF", actorId: admin.id, actorName: admin.name ?? "Provecta",
    });
    return NextResponse.json({ ok: true, approvalStatus: status });
  }

  if (action === "REQUEST_APPROVAL") {
    if (targetType === "MILESTONE") await prisma.milestone.update({ where: { id: targetId }, data: { approvalStatus: "PENDING" } });
    else await prisma.deliverable.update({ where: { id: targetId }, data: { approvalStatus: "PENDING" } });
    await notifyTenantClients(ref.tenantId, "UPDATE", `Provecta requested your approval on “${ref.label}”`);
    return NextResponse.json({ ok: true, approvalStatus: "PENDING" });
  }

  // MARK_COMPLETE
  if (targetType === "MILESTONE") await prisma.milestone.update({ where: { id: targetId }, data: { status: "COMPLETED", completedAt: new Date() } });
  else await prisma.deliverable.update({ where: { id: targetId }, data: { status: "DELIVERED" } });
  await notifyTenantClients(ref.tenantId, "UPDATE", `“${ref.label}” marked complete by Provecta`);
  return NextResponse.json({ ok: true });
}
