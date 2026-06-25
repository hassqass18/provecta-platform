import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { listComments } from "@/server/collab";

// Admin full review of a deliverable across ANY tenant — full write-up,
// attached documents, and the complete thread incl. internal notes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const d = await prisma.deliverable.findUnique({
    where: { id },
    include: { engagement: { select: { name: true, tenant: { select: { name: true } } } } },
  });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [documents, comments] = await Promise.all([
    prisma.document.findMany({
      where: { OR: [{ deliverableId: id }, ...(d.documentId ? [{ id: d.documentId }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    listComments("DELIVERABLE", id, { includeInternal: true }),
  ]);

  return NextResponse.json({
    deliverable: {
      id: d.id, title: d.title, kind: d.kind, version: d.version, detail: d.detail,
      isFinal: d.isFinal, status: d.status, approvalStatus: d.approvalStatus,
      clientVisible: d.clientVisible, milestoneId: d.milestoneId, engagementId: d.engagementId,
      client: d.engagement.tenant.name, engagementName: d.engagement.name,
    },
    documents: documents.map((x) => ({ id: x.id, name: x.name, kind: x.kind, isFinal: x.isFinal, clientVisible: x.clientVisible, createdAt: x.createdAt })),
    comments,
  });
}
