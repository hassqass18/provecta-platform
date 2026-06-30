"use server";

import { redirect } from "next/navigation";
import { verify, hash } from "@node-rs/argon2";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";

// Self-service password change for the signed-in user from the web portal
// (cookie session). Mirrors POST /api/app/settings/password (mobile bearer).
export async function changePasswordAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (next.length < 8) redirect("/portal?pw=short");
  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!u) redirect("/portal?pw=err");
  const ok = await verify(u.passwordHash, current).catch(() => false);
  if (!ok) redirect("/portal?pw=wrong");
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hash(next) } });
  await prisma.auditLog.create({ data: { actorId: me.id, action: "PASSWORD_CHANGED", entity: "User", entityId: me.id } }).catch(() => {});
  redirect("/portal?pw=ok");
}
