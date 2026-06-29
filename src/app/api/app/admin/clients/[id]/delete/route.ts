import { NextResponse } from "next/server";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { deleteTenant } from "@/server/tenant/delete";

// Hard-delete a client/prospect and its entire object graph (SUPER_ADMIN only).
// Irreversible. id = tenant id.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only a super-admin can delete a client." }, { status: 403 });
  const { id } = await params;

  const r = await deleteTenant(id);
  if (!r.ok) return NextResponse.json({ error: r.error ?? "delete failed" }, { status: 400 });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "CLIENT_DELETE", entity: "Tenant", entityId: id, meta: r.name } }).catch(() => {});
  return NextResponse.json({ ok: true, name: r.name });
}
