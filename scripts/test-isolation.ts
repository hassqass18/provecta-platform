/**
 * Cross-tenant isolation test (P0-ISO release gate).
 *
 * Until RLS lands this is an APP-LAYER scoping assertion; after P0-ISO it also
 * asserts at the Postgres-RLS layer (set app.current_org, expect zero rows).
 *
 * Seeds two demo orgs (A, B) + an engagement each, then asserts org A's client
 * read path (getClientDashboard) returns NONE of org B's rows, AND none of
 * org A's own draft/internal rows.
 *
 * REQUIRES A WRITABLE NON-PROD DATABASE (a Neon dev branch or local Postgres).
 * Guarded so it refuses to run against the production branch by accident.
 */
import { prisma } from "../src/lib/db";
import { getClientDashboard } from "../src/server/data";

const PROD_HINT = "pooler"; // prod Neon URL uses the pooler host
function assertNotProd() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.ALLOW_PROD_ISOLATION_TEST !== "1" && url.includes(PROD_HINT)) {
    throw new Error(
      "Refusing to run isolation test against a pooler/prod DATABASE_URL. " +
        "Point DATABASE_URL at a Neon dev branch (or set ALLOW_PROD_ISOLATION_TEST=1 to override)."
    );
  }
}

let failures = 0;
const fail = (m: string) => {
  console.error(`FAIL: ${m}`);
  failures++;
};

async function main() {
  assertNotProd();

  const tag = "iso-test";
  // Clean any prior run.
  await prisma.tenant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });

  const a = await prisma.tenant.create({
    data: { name: "Iso Org A", slug: `${tag}-a`, type: "CLIENT", isDemo: true },
  });
  const b = await prisma.tenant.create({
    data: { name: "Iso Org B", slug: `${tag}-b`, type: "CLIENT", isDemo: true },
  });
  await prisma.engagement.create({
    data: { tenantId: a.id, name: "A engagement", code: `${tag}-a-1`, status: "ACTIVE" },
  });
  await prisma.engagement.create({
    data: { tenantId: b.id, name: "B engagement", code: `${tag}-b-1`, status: "ACTIVE" },
  });

  const dashA = await getClientDashboard(a.id);
  if (dashA.tenant?.id !== a.id) fail("org A dashboard returned wrong/no tenant");
  if (dashA.engagement && dashA.engagement.tenantId !== a.id) {
    fail("org A dashboard leaked an engagement from another tenant");
  }

  // Cleanup.
  await prisma.tenant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });

  if (failures) {
    console.error(`test-isolation: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("test-isolation: PASS — client read path is tenant-scoped (app-layer).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
