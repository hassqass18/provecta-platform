import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { generateEngagementPlan } from "@/lib/brain";
import { stageEngagementPlan } from "@/server/staging";
import { getEngagementMaterials } from "@/server/rag/engagement-context";

// Generating the tailored plan runs the LLM (~30s); allow the full window.
export const maxDuration = 60;

// Mobile cockpit P3 action: bRRAIn generates the tailored delivery plan for an
// engagement and stages it. Mirrors generateEngagementPlanAction on the web.
// stageEngagementPlan is idempotent — if a BRAIN plan already exists it returns
// created=false and does NOT clobber it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const eng = await prisma.engagement.findUnique({
    where: { id },
    include: { charter: true, proposal: true, tenant: { select: { id: true } } },
  });
  if (!eng) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Short-circuit BEFORE the ~40s LLM call: stageEngagementPlan won't clobber an
  // existing BRAIN plan, so generating one just to discard it is wasted time.
  const alreadyPlanned = await prisma.milestone.count({ where: { engagementId: id, source: "BRAIN" } });
  if (alreadyPlanned > 0) {
    return NextResponse.json({ ok: true, created: false, milestones: 0, deliverables: 0, tasks: 0, alreadyPlanned: true });
  }

  const materials = await getEngagementMaterials(id, eng.tenantId, { maxChars: 16000 });
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
    { engagementId: id },
  );

  const result = await stageEngagementPlan(id, plan);
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "ENGAGEMENT_PLAN_STAGED",
      entity: "Engagement",
      entityId: id,
      meta: `${provider} · ${result.milestones} phases · created=${result.created}`,
    },
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
    milestones: result.milestones,
    deliverables: result.deliverables,
    tasks: result.tasks,
    alreadyPlanned: !result.created,
  });
}
