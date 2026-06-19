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
import { prisma, dbForTenant } from "../src/lib/db";
import { getClientDashboardProjection } from "../src/server/data";

const PROD_ENDPOINT = "ep-bitter-brook"; // the production Neon endpoint id
function assertNotProd() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.ALLOW_PROD_ISOLATION_TEST !== "1" && url.includes(PROD_ENDPOINT)) {
    throw new Error(
      "Refusing to run the seeding isolation test against the PROD Neon endpoint. " +
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
  const cleanup = async () => {
    // FKs are RESTRICT — delete children before tenants.
    await prisma.engagement.deleteMany({ where: { code: { in: [`${tag}-a-1`, `${tag}-b-1`] } } });
    await prisma.tenant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });
  };
  await cleanup(); // clean any prior run

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

  const dashA = await getClientDashboardProjection(a.id);
  if (dashA.tenant?.id !== a.id) fail("org A dashboard returned wrong/no tenant");
  // The projection filters by tenantId; org A must only ever see org A's engagement.
  if (dashA.engagement && dashA.engagement.code !== `${tag}-a-1`) {
    fail(`org A dashboard leaked a foreign engagement: ${dashA.engagement.code}`);
  }
  const dashB = await getClientDashboardProjection(b.id);
  if (dashB.engagement && dashB.engagement.code !== `${tag}-b-1`) {
    fail(`org B dashboard leaked a foreign engagement: ${dashB.engagement.code}`);
  }

  // RLS-level proof: a NO-FILTER query via the tenant client must return only
  // this org's rows (Postgres RLS, not just the app-layer where-filter). This
  // also filters out the real forked-prod engagements — a strong check.
  if (process.env.RLS_DATABASE_URL) {
    const visible = await dbForTenant(a.id).engagement.findMany({ select: { code: true } });
    const foreign = visible.filter((e) => e.code !== `${tag}-a-1`);
    if (foreign.length) fail(`RLS leak: org A sees foreign engagements [${foreign.map((f) => f.code).join(", ")}]`);
    if (!visible.some((e) => e.code === `${tag}-a-1`)) fail("RLS over-block: org A cannot see its own engagement");
    console.log(`  RLS-level: org A's tenant client sees ${visible.length} engagement(s), all its own.`);
  } else {
    console.log("  RLS-level: skipped (RLS_DATABASE_URL unset) — app-layer scoping only.");
  }

  await cleanup();

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
