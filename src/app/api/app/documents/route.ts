import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { dbForTenant } from "@/lib/db";

// The client's approved deliverables — FINAL + client-visible documents only
// (brain-pulled finals stay hidden until a human approves). Tenant-scoped via
// dbForTenant. Binary download is gated until object storage (R2) is wired; the
// app lists metadata and a view is audited server-side when opened.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ documents: [] });

  const db = dbForTenant(user.tenantId);
  const rows = await db.document.findMany({
    where: { tenantId: user.tenantId, isFinal: true, clientVisible: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const documents = rows.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    version: d.version,
    signed: d.signed,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt,
  }));
  return NextResponse.json({ documents });
}
