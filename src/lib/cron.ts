import { NextResponse } from "next/server";

// Shared guard for scheduled endpoints. Vercel native cron sends
// `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set;
// an external scheduler (e.g. cron-job.org) uses the same header for the
// sub-daily ticks the Hobby plan can't run natively. No secret configured, or a
// mismatched/absent bearer ⇒ 401. Routes are no-ops while their feature flags
// are OFF, so nothing fires destructively in W0.
export function requireCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron not configured" }, { status: 401 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
