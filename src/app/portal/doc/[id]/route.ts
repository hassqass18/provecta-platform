import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

// P2B — VDR-grade document access. Every view is authorized (tenant-scoped, final,
// client-approved only) and written to the AuditLog access trail. Brain docs store
// a git ref (no public URL yet); a presigned GET lands when object storage (R2) is wired.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const doc = await prisma.document.findFirst({
    where: { id, tenantId: user.tenantId, isFinal: true, clientVisible: true },
  });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "DOCUMENT_VIEW", entity: "Document", entityId: doc.id, meta: `${doc.name} v${doc.version}` },
  });

  if (doc.url && /^https?:\/\//.test(doc.url)) return NextResponse.redirect(doc.url);
  return NextResponse.json({
    ok: true,
    name: doc.name,
    version: doc.version,
    note: "Access logged. Binary fetch available once object storage (R2) is wired.",
  });
}
