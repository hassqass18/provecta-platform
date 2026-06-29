import { prisma } from "@/lib/db";
import { proposalFromTranscript } from "@/lib/brain";
import { getEngagementMaterials } from "@/server/rag/engagement-context";

/**
 * Generate (or re-generate) the proposal body for an engagement, grounded on the
 * engagement's own materials — which now include the internal RESEARCH brief
 * (Phase A) plus the discovery transcript. Writes into the existing DRAFT
 * Proposal (created at prospect intake). The operator reviews before sending.
 */
export async function generateProposalForEngagement(
  engagementId: string,
): Promise<{ chars: number; budgetMinor: number }> {
  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { tenant: { select: { id: true } }, proposal: true },
  });
  if (!eng) throw new Error(`engagement ${engagementId} not found`);

  const materials = await getEngagementMaterials(engagementId, eng.tenant.id, { maxChars: 14000 });
  const { bodyMd, suggestedBudgetMinor } = await proposalFromTranscript(eng.name, materials || eng.name);

  await prisma.proposal.upsert({
    where: { engagementId },
    update: { bodyMd, amountMinor: suggestedBudgetMinor, status: "DRAFT" },
    create: { engagementId, bodyMd, amountMinor: suggestedBudgetMinor, currency: eng.currency, status: "DRAFT" },
  });
  if (!eng.budgetMinor) {
    await prisma.engagement.update({ where: { id: engagementId }, data: { budgetMinor: suggestedBudgetMinor } });
  }
  await prisma.auditLog
    .create({ data: { action: "PROPOSAL_DRAFTED", entity: "Engagement", entityId: engagementId, meta: `${bodyMd.length} chars` } })
    .catch(() => {});
  return { chars: bodyMd.length, budgetMinor: suggestedBudgetMinor };
}
