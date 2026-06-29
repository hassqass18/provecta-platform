import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Mobile cockpit: funnel detail for an engagement — proposal + engagement
// agreements (envelopes) so the app can drive generate/send/release.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const eng = await prisma.engagement.findUnique({
    where: { id },
    include: { tenant: { select: { name: true, channelAddress: true } }, proposal: true },
  });
  if (!eng) return NextResponse.json({ error: "not found" }, { status: 404 });

  const envelopes = await prisma.envelope.findMany({
    where: { engagementId: id, docType: "AGREEMENT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, signerName: true, signerEmail: true },
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://www.pgco.world").replace(/\/$/, "");
  return NextResponse.json({
    engagement: { id: eng.id, name: eng.name, code: eng.code, status: eng.status, client: eng.tenant.name, budgetMinor: eng.budgetMinor, currency: eng.currency },
    proposal: eng.proposal
      ? {
          id: eng.proposal.id,
          status: eng.proposal.status,
          amountMinor: eng.proposal.amountMinor,
          currency: eng.proposal.currency,
          bodyMd: eng.proposal.bodyMd,
          acceptLink: eng.proposal.acceptToken ? `${base}/p/${eng.proposal.acceptToken}` : null,
        }
      : null,
    envelopes,
  });
}
