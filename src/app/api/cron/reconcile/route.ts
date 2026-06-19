import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";

// Snapshot/ledger reconciliation + brain-sync drift catch (W2/W4). W0 stub:
// guarded no-op. This is the one wired to native Vercel cron (daily, Hobby-safe).
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ran: "reconcile", note: "gated no-op (W0 stub)" });
}
