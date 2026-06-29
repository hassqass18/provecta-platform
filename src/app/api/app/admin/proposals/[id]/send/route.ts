import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { sendEmail, mdToEmailHtml, emailShell } from "@/lib/email/resend";

// Operator-gated proposal send: mint a public accept-link token, mark the
// proposal SENT, and email the prospect a cover note + a link to review &
// accept. proposal-send stays operator-approved (each send is a human action).
export const maxDuration = 30;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.pgco.world").replace(/\/$/, "");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { engagement: { include: { tenant: { select: { id: true, name: true, channelAddress: true } } } } },
  });
  if (!proposal) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!proposal.bodyMd) return NextResponse.json({ error: "Generate the proposal before sending." }, { status: 400 });

  const to = proposal.engagement.tenant.channelAddress;
  if (!to) return NextResponse.json({ error: "No contact email on file for this prospect." }, { status: 400 });

  const token = proposal.acceptToken ?? randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.proposal.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), acceptToken: token, acceptTokenExpiresAt: expires },
  });

  const link = `${baseUrl()}/p/${token}`;
  const cover = `## Your proposal from Provecta Group\n\nThank you for the conversation. We've prepared a tailored proposal for **${proposal.engagement.tenant.name}** based on what you shared.\n\nReview the full proposal and, if it looks right, accept it to get started — you'll receive your secure workspace login and an engagement agreement to sign.`;
  const emailRes = await sendEmail({
    to,
    subject: `Your proposal from Provecta Group — ${proposal.engagement.tenant.name}`,
    html: emailShell(mdToEmailHtml(cover), { label: "Review & accept your proposal", url: link }),
  });

  await prisma.auditLog
    .create({ data: { actorId: admin.id, action: "PROPOSAL_SENT", entity: "Proposal", entityId: id, meta: emailRes.sent ? "emailed" : emailRes.gated ? "gated" : `error:${emailRes.error}` } })
    .catch(() => {});

  return NextResponse.json({ ok: true, status: "SENT", link, emailed: emailRes.sent, gated: emailRes.gated ?? false });
}
