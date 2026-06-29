import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EngagementPlan } from "@/lib/brain";

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

export interface StagePlanResult {
  created: boolean;
  milestones: number;
  deliverables: number;
  tasks: number;
  kpis: number;
}

/**
 * Install a bRRAIn-generated EngagementPlan into an engagement (P3): milestones
 * (source=BRAIN) with their nested deliverables + tasks, plus KPIs. Replaces the
 * pristine template scaffold — the generic onboarding milestones/KPIs that were
 * auto-staged (status PENDING, with a baselineDate, no tasks) are cleared so the
 * tailored plan takes their place. Human-touched artifacts (completed phases,
 * phases with tasks, edited KPIs) are never removed.
 *
 * Idempotent: if the engagement already has BRAIN-sourced milestones, this is a
 * no-op returning `created: false` (re-generation must be explicit).
 */
export async function stageEngagementPlan(
  engagementId: string,
  plan: EngagementPlan,
): Promise<StagePlanResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, startDate: true },
  });
  if (!engagement) throw new Error(`Engagement "${engagementId}" not found`);

  const alreadyPlanned = await prisma.milestone.count({
    where: { engagementId, source: "BRAIN" },
  });
  if (alreadyPlanned > 0) {
    return { created: false, milestones: 0, deliverables: 0, tasks: 0, kpis: 0 };
  }

  const start = engagement.startDate ?? new Date();
  let deliverables = 0;
  let tasks = 0;

  await prisma.$transaction(async (tx) => {
    // Clear the pristine template scaffold (only): template milestones carry a
    // baselineDate, are still PENDING, and have no tasks. Their tasks (none
    // expected) are removed first to satisfy the FK.
    const scaffold = await tx.milestone.findMany({
      where: { engagementId, status: "PENDING", baselineDate: { not: null } },
      select: { id: true, _count: { select: { tasks: true } } },
    });
    const removable = scaffold.filter((m) => m._count.tasks === 0).map((m) => m.id);
    if (removable.length) {
      await tx.deliverable.deleteMany({ where: { milestoneId: { in: removable } } });
      await tx.milestone.deleteMany({ where: { id: { in: removable } } });
    }
    // Clear pristine template KPIs (untouched, value 0).
    await tx.kpi.deleteMany({ where: { engagementId, value: 0, source: "HUMAN" } });

    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      const milestone = await tx.milestone.create({
        data: {
          engagementId,
          title: phase.title,
          phaseSummary: phase.summary ?? null,
          status: "PENDING",
          baselineDate: new Date(start.getTime() + phase.dayOffset * DAY_MS),
          dueDate: new Date(start.getTime() + phase.dayOffset * DAY_MS),
          orderIndex: i + 1,
          clientVisible: phase.clientVisible,
          source: "BRAIN",
        },
      });

      if (phase.deliverables.length) {
        await tx.deliverable.createMany({
          data: phase.deliverables.map((d, di) => ({
            engagementId,
            milestoneId: milestone.id,
            title: d.title,
            detail: d.detail ?? null,
            kind: d.kind,
            orderIndex: di + 1,
            clientVisible: phase.clientVisible,
          })),
        });
        deliverables += phase.deliverables.length;
      }

      if (phase.tasks.length) {
        await tx.task.createMany({
          data: phase.tasks.map((t) => ({
            engagementId,
            milestoneId: milestone.id,
            title: t.title,
            priority: t.priority,
            source: "AGENT",
          })),
        });
        tasks += phase.tasks.length;
      }
    }

    if (plan.kpis.length) {
      await tx.kpi.createMany({
        data: plan.kpis.map((k) => ({
          engagementId,
          label: k.label,
          value: 0,
          unit: k.unit ?? null,
          target: k.target ?? null,
          source: "BRAIN",
        })),
      });
    }
  });

  await prisma.auditLog
    .create({
      data: {
        action: "ENGAGEMENT_PLAN_GENERATED",
        entity: "Engagement",
        entityId: engagementId,
        meta: `${plan.phases.length} phases · ${deliverables} deliverables · ${tasks} tasks · ${plan.kpis.length} KPIs`,
      },
    })
    .catch(() => {});

  return {
    created: true,
    milestones: plan.phases.length,
    deliverables,
    tasks,
    kpis: plan.kpis.length,
  };
}
