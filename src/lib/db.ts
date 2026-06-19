import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRls?: PrismaClient;
};

// Default client — connects as neondb_owner, which has the BYPASSRLS attribute.
// Admin / auth / crud / cross-tenant firm views use this; RLS never restricts it.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// RLS-enforcing client — connects as the non-BYPASSRLS `app_rls` role. Only the
// client-facing read path uses this (via dbForTenant). Absent RLS_DATABASE_URL,
// we fall back to the base client: isolation then relies on the app-layer
// tenant filter already present in the projection (keyless-safe, no enforcement).
function rlsBase(): PrismaClient | null {
  // Defensive: strip stray surrounding quotes/whitespace that can sneak into the
  // env value (e.g. when copied from a quoted .env) — Prisma rejects a URL that
  // doesn't start with postgresql://.
  const url = process.env.RLS_DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!url) return null;
  const client =
    globalForPrisma.prismaRls ??
    new PrismaClient({
      datasources: { db: { url } },
      log: ["error"],
    });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prismaRls = client;
  return client;
}

/**
 * Tenant-scoped Prisma client. Every operation runs inside a transaction that
 * first sets the transaction-local GUC `app.current_org`, so Postgres RLS
 * policies resolve to this tenant's rows only. Read paths for the client portal
 * MUST use this rather than the bypass `prisma` client.
 */
export function dbForTenant(tenantId: string) {
  const base = rlsBase() ?? prisma;
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.current_org', ${tenantId}, true)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  });
}
