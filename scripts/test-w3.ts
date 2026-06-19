/** W3 (dev): event spine → agent run gate, + honesty-gated client comms. */
import { prisma } from "../src/lib/db";
import { emitEvent } from "../src/lib/events/emit";
import { processEvent } from "../src/server/agent/runner";
import { seedAutonomyPolicies } from "../src/server/autonomy/seed";
import { emitClientUpdate } from "../src/server/notifications/fanout";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };
const MARK = "w3-e2e-marker";

async function main() {
  await seedAutonomyPolicies();

  // 1) event spine → agent run, gated to AWAITING_REVIEW (milestone-notification is
  //    REVERSIBLE + state SUGGEST → cannot auto-execute yet).
  await emitEvent("MILESTONE_COMPLETED", "Milestone", "test-w3-evt", { title: "t" });
  const ev = await prisma.domainEvent.findFirst({ where: { entityId: "test-w3-evt" }, orderBy: { createdAt: "desc" } });
  if (!ev) { fail("emitEvent did not create a DomainEvent"); }
  else {
    const r = await processEvent({ id: ev.id, type: ev.type, entity: ev.entity, entityId: ev.entityId, payload: ev.payload });
    if (r.status !== "AWAITING_REVIEW") fail(`expected AWAITING_REVIEW, got ${r.status}`);
    const steps = await prisma.agentStep.count({ where: { runId: r.runId } });
    // planner + critic always; executor only on auto-execute (not this gated path)
    if (steps < 2) fail(`expected >=2 steps (planner+critic), got ${steps}`);
    console.log(`  agent loop: run ${r.status} with ${steps} steps (planner+critic; gated, no executor) ✓`);
    // cleanup
    await prisma.agentStep.deleteMany({ where: { runId: r.runId } });
    await prisma.agentRun.delete({ where: { id: r.runId } });
    await prisma.domainEvent.delete({ where: { id: ev.id } });
  }

  // 2) honesty say-gate: unbacked money claim is blocked
  const tenant = await prisma.tenant.findFirst({ where: { name: { contains: "Sierra" } } });
  if (tenant) {
    const blocked = await emitClientUpdate({ tenantId: tenant.id, body: `${MARK} payment received`, claim: "PAYMENT_RECEIVED", backing: null });
    if (blocked.ok) fail("unbacked PAYMENT_RECEIVED was NOT blocked");
    else console.log(`  honesty: unbacked payment claim blocked (${blocked.reason}) ✓`);

    const allowed = await emitClientUpdate({ tenantId: tenant.id, body: `${MARK} milestone done`, claim: "MILESTONE_COMPLETE", backing: { milestoneStatus: "COMPLETED" } });
    if (!allowed.ok) fail("backed MILESTONE_COMPLETE was blocked");
    const comm = await prisma.communication.findFirst({ where: { tenantId: tenant.id, body: { contains: MARK } } });
    if (!comm) fail("backed client update did not write a Communication row");
    else console.log("  honesty: backed update logged on Communication ledger ✓");
    await prisma.communication.deleteMany({ where: { body: { contains: MARK } } });
  }

  if (failures) { console.error(`test-w3: ${failures} failure(s)`); process.exit(1); }
  console.log("test-w3: PASS — event→agent-run gate + honesty-gated comms ledger.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
