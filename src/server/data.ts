import { prisma, dbForTenant } from "@/lib/db";

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

// Client-facing projection — SANITIZED to client-safe data only (P0-LEAK).
// Returns an explicit DTO (never raw Prisma rows) so internal fields can never
// leak: clientVisible milestones only, final documents only, non-draft invoices,
// no internal Task rows, no internal ticket "proposed actions", no SYSTEM/agent
// draft messages. This is the SINGLE read path the portal + view-as-client use.
export async function getClientDashboardProjection(tenantId: string) {
  // RLS-enforced client: Postgres double-checks tenant scoping on top of the
  // explicit where-filter, so a bug here still can't cross tenants.
  const db = dbForTenant(tenantId);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  const raw = await db.engagement.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { where: { clientVisible: true }, orderBy: { orderIndex: "asc" } },
      kpis: true,
      slas: true,
      invoices: { where: { status: { notIn: ["DRAFT", "VOID"] } }, orderBy: { createdAt: "desc" } },
      documents: { where: { isFinal: true, clientVisible: true }, orderBy: { createdAt: "desc" } },
      tickets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!raw) return { tenant, engagement: null };

  const engagement = {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    status: raw.status,
    startDate: raw.startDate,
    targetEndDate: raw.targetEndDate,
    budgetMinor: raw.budgetMinor,
    currency: raw.currency,
    milestones: raw.milestones.map((m) => ({
      id: m.id, title: m.title, description: m.description, status: m.status, dueDate: m.dueDate,
    })),
    kpis: raw.kpis.map((k) => ({ id: k.id, label: k.label, value: k.value, unit: k.unit })),
    slas: raw.slas.map((s) => ({ id: s.id, metric: s.metric, target: s.target, status: s.status })),
    invoices: raw.invoices.map((i) => ({
      id: i.id, number: i.number, amountMinor: i.amountMinor, currency: i.currency, dueAt: i.dueAt, status: i.status,
    })),
    documents: raw.documents.map((d) => ({
      id: d.id, name: d.name, isFinal: d.isFinal, signed: d.signed, kind: d.kind, version: d.version, sizeBytes: d.sizeBytes,
    })),
    // proposedAction is internal — always null on the client surface.
    tickets: raw.tickets.map((t) => ({
      id: t.id, subject: t.subject, channel: t.channel, status: t.status,
      proposedAction: null as string | null,
    })),
  };
  return { tenant, engagement };
}

export async function getDemoTenantId(): Promise<string | null> {
  const demo = await prisma.tenant.findFirst({ where: { isDemo: true } });
  return demo?.id ?? null;
}
