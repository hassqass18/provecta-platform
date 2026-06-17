import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "./rbac";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  tenantId?: string | null;
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as Record<string, unknown>;
  return {
    id: String(u.id ?? ""),
    email: String(u.email ?? ""),
    name: (u.name as string | null) ?? null,
    role: String(u.role ?? "CLIENT"),
    tenantId: (u.tenantId as string | null) ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (!isAdmin(u.role)) redirect("/portal");
  return u;
}
