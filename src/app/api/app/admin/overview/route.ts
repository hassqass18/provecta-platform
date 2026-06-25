import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Admin cockpit feed for the role-gated app: the review queue (client sign-offs
// awaiting action), the latest client comments, open message tickets, and a
// client roster. Reads across all tenants (admin bypass).
export async function GET(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [pendingMilestones, pendingDeliverables, recentComments, openTickets, tenants] = await Promise.all([
    prisma.milestone.findMany({
      where: { approvalStatus: { in: ["PENDING", "CHANGES_REQUESTED"] }, clientVisible: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { engagement: { select: { name: true, tenant: { select: { name: true } } } } },
    }),
    prisma.deliverable.findMany({
      where: { approvalStatus: { in: ["PENDING", "CHANGES_REQUESTED"] }, clientVisible: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { engagement: { select: { name: true, tenant: { select: { name: true } } } } },
    }),
    prisma.comment.findMany({
      where: { authorType: "CLIENT" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "TRIAGED", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.tenant.findMany({
      where: { type: "CLIENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { engagements: true, tickets: true } } },
    }),
  ]);

  const reviewQueue = [
    ...pendingMilestones.map((m) => ({
      targetType: "MILESTONE" as const, targetId: m.id, title: m.title,
      status: m.approvalStatus, client: m.engagement.tenant.name, engagement: m.engagement.name,
    })),
    ...pendingDeliverables.map((d) => ({
      targetType: "DELIVERABLE" as const, targetId: d.id, title: d.title,
      status: d.approvalStatus, client: d.engagement.tenant.name, engagement: d.engagement.name,
    })),
  ];

  return NextResponse.json({
    counts: {
      reviewQueue: reviewQueue.length,
      openTickets: openTickets.length,
      clients: tenants.length,
    },
    reviewQueue,
    recentComments: recentComments.map((c) => ({
      id: c.id, targetType: c.targetType, targetId: c.targetId,
      authorName: c.authorName, body: c.body, createdAt: c.createdAt,
    })),
    openTickets: openTickets.map((t) => ({
      id: t.id, subject: t.subject, channel: t.channel, client: t.tenant.name, createdAt: t.createdAt,
    })),
    clients: tenants.map((t) => ({
      id: t.id, name: t.name, engagements: t._count.engagements, tickets: t._count.tickets,
    })),
  });
}
