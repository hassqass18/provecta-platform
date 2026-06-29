import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Mobile bearer-token auth for the native client app (`/api/app/*`).
 *
 * The web app uses Auth.js cookie sessions; a native client can't carry those
 * cleanly, so the app authenticates once (email + password, argon2-verified)
 * and receives a compact signed token it stores in `expo-secure-store` and
 * sends as `Authorization: Bearer <token>`.
 *
 * The token is a self-contained HMAC-SHA256 JWS (HS256) over `AUTH_SECRET` —
 * no new dependency, same secret as the web session. It carries only the user
 * id + a 30-day expiry; every request re-loads the user (and tenant) from the
 * DB, so role/tenant changes take effect immediately and a token can't outlive
 * the user. Reads still go through the RLS (`dbForTenant`) path downstream.
 */

const ALG = "HS256";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set — cannot sign mobile tokens");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

export type AppTokenPayload = { sub: string; iat: number; exp: number };

export function signAppToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: ALG, typ: "JWT" });
  const body = b64urlJson({ sub: userId, iat: now, exp: now + TTL_SECONDS });
  const data = `${header}.${body}`;
  return `${data}.${sign(data)}`;
}

export function verifyAppToken(token: string): AppTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = sign(`${header}.${body}`);
  // constant-time signature compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString()) as AppTokenPayload;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
};

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STAFF"]);
export function isAppAdmin(user: AppUser | null): boolean {
  return !!user && ADMIN_ROLES.has(user.role);
}
export function isSuperAdmin(user: AppUser | null): boolean {
  return !!user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");
}

/** Resolve an app user and require an admin/staff role (for /api/app/admin/*). */
export async function getAdminAppUser(req: Request): Promise<AppUser | null> {
  const user = await getAppUser(req);
  return isAppAdmin(user) ? user : null;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, value] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

/**
 * Resolve the authenticated app user from the request's bearer token.
 * Returns null when the token is missing/invalid/expired or the user is gone.
 */
export async function getAppUser(req: Request): Promise<AppUser | null> {
  const token = bearer(req);
  if (!token) return null;
  const payload = verifyAppToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!user || user.disabled) return null; // blocked users are rejected immediately (every request re-loads)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId ?? null,
    tenantName: user.tenant?.name ?? null,
  };
}
