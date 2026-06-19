import { prisma } from "@/lib/db";

// Engagement health snapshots. This is an admin/system compute that spans a
// tenant's engagement (milestones, invoices, SLAs, tickets), so it uses the
// bypass `prisma` client rather than the RLS-scoped dbForTenant.

const OPEN_TICKET_STATUSES = ["OPEN", "TRIAGED", "IN_PROGRESS"];
const DAY_MS = 86_400_000;

export async function recomputeSnapshot(engagementId: string) {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      milestones: true,
      invoices: { include: { payments: true } },
      slas: true,
      tickets: true,
    },
  });
  if (!engagement) {
    throw new Error(`Engagement not found: ${engagementId}`);
  }

  const milestonesTotal = engagement.milestones.length;
  const milestonesComplete = engagement.milestones.filter((m) => m.status === "COMPLETED").length;

  // Prefer actual payments; fall back to PAID invoice amounts when none recorded.
  const paymentsTotal = engagement.invoices.reduce(
    (sum, inv) => sum + inv.payments.reduce((s, p) => s + p.amountMinor, 0),
    0,
  );
  const budgetSpentMinor =
    paymentsTotal > 0
      ? paymentsTotal
      : engagement.invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountMinor, 0);

  const slaTotal = engagement.slas.length;
  const slaMeeting = engagement.slas.filter((s) => s.status === "MEETING").length;
  const slaAttainmentPct = Math.round((100 * slaMeeting) / Math.max(1, slaTotal));

  const openTickets = engagement.tickets.filter((t) => OPEN_TICKET_STATUSES.includes(t.status)).length;

  const daysRemaining = engagement.targetEndDate
    ? Math.ceil((engagement.targetEndDate.getTime() - Date.now()) / DAY_MS)
    : null;

  const anyBreached = engagement.slas.some((s) => s.status === "BREACHED");
  const anyAtRisk = engagement.slas.some((s) => s.status === "AT_RISK");
  const completionRatio = milestonesTotal > 0 ? milestonesComplete / milestonesTotal : 1;

  let ragOverall: "GREEN" | "AMBER" | "RED";
  if (anyBreached || (daysRemaining !== null && daysRemaining < 0 && milestonesComplete < milestonesTotal)) {
    ragOverall = "RED";
  } else if (anyAtRisk || (completionRatio < 0.5 && daysRemaining !== null && daysRemaining < 30)) {
    ragOverall = "AMBER";
  } else {
    ragOverall = "GREEN";
  }

  const data = {
    milestonesComplete,
    milestonesTotal,
    budgetSpentMinor,
    slaAttainmentPct,
    openTickets,
    daysRemaining,
    ragOverall,
  };

  return prisma.engagementMetricSnapshot.upsert({
    where: { engagementId },
    create: { engagementId, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

export async function getSnapshot(engagementId: string) {
  return prisma.engagementMetricSnapshot.findUnique({ where: { engagementId } });
}
