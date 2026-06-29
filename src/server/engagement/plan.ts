import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { generateEngagementPlan } from "@/lib/brain";
import { stageEngagementPlan } from "@/server/staging";
import { getEngagementMaterials } from "@/server/rag/engagement-context";

/**
 * Assemble an engagement's scope, ask bRRAIn for the tailored plan, and stage it.
 * Shared by the admin "Generate plan" action, the mobile plan route, and the
 * public proposal-accept flow. stageEngagementPlan is idempotent (won't clobber
 * an existing BRAIN plan).
 */
export async function generateAndStagePlan(
  engagementId: string,
  actorId: string | null = null,
): Promise<{ created: boolean; milestones: number; deliverables: number; tasks: number } | null> {
  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { charter: true, proposal: true, tenant: { select: { id: true, name: true } } },
  });
  if (!eng) return null;

  const materials = await getEngagementMaterials(engagementId, eng.tenantId, { maxChars: 16000 });
  const { plan, provider } = await generateEngagementPlan(
    {
      name: eng.name,
      summary: eng.summary,
      budgetMinor: eng.budgetMinor,
      currency: eng.currency,
      charter: eng.charter,
      proposalMd: eng.proposal?.bodyMd ?? null,
      transcript: materials || null,
    },
    { engagementId },
  );
  const result = await stageEngagementPlan(engagementId, plan);
  await prisma.auditLog
    .create({
      data: {
        actorId,
        action: "ENGAGEMENT_PLAN_STAGED",
        entity: "Engagement",
        entityId: engagementId,
        meta: `${provider} · ${result.milestones} phases · created=${result.created}`,
      },
    })
    .catch(() => {});
  return result;
}

/**
 * Activate an engagement on proposal acceptance: flip PROPOSED→ACTIVE, emit
 * PROPOSAL_ACCEPTED (agent loop picks it up), and stage the tailored plan if one
 * hasn't been generated. Used by the public accept route (no admin session) and
 * mirrors setEngagementStatus's ACTIVE branch.
 */
export async function activateEngagementOnAccept(
  engagementId: string,
  actorId: string | null = null,
): Promise<void> {
  const before = await prisma.engagement.findUnique({ where: { id: engagementId }, select: { status: true } });
  if (before?.status === "ACTIVE") return;
  await prisma.engagement.update({ where: { id: engagementId }, data: { status: "ACTIVE" } });
  await prisma.auditLog
    .create({ data: { actorId, action: "ENGAGEMENT_STATUS", entity: "Engagement", entityId: engagementId, meta: "ACTIVE (proposal accepted)" } })
    .catch(() => {});
  await emitEvent("PROPOSAL_ACCEPTED", "Engagement", engagementId, { status: "ACTIVE" }).catch(() => {});
  const planned = await prisma.milestone.count({ where: { engagementId, source: "BRAIN" } });
  if (planned === 0) await generateAndStagePlan(engagementId, actorId).catch(() => {});
}
