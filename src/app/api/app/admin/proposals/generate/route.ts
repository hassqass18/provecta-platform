import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { proposalFromTranscript } from "@/lib/brain";

// bRRAIn drafts a real, tailored proposal from a discovery transcript and stages
// a PROPOSED engagement + DRAFT proposal for review. Admin-only.
export const maxDuration = 60;

const schema = z.object({
  tenantId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  transcript: z.string().trim().min(20).max(50000),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "tenantId, title and a transcript are required." }, { status: 400 });
  const { tenantId, title, transcript } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  await prisma.transcript.create({ data: { tenantId, title, body: transcript, source: "DISCOVERY_CALL" } });
  const { bodyMd, suggestedBudgetMinor } = await proposalFromTranscript(title, transcript);

  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const eng = await prisma.engagement.create({
    data: {
      tenantId, name: title, code, status: "PROPOSED",
      summary: "Drafted from the discovery transcript by bRRAIn.",
      budgetMinor: suggestedBudgetMinor, currency: "USD",
      proposal: { create: { status: "DRAFT", amountMinor: suggestedBudgetMinor, currency: "USD", bodyMd } },
      charter: { create: { objectives: "(to refine)", sponsor: tenant.name } },
    },
  });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "PROPOSAL_FROM_TRANSCRIPT", entity: "Engagement", entityId: eng.id, meta: code } }).catch(() => {});

  return NextResponse.json({ ok: true, engagementId: eng.id, code, bodyMd, budgetMinor: suggestedBudgetMinor });
}
