import { NextResponse } from "next/server";
import { z } from "zod";
import { verify, hash } from "@node-rs/argon2";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Self-service password change for any signed-in user (client or staff): verify
// the current password, then set the new one. Used from the dashboard so a
// client can replace their temporary password.
const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Your new password must be at least 8 characters." }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!dbUser) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ok = await verify(dbUser.passwordHash, currentPassword).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(newPassword) } });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
