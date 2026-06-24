import { prisma } from "@/lib/db";

// Admin-only single-client overview. Uses the bypass `prisma` client (firm/admin
// read path; RLS never restricts it). Returns the tenant with all its engagements
// fully expanded plus money + milestone aggregates, a flat document list, and all
// tickets. Returns null when the tenant doesn't exist.
export async function getClientOverview(clientId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: clientId },
    include: {
      engagements: {
        orderBy: { createdAt: "desc" },
        include: {
          charter: true,
          milestones: { orderBy: { orderIndex: "asc" } },
          kpis: true,
          invoices: { orderBy: { createdAt: "desc" } },
          documents: { orderBy: { createdAt: "desc" } },
          _count: { select: { tickets: true } },
        },
      },
      tickets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!tenant) return null;

  const engagements = tenant.engagements;

  const allInvoices = engagements.flatMap((e) => e.invoices);
  const allMilestones = engagements.flatMap((e) => e.milestones);

  const budgetMinor = engagements.reduce((s, e) => s + e.budgetMinor, 0);
  const billedMinor = allInvoices.reduce((s, i) => s + i.amountMinor, 0);
  const collectedMinor = allInvoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.amountMinor, 0);
  const outstandingMinor = billedMinor - collectedMinor;

  const milestonesTotal = allMilestones.length;
  const milestonesComplete = allMilestones.filter((m) => m.status === "COMPLETED").length;

  // Flat document list, each tagged with its engagement name for display.
  const documents = engagements.flatMap((e) =>
    e.documents.map((d) => ({ ...d, engagementName: e.name })),
  );

  return {
    tenant,
    engagements,
    tickets: tenant.tickets,
    documents,
    aggregates: {
      engagementCount: engagements.length,
      budgetMinor,
      billedMinor,
      collectedMinor,
      outstandingMinor,
      milestonesComplete,
      milestonesTotal,
    },
  };
}

export type ClientOverview = NonNullable<Awaited<ReturnType<typeof getClientOverview>>>;
