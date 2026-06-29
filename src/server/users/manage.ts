import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";

/**
 * Super-admin user controls (shared by the web server actions + mobile API).
 * Reset a user's password (returns a one-time temp password to share) and
 * block / unblock a user (disabled users can't log in and are rejected on every
 * request — see app-auth.getAppUser + auth.authorize).
 */

export async function resetUserPassword(userId: string): Promise<{ ok: boolean; email?: string; password?: string; error?: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!u) return { ok: false, error: "not found" };
  const password = `Provecta-${randomBytes(5).toString("hex")}`;
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(password) } });
  return { ok: true, email: u.email, password };
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<{ ok: boolean; disabled?: boolean; error?: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!u) return { ok: false, error: "not found" };
  await prisma.user.update({ where: { id: userId }, data: { disabled: blocked, disabledAt: blocked ? new Date() : null } });
  return { ok: true, disabled: blocked };
}
