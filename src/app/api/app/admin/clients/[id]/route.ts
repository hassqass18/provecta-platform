import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Admin browse of one client: every engagement with its milestones + deliverables,
// the entry point for full review + edit/create/delete across the engagement.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const engagements = await prisma.engagement.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { orderIndex: "asc" } },
      deliverables: { orderBy: { orderIndex: "asc" } },
      _count: { select: { tasks: true, documents: true } },
    },
  });

  return NextResponse.json({
    tenant,
    engagements: engagements.map((e) => ({
      id: e.id, name: e.name, code: e.code, status: e.status,
      taskCount: e._count.tasks, documentCount: e._count.documents,
      milestones: e.milestones.map((m) => ({
        id: m.id, title: m.title, status: m.status, approvalStatus: m.approvalStatus, clientVisible: m.clientVisible,
      })),
      deliverables: e.deliverables.map((d) => ({
        id: d.id, title: d.title, kind: d.kind, status: d.status, approvalStatus: d.approvalStatus, milestoneId: d.milestoneId, clientVisible: d.clientVisible,
      })),
    })),
  });
}
