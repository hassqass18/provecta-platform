import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";

// SLA breach sweep (W2+). W0 stub: guarded no-op.
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ran: "sla", note: "gated no-op (W0 stub)" });
}
