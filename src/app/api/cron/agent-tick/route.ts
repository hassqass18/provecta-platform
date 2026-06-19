import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron";

// W3 will drain PENDING DomainEvents here (planner→executor→critic). W0 stub:
// guarded no-op so the endpoint + smoke contract exist safely.
export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ran: "agent-tick", note: "gated no-op (W0 stub)" });
}
