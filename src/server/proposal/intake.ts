import { prisma } from "@/lib/db";

export interface ProspectInput {
  company: string;
  contactName?: string | null;
  contactEmail: string;
  domain?: string | null;
  transcript?: string | null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "prospect";
}

/**
 * Prospect intake (shared by the web server action + mobile API route): create
 * the prospect workspace (no login yet), a PROPOSED engagement + empty DRAFT
 * proposal, capture the transcript, and enqueue RESEARCH (which chains the
 * proposal). The prospect's email becomes the main point of contact.
 */
export async function createProspect(
  input: ProspectInput,
  actorId: string | null,
): Promise<{ tenantId: string; engagementId: string; proposalId: string | null; code: string }> {
  const email = input.contactEmail.toLowerCase();
  const tenant = await prisma.tenant.create({
    data: {
      name: input.company,
      slug: `${slugify(input.company)}-${Math.random().toString(36).slice(2, 6)}`,
      type: "CLIENT",
      preferredChannel: "EMAIL",
      channelAddress: email,
    },
  });

  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const eng = await prisma.engagement.create({
    data: {
      tenantId: tenant.id,
      name: `${input.company} — Engagement`,
      code,
      status: "PROPOSED",
      summary: input.contactName ? `Prospect contact: ${input.contactName} <${email}>` : `Prospect contact: ${email}`,
      currency: "USD",
      proposal: { create: { status: "DRAFT", currency: "USD" } },
      charter: { create: { sponsor: input.company } },
    },
    include: { proposal: { select: { id: true } } },
  });

  if (input.transcript) {
    await prisma.transcript.create({
      data: { tenantId: tenant.id, engagementId: eng.id, title: `${input.company} — discovery`, body: input.transcript, source: "DISCOVERY_CALL" },
    });
  }

  await prisma.ingestJob.create({
    data: {
      tenantId: tenant.id,
      kind: "RESEARCH",
      status: "PENDING",
      payload: { company: input.company, contact: input.contactName ?? null, domain: input.domain ?? null, engagementId: eng.id },
    },
  });
  await prisma.auditLog
    .create({ data: { actorId, action: "PROSPECT_INTAKE", entity: "Engagement", entityId: eng.id, meta: code } })
    .catch(() => {});

  return { tenantId: tenant.id, engagementId: eng.id, proposalId: eng.proposal?.id ?? null, code };
}
