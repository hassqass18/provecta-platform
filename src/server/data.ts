import { prisma } from "@/lib/db";

export async function getAdminOverview() {
  const [tenants, engagements, openTickets, invoices, milestones, recentActivity, tickets] = await Promise.all([
    prisma.tenant.count({ where: { type: "CLIENT" } }),
    prisma.engagement.findMany({
      include: { tenant: true, _count: { select: { milestones: true, tickets: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "TRIAGED", "IN_PROGRESS"] } } }),
    prisma.invoice.findMany(),
    prisma.milestone.findMany(),
    prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.ticket.findMany({ select: { status: true } }),
  ]);

  const activeEngagements = engagements.filter((e) => e.status === "ACTIVE").length;
  const billed = invoices.reduce((s, i) => s + i.amountMinor, 0);
  const collected = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountMinor, 0);
  const outstanding = billed - collected;
  const milestonesDone = milestones.filter((m) => m.status === "COMPLETED").length;

  const countBy = <T extends string>(items: { [k: string]: unknown }[], key: string) => {
    const m = new Map<T, number>();
    for (const it of items) m.set(it[key] as T, (m.get(it[key] as T) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  };

  return {
    tenants,
    engagements,
    activeEngagements,
    openTickets,
    billedMinor: billed,
    collectedMinor: collected,
    outstandingMinor: outstanding,
    milestonesDone,
    milestonesTotal: milestones.length,
    recentActivity,
    engagementsByStatus: countBy(engagements, "status"),
    ticketsByStatus: countBy(tickets, "status"),
  };
}

export async function getClients() {
  return prisma.tenant.findMany({
    where: { type: "CLIENT" },
    include: { _count: { select: { engagements: true, users: true, tickets: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getEngagements() {
  return prisma.engagement.findMany({
    include: { tenant: true, _count: { select: { milestones: true, tasks: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEngagementDetail(id: string) {
  return prisma.engagement.findUnique({
    where: { id },
    include: {
      tenant: true,
      charter: true,
      proposal: true,
      milestones: { orderBy: { orderIndex: "asc" }, include: { tasks: true } },
      tasks: { include: { assignee: true } },
      kpis: true,
      slas: true,
      invoices: { include: { payments: true } },
      documents: true,
      tickets: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
}

export async function getAllTickets() {
  return prisma.ticket.findMany({
    include: { tenant: true, engagement: true, messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllInvoices() {
  return prisma.invoice.findMany({
    include: { tenant: true, engagement: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

// Client-facing: everything for one tenant's portal dashboard.
export async function getClientDashboard(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const engagement = await prisma.engagement.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      charter: true,
      milestones: { orderBy: { orderIndex: "asc" } },
      kpis: true,
      slas: true,
      invoices: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      tickets: { orderBy: { createdAt: "desc" }, include: { messages: true } },
    },
  });
  return { tenant, engagement };
}

export async function getDemoTenantId(): Promise<string | null> {
  const demo = await prisma.tenant.findFirst({ where: { isDemo: true } });
  return demo?.id ?? null;
}
