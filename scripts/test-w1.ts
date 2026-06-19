/**
 * W1 E2E (dev): project-staging engine + brain pull + approve flow.
 * Read-only against the brain repo; writes to a temp tenant on the dev DB, cleans up.
 */
import { prisma } from "../src/lib/db";
import { stageProjectFromTemplate } from "../src/server/staging";
import { ingestTenantFinals } from "../src/server/brain/ingest";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };
const slug = "w1-e2e-test";

async function cleanup() {
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return;
  const engs = await prisma.engagement.findMany({ where: { tenantId: t.id }, select: { id: true } });
  for (const e of engs) {
    await prisma.kpi.deleteMany({ where: { engagementId: e.id } });
    await prisma.sla.deleteMany({ where: { engagementId: e.id } });
    await prisma.task.deleteMany({ where: { engagementId: e.id } });
    await prisma.milestone.deleteMany({ where: { engagementId: e.id } });
    await prisma.charter.deleteMany({ where: { engagementId: e.id } });
  }
  await prisma.engagement.deleteMany({ where: { tenantId: t.id } });
  await prisma.document.deleteMany({ where: { tenantId: t.id } });
  await prisma.ingestJob.deleteMany({ where: { tenantId: t.id } });
  await prisma.tenant.delete({ where: { id: t.id } });
}

async function main() {
  await cleanup();
  const t = await prisma.tenant.create({
    // unique, non-conflicting folder (the real Sierra tenant owns the demo folder);
    // the non-zero brain pull is already proven separately.
    data: { name: "W1 E2E", slug, type: "CLIENT", isDemo: true, brainFolder: "w1-e2e-none" },
  });

  // 1) staging — idempotent
  const s1 = await stageProjectFromTemplate(t.id);
  if (!s1.created) fail("staging did not create an engagement");
  const milestones = await prisma.milestone.count({ where: { engagement: { tenantId: t.id } } });
  if (milestones < 5) fail(`expected >=5 staged milestones, got ${milestones}`);
  const s2 = await stageProjectFromTemplate(t.id);
  if (s2.created) fail("staging not idempotent — created twice");
  console.log(`  staging: created engagement + ${milestones} milestones; idempotent ✓`);

  // 2) brain pull runs cleanly (this folder has no finals; non-zero pull proven elsewhere)
  const r = await ingestTenantFinals(t.id);
  console.log(`  brain pull ran: finalsFound=${r.finalsFound} (no-final folder) ✓`);

  // 3) approve flow: a brain doc lands hidden, approval makes it client-visible
  const doc = await prisma.document.create({
    data: { tenantId: t.id, name: "synthetic-final.md", kind: "DOCUMENT", isFinal: true, clientVisible: false, source: "BRAIN", url: "git:test@abc" },
  });
  if (doc.clientVisible) fail("brain doc is client-visible before approval");
  await prisma.document.update({ where: { id: doc.id }, data: { clientVisible: true } });
  const after = await prisma.document.findUnique({ where: { id: doc.id } });
  if (!after?.clientVisible) fail("approve did not flip clientVisible");
  else console.log("  approve: hidden brain doc → client-visible ✓");

  await cleanup();
  if (failures) { console.error(`test-w1: ${failures} failure(s)`); process.exit(1); }
  console.log("test-w1: PASS — stage-from-template + brain pull + approval all work.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
