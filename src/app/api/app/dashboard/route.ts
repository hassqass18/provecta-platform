import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { getClientDashboardProjection } from "@/server/data";

// The client's engagement at a glance. Reuses getClientDashboardProjection,
// which is already sanitized (no internal/draft data) and RLS-scoped via
// dbForTenant — the app surface adds nothing that bypasses those guarantees.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) {
    return NextResponse.json({ tenant: null, engagement: null, linked: false });
  }
  const data = await getClientDashboardProjection(user.tenantId);
  return NextResponse.json({ ...data, linked: true });
}
