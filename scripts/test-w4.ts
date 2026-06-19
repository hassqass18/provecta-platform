/** W4 (dev): tamper-evident audit chain — seal, verify, detect tamper, restore. */
import { prisma } from "../src/lib/db";
import { sealAuditChain, verifyAuditChain } from "../src/lib/audit-chain";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };

async function main() {
  await prisma.auditLog.create({ data: { action: "W4_TEST", entity: "Test", entityId: "w4", meta: "orig" } });
  const s = await sealAuditChain();
  console.log(`  sealed ${s.sealed} new audit event(s)`);

  let v = await verifyAuditChain();
  if (!v.ok) fail(`chain not ok after seal (broke at ${v.brokenAtSeq})`);
  else console.log(`  verify after seal: OK (${v.sealed} sealed) ✓`);

  const row = await prisma.auditLog.findFirst({ where: { action: "W4_TEST" }, orderBy: { seq: "desc" } });
  if (!row) { fail("test row missing"); }
  else {
    await prisma.auditLog.update({ where: { id: row.id }, data: { meta: "TAMPERED" } });
    v = await verifyAuditChain();
    if (v.ok) fail("tamper NOT detected");
    else console.log(`  tamper detected at seq ${v.brokenAtSeq} ✓`);
    await prisma.auditLog.update({ where: { id: row.id }, data: { meta: "orig" } });
    v = await verifyAuditChain();
    if (!v.ok) fail("restore did not re-validate the chain");
    else console.log("  restore → chain valid again ✓");
  }

  if (failures) { console.error(`test-w4: ${failures} failure(s)`); process.exit(1); }
  console.log("test-w4: PASS — audit chain seals + verifies + detects tampering.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
