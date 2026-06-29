import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { activateEngagementOnAccept } from "@/server/engagement/plan";
import { notifyOperators } from "@/server/notifications/fanout";
import { sendEmail, emailShell, mdToEmailHtml } from "@/lib/email/resend";

// Public proposal acceptance (token-gated, no login). The pivot of the funnel:
// APPROVE the proposal → activate the engagement (+ stage plan) → mint the
// client's workspace login + email it → enqueue the engagement contract →
// notify the operator. Idempotent: a second accept is a no-op.
export const maxDuration = 60;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.pgco.world").replace(/\/$/, "");
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { acceptToken: token },
    include: { engagement: { include: { tenant: { select: { id: true, name: true, channelAddress: true } } } } },
  });
  const expired = proposal?.acceptTokenExpiresAt ? proposal.acceptTokenExpiresAt < new Date() : true;
  if (!proposal || expired) return NextResponse.json({ error: "This proposal link is invalid or has expired." }, { status: 404 });
  if (proposal.status === "DECLINED") return NextResponse.json({ error: "This proposal was declined." }, { status: 409 });

  const tenant = proposal.engagement.tenant;
  const email = tenant.channelAddress?.toLowerCase();
  const engagementId = proposal.engagementId;

  // Idempotent: only run the side-effects on the first accept.
  const firstAccept = proposal.status !== "APPROVED";
  if (firstAccept) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "APPROVED", approvedAt: new Date() } });
    await activateEngagementOnAccept(engagementId).catch(() => {});
  }

  // Create the client's workspace login if they don't have one yet.
  let createdLogin: { email: string; password: string } | null = null;
  if (email && !(await prisma.user.findUnique({ where: { email } }))) {
    const tempPassword = `Provecta-${randomBytes(4).toString("hex")}`;
    const contactName = proposal.engagement.summary?.match(/contact:\s*([^<]+)</i)?.[1]?.trim();
    await prisma.user.create({
      data: { email, name: contactName || tenant.name, passwordHash: await hash(tempPassword), role: "CLIENT", tenantId: tenant.id },
    });
    createdLogin = { email, password: tempPassword };
    const body = `## Welcome to Provecta Group\n\nYour proposal is accepted and your secure workspace is ready.\n\n**Sign in:** ${email}\n**Temporary password:** ${tempPassword}\n\nWhen you sign in you'll find your engagement agreement to review and sign, plus your project board, documents, and a direct line to us.`;
    await sendEmail({
      to: email,
      subject: "Your Provecta Group workspace is ready",
      html: emailShell(mdToEmailHtml(body), { label: "Sign in to your workspace", url: `${baseUrl()}/login` }),
    }).catch(() => {});
  }

  if (firstAccept) {
    // Enqueue the engagement contract (Phase C handler drafts + stages it for review).
    await prisma.ingestJob.create({
      data: { tenantId: tenant.id, kind: "CONTRACT", status: "PENDING", payload: { engagementId } },
    }).catch(() => {});
    await prisma.auditLog
      .create({ data: { action: "PROPOSAL_ACCEPTED", entity: "Proposal", entityId: proposal.id, meta: tenant.name } })
      .catch(() => {});
    await notifyOperators("PROPOSAL_ACCEPTED", `${tenant.name} accepted their proposal — engagement activated, contract drafting.`).catch(() => {});
  }

  return NextResponse.json({ ok: true, email: createdLogin?.email ?? email ?? null });
}
