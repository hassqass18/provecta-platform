import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";
import { sealAuditChain, verifyAuditChain } from "@/lib/audit-chain";

// Reconciliation (daily, Hobby-safe native cron): seal the tamper-evident audit
// chain (P4D) and report its integrity. Snapshot/ledger reconciliation hooks here too.
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  const sealed = await sealAuditChain();
  const verify = await verifyAuditChain();
  return NextResponse.json({ ok: true, ran: "reconcile", sealed: sealed.sealed, auditChain: verify });
}
