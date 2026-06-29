import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyOperators } from "@/server/notifications/fanout";

// Public proposal decline (token-gated). Records the decision and notifies the
// operator. Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { acceptToken: token },
    include: { engagement: { include: { tenant: { select: { name: true } } } } },
  });
  const expired = proposal?.acceptTokenExpiresAt ? proposal.acceptTokenExpiresAt < new Date() : true;
  if (!proposal || expired) return NextResponse.json({ error: "This proposal link is invalid or has expired." }, { status: 404 });
  if (proposal.status === "APPROVED") return NextResponse.json({ error: "This proposal was already accepted." }, { status: 409 });

  if (proposal.status !== "DECLINED") {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "DECLINED", declinedAt: new Date() } });
    await prisma.auditLog
      .create({ data: { action: "PROPOSAL_DECLINED", entity: "Proposal", entityId: proposal.id, meta: proposal.engagement.tenant.name } })
      .catch(() => {});
    await notifyOperators("PROPOSAL_DECLINED", `${proposal.engagement.tenant.name} declined their proposal.`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
