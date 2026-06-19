import { createHash } from "node:crypto";
import { prisma } from "./db";

// P4D — tamper-evident audit chain. Each sealed AuditLog row carries a hash of
// (prevHash + its canonical fields); verify recomputes the chain and reports the
// first break. Sealing runs from the reconcile cron so the chain advances without
// touching every audit() write site.

type SealableRow = { id: string; action: string; entity: string; entityId: string | null; meta: string | null; createdAt: Date };

function hashRow(prev: string, r: SealableRow): string {
  return createHash("sha256")
    .update(`${prev}|${r.id}|${r.action}|${r.entity}|${r.entityId ?? ""}|${r.meta ?? ""}|${r.createdAt.toISOString()}`)
    .digest("hex");
}

export async function sealAuditChain(): Promise<{ sealed: number }> {
  const last = await prisma.auditLog.findFirst({ where: { hash: { not: null } }, orderBy: { seq: "desc" } });
  let prev = last?.hash ?? "GENESIS";
  let seq = last?.seq ?? 0;
  const unsealed = await prisma.auditLog.findMany({ where: { hash: null }, orderBy: { createdAt: "asc" } });
  for (const r of unsealed) {
    const h = hashRow(prev, r);
    seq += 1;
    await prisma.auditLog.update({ where: { id: r.id }, data: { hash: h, prevHash: prev, seq } });
    prev = h;
  }
  return { sealed: unsealed.length };
}

export async function verifyAuditChain(): Promise<{ ok: boolean; sealed: number; brokenAtSeq?: number }> {
  const rows = await prisma.auditLog.findMany({ where: { hash: { not: null } }, orderBy: { seq: "asc" } });
  let prev = "GENESIS";
  for (const r of rows) {
    const expect = hashRow(prev, r);
    if (r.prevHash !== prev || r.hash !== expect) return { ok: false, sealed: rows.length, brokenAtSeq: r.seq ?? undefined };
    prev = r.hash as string;
  }
  return { ok: true, sealed: rows.length };
}
