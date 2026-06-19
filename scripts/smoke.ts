/**
 * Post-deploy smoke harness (run against the LIVE url after `vercel deploy --prod`).
 *   SMOKE_URL=https://pgco.world tsx scripts/smoke.ts
 * Slices append their own live assertions over time.
 */
const BASE = process.env.SMOKE_URL ?? "https://www.pgco.world"; // canonical host (apex 307s to www)

let failures = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  console.error(`  FAIL ${m}`);
  failures++;
};

async function expectStatus(path: string, want: number, init?: RequestInit) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...init });
    if (res.status === want) ok(`${path} → ${res.status}`);
    else bad(`${path} → ${res.status} (want ${want})`);
  } catch (e) {
    bad(`${path} → threw ${(e as Error).message}`);
  }
}

async function main() {
  console.log(`smoke: ${BASE}`);
  await expectStatus("/", 200);
  await expectStatus("/login", 200);
  // Cron + ingest endpoints must reject unauthenticated callers.
  await expectStatus("/api/cron/agent-tick", 401);
  await expectStatus("/api/cron/reconcile", 401);

  if (failures) {
    console.error(`smoke: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("smoke: PASS");
}

main();
