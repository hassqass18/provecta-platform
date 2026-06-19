/** W2 (dev): snapshot recompute + projection includes live RAG. */
import { prisma } from "../src/lib/db";
import { recomputeSnapshot, getSnapshot } from "../src/server/dashboards/metrics";
import { getClientDashboardProjection } from "../src/server/data";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };

async function main() {
  const eng = await prisma.engagement.findFirst({ where: { tenant: { name: { contains: "Sierra" } } }, include: { tenant: true } });
  if (!eng) { console.log("no Sierra engagement; skipping"); return; }

  const snap = await recomputeSnapshot(eng.id);
  if (!["GREEN", "AMBER", "RED"].includes(snap.ragOverall)) fail(`bad ragOverall ${snap.ragOverall}`);
  if (snap.milestonesTotal < 1) fail("snapshot milestonesTotal should be > 0 for Sierra");
  const fetched = await getSnapshot(eng.id);
  if (fetched?.engagementId !== eng.id) fail("getSnapshot did not return the row");
  console.log(`  snapshot: RAG=${snap.ragOverall} milestones=${snap.milestonesComplete}/${snap.milestonesTotal} slaPct=${snap.slaAttainmentPct} openTickets=${snap.openTickets} ✓`);

  const proj = await getClientDashboardProjection(eng.tenantId);
  if (!proj.engagement?.snapshot?.ragOverall) fail("projection missing engagement.snapshot.ragOverall");
  else console.log(`  projection snapshot: RAG=${proj.engagement.snapshot.ragOverall} ✓`);

  if (failures) { console.error(`test-w2: ${failures} failure(s)`); process.exit(1); }
  console.log("test-w2: PASS — snapshot recompute + live projection RAG.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
