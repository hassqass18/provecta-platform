import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";

// Periodic client/admin digest (W3 comms). W0 stub: guarded no-op.
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ran: "digest", note: "gated no-op (W0 stub)" });
}
