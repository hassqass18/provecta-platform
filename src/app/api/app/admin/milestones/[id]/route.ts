import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { listComments } from "@/server/collab";

// Admin full review of a milestone across ANY tenant — full content, tasks,
// deliverables, documents (incl. drafts), and the complete comment thread
// including internal notes. The admin reviews everything before acting.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const m = await prisma.milestone.findUnique({
    where: { id },
    include: { engagement: { select: { name: true, tenant: { select: { name: true } } } }, tasks: { orderBy: { createdAt: "asc" } } },
  });
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [deliverables, documents, comments] = await Promise.all([
    prisma.deliverable.findMany({ where: { milestoneId: id }, orderBy: { orderIndex: "asc" } }),
    prisma.document.findMany({ where: { milestoneId: id }, orderBy: { createdAt: "desc" } }),
    listComments("MILESTONE", id, { includeInternal: true }),
  ]);

  return NextResponse.json({
    milestone: {
      id: m.id, title: m.title, phaseSummary: m.phaseSummary, detail: m.detail,
      status: m.status, approvalStatus: m.approvalStatus, dueDate: m.dueDate,
      clientVisible: m.clientVisible, engagementId: m.engagementId,
      client: m.engagement.tenant.name, engagementName: m.engagement.name,
      tasks: m.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    },
    deliverables: deliverables.map((d) => ({
      id: d.id, title: d.title, kind: d.kind, version: d.version, isFinal: d.isFinal,
      status: d.status, approvalStatus: d.approvalStatus, clientVisible: d.clientVisible,
    })),
    documents: documents.map((d) => ({
      id: d.id, name: d.name, kind: d.kind, isFinal: d.isFinal, clientVisible: d.clientVisible, createdAt: d.createdAt,
    })),
    comments,
  });
}
