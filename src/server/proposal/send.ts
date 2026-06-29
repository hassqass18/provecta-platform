import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, mdToEmailHtml, emailShell } from "@/lib/email/resend";

export function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.pgco.world").replace(/\/$/, "");
}

/**
 * Operator-gated proposal send (shared by the web server action and the mobile
 * API route): mint a public accept-link token, mark the proposal SENT, and email
 * the prospect a cover note + link. Returns the link so the operator can also
 * share it manually (e.g. when email is gated).
 */
export async function sendProposal(
  proposalId: string,
  actorId: string | null,
): Promise<{ ok: boolean; link?: string; emailed?: boolean; gated?: boolean; error?: string }> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { engagement: { include: { tenant: { select: { name: true, channelAddress: true } } } } },
  });
  if (!proposal) return { ok: false, error: "not found" };
  if (!proposal.bodyMd) return { ok: false, error: "Generate the proposal before sending." };
  const to = proposal.engagement.tenant.channelAddress;
  if (!to) return { ok: false, error: "No contact email on file for this prospect." };

  const token = proposal.acceptToken ?? randomBytes(24).toString("base64url");
  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "SENT", sentAt: new Date(), acceptToken: token, acceptTokenExpiresAt: new Date(Date.now() + 14 * 864e5) },
  });

  const link = `${publicBaseUrl()}/p/${token}`;
  const cover = `## Your proposal from Provecta Group\n\nThank you for the conversation. We've prepared a tailored proposal for **${proposal.engagement.tenant.name}** based on what you shared.\n\nReview the full proposal and, if it looks right, accept it to get started — you'll receive your secure workspace login and an engagement agreement to sign.`;
  const res = await sendEmail({
    to,
    subject: `Your proposal from Provecta Group — ${proposal.engagement.tenant.name}`,
    html: emailShell(mdToEmailHtml(cover), { label: "Review & accept your proposal", url: link }),
  });
  await prisma.auditLog
    .create({ data: { actorId, action: "PROPOSAL_SENT", entity: "Proposal", entityId: proposalId, meta: res.sent ? "emailed" : res.gated ? "gated" : `error:${res.error}` } })
    .catch(() => {});
  return { ok: true, link, emailed: res.sent, gated: res.gated ?? false };
}
