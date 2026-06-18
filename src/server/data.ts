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

type Filter = { q?: string; status?: string; sort?: string };
const like = (q?: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);

export async function getClients(f: Filter = {}) {
  return prisma.tenant.findMany({
    where: { type: "CLIENT", name: like(f.q) },
    include: { _count: { select: { engagements: true, users: true, tickets: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getEngagements(f: Filter = {}) {
  return prisma.engagement.findMany({
    where: {
      status: f.status || undefined,
      ...(f.q ? { OR: [{ name: like(f.q) }, { code: like(f.q) }] } : {}),
    },
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

export async function getAllTickets(f: Filter = {}) {
  return prisma.ticket.findMany({
    where: { status: f.status || undefined, subject: like(f.q) },
    include: { tenant: true, engagement: true, messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllInvoices(f: Filter = {}) {
  const orderBy =
    f.sort === "amount" ? { amountMinor: "desc" as const } : f.sort === "due" ? { dueAt: "asc" as const } : { createdAt: "desc" as const };
  return prisma.invoice.findMany({
    where: { status: f.status || undefined, number: like(f.q) },
    include: { tenant: true, engagement: true, payments: true },
    orderBy,
  });
}

// Client-facing projection — SANITIZED to client-safe data only.
// (Confidentiality: clients must NOT see draft/internal documents, internal
// ticket "proposed actions", or internal SYSTEM/agent-draft messages.)
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
      documents: { where: { isFinal: true }, orderBy: { createdAt: "desc" } }, // finals only
      tickets: {
        orderBy: { createdAt: "desc" },
        include: { messages: { where: { author: { not: "SYSTEM" } }, orderBy: { createdAt: "asc" } } }, // no internal drafts
      },
    },
  });
  // Strip the internal "proposed action" from anything client-visible.
  if (engagement) engagement.tickets.forEach((t) => { t.proposedAction = null; });
  return { tenant, engagement };
}

export async function getDemoTenantId(): Promise<string | null> {
  const demo = await prisma.tenant.findFirst({ where: { isDemo: true } });
  return demo?.id ?? null;
}
