import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { listComments } from "@/server/collab";

// A single in-phase deliverable: its write-up, attached documents, approval
// state, and comment thread. Tenant-ownership verified before returning.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ error: "no workspace" }, { status: 400 });
  const { id } = await params;

  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: { engagement: { select: { tenantId: true, name: true } } },
  });
  if (!d || d.engagement.tenantId !== user.tenantId || !d.clientVisible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [documents, comments] = await Promise.all([
    prisma.document.findMany({
      where: {
        clientVisible: true,
        OR: [{ deliverableId: id }, ...(d.documentId ? [{ id: d.documentId }] : [])],
      },
      orderBy: { createdAt: "desc" },
    }),
    listComments("DELIVERABLE", id),
  ]);

  return NextResponse.json({
    deliverable: {
      id: d.id, title: d.title, kind: d.kind, version: d.version,
      detail: d.detail, isFinal: d.isFinal, status: d.status,
      approvalStatus: d.approvalStatus, engagementName: d.engagement.name,
    },
    documents: documents.map((x) => ({
      id: x.id, name: x.name, kind: x.kind, version: x.version, signed: x.signed, sizeBytes: x.sizeBytes, createdAt: x.createdAt,
    })),
    comments,
  });
}
