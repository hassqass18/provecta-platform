import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { listComments } from "@/server/collab";

// Deep phase view: a milestone with its detail body, tasks, nested deliverables,
// filed documents, and the comment thread. Tenant-ownership is verified before
// anything is returned.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ error: "no workspace" }, { status: 400 });
  const { id } = await params;

  const m = await prisma.milestone.findUnique({
    where: { id },
    include: { engagement: { select: { tenantId: true, name: true } }, tasks: { orderBy: { createdAt: "asc" } } },
  });
  if (!m || m.engagement.tenantId !== user.tenantId || !m.clientVisible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [deliverables, documents, comments] = await Promise.all([
    prisma.deliverable.findMany({
      where: { milestoneId: id, clientVisible: true },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.document.findMany({
      where: { milestoneId: id, isFinal: true, clientVisible: true },
      orderBy: { createdAt: "desc" },
    }),
    listComments("MILESTONE", id),
  ]);

  return NextResponse.json({
    milestone: {
      id: m.id,
      title: m.title,
      phaseSummary: m.phaseSummary,
      detail: m.detail,
      status: m.status,
      approvalStatus: m.approvalStatus,
      dueDate: m.dueDate,
      engagementName: m.engagement.name,
      tasks: m.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    },
    deliverables: deliverables.map((d) => ({
      id: d.id, title: d.title, kind: d.kind, version: d.version,
      isFinal: d.isFinal, status: d.status, approvalStatus: d.approvalStatus,
    })),
    documents: documents.map((d) => ({
      id: d.id, name: d.name, kind: d.kind, version: d.version, signed: d.signed, sizeBytes: d.sizeBytes, createdAt: d.createdAt,
    })),
    comments,
  });
}
