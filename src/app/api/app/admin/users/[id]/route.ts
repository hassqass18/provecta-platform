import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { resetUserPassword, setUserBlocked } from "@/server/users/manage";

// Super-admin user controls (mobile/API): reset password, block, unblock.
// Can't block yourself. id = user id.
const schema = z.object({ action: z.enum(["RESET_PASSWORD", "BLOCK", "UNBLOCK"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only an admin can manage users." }, { status: 403 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const { action } = parsed.data;

  if (action !== "UNBLOCK" && id === admin.id && action === "BLOCK") {
    return NextResponse.json({ error: "You can't block your own account." }, { status: 400 });
  }

  if (action === "RESET_PASSWORD") {
    const r = await resetUserPassword(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "USER_PASSWORD_RESET", entity: "User", entityId: id } }).catch(() => {});
    return NextResponse.json({ ok: true, email: r.email, password: r.password });
  }
  const blocked = action === "BLOCK";
  const r = await setUserBlocked(id, blocked);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: blocked ? "USER_BLOCKED" : "USER_UNBLOCKED", entity: "User", entityId: id } }).catch(() => {});
  return NextResponse.json({ ok: true, disabled: blocked });
}
