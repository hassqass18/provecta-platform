import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const DAY_MS = 86_400_000;

/**
 * Idempotently upsert the built-in "onboarding" ProjectTemplate plus its
 * milestones and KPIs. Safe to call repeatedly: if the template already exists
 * we return early without touching anything.
 */
export async function ensureDefaultTemplates(): Promise<void> {
  const existing = await prisma.projectTemplate.findUnique({
    where: { key: "onboarding" },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.projectTemplate.create({
      data: { key: "onboarding", name: "Client Onboarding" },
    });

    await tx.projectTemplateMilestone.createMany({
      data: [
        { templateKey: "onboarding", dayOffset: 0, title: "Kickoff & access", clientVisible: true, orderIndex: 1 },
        { templateKey: "onboarding", dayOffset: 7, title: "Discovery & current-state audit", clientVisible: true, orderIndex: 2 },
        { templateKey: "onboarding", dayOffset: 21, title: "Operating model design", clientVisible: true, orderIndex: 3 },
        { templateKey: "onboarding", dayOffset: 45, title: "Build & integration", clientVisible: true, orderIndex: 4 },
        { templateKey: "onboarding", dayOffset: 60, title: "Enablement & handover", clientVisible: true, orderIndex: 5 },
      ],
    });

    await tx.projectTemplateKpi.createMany({
      data: [
        { templateKey: "onboarding", label: "Onboarding completion", unit: "%", target: 100 },
        { templateKey: "onboarding", label: "Time to first value (days)", unit: "days", target: 30 },
      ],
    });
  });
}

/**
 * Stage a fresh Engagement for a tenant from a ProjectTemplate. Creates the
 * Engagement spine (Charter, Milestones, KPIs) in a single transaction.
 *
 * Idempotent on `{ tenantId, stagedFromTemplateKey }` (enforced by a DB unique
 * constraint, with a P2002 race fallback): a second call returns the existing
 * engagement with `created: false`.
 */
export async function stageProjectFromTemplate(
  tenantId: string,
  templateKey = "onboarding",
): Promise<{ engagementId: string; created: boolean }> {
  await ensureDefaultTemplates();

  const existing = await prisma.engagement.findFirst({
    where: { tenantId, stagedFromTemplateKey: templateKey },
    select: { id: true },
  });
  if (existing) return { engagementId: existing.id, created: false };

  const template = await prisma.projectTemplate.findUnique({
    where: { key: templateKey },
  });
  if (!template) {
    throw new Error(`ProjectTemplate "${templateKey}" not found`);
  }

  const [templateMilestones, templateKpis, tenant] = await Promise.all([
    prisma.projectTemplateMilestone.findMany({
      where: { templateKey },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.projectTemplateKpi.findMany({ where: { templateKey } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!tenant) {
    throw new Error(`Tenant "${tenantId}" not found`);
  }

  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const now = new Date();

  try {
    const engagementId = await prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.create({
        data: {
          tenantId,
          name: `${template.name} — ${tenant.name}`,
          code,
          status: "ACTIVE",
          stagedFromTemplateKey: templateKey,
          startDate: now,
        },
      });

      await tx.charter.create({
        data: {
          engagementId: engagement.id,
          objectives: "Stand up the engagement operating model.",
          sponsor: tenant.name,
        },
      });

      if (templateMilestones.length) {
        await tx.milestone.createMany({
          data: templateMilestones.map((m) => ({
            engagementId: engagement.id,
            title: m.title,
            baselineDate: new Date(now.getTime() + m.dayOffset * DAY_MS),
            clientVisible: m.clientVisible,
            orderIndex: m.orderIndex,
            source: "HUMAN",
          })),
        });
      }

      if (templateKpis.length) {
        await tx.kpi.createMany({
          data: templateKpis.map((k) => ({
            engagementId: engagement.id,
            label: k.label,
            value: 0,
            unit: k.unit,
            target: k.target,
            source: "HUMAN",
          })),
        });
      }

      return engagement.id;
    });

    await prisma.auditLog.create({
      data: {
        action: "ENGAGEMENT_STAGED",
        entity: "Engagement",
        entityId: engagementId,
        meta: templateKey,
      },
    });

    return { engagementId, created: true };
  } catch (err) {
    // Unique race: another caller staged the same {tenantId, templateKey}
    // (or raced the engagement code) between our check and the insert.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.engagement.findFirst({
        where: { tenantId, stagedFromTemplateKey: templateKey },
        select: { id: true },
      });
      if (raced) return { engagementId: raced.id, created: false };
    }
    throw err;
  }
}
