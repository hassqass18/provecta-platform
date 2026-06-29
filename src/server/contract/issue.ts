import { prisma } from "@/lib/db";
import { draftContract } from "@/lib/brain";
import { storeFile } from "@/server/storage";
import { notifyOperators } from "@/server/notifications/fanout";

/**
 * Draft the engagement agreement with bRRAIn and stage it for OPERATOR review
 * (internal, clientVisible:false) as a CONTRACT Document + a DRAFT Envelope.
 * The operator releases it for signature (own route) — operator-gated, like
 * every client-facing artifact. Enqueued on proposal acceptance.
 */
export async function runContractIssue(
  engagementId: string,
): Promise<{ documentId: string; envelopeId: string; provider: string; chars: number }> {
  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      charter: true,
      tenant: { select: { id: true, name: true, channelAddress: true } },
      deliverables: { select: { title: true, kind: true }, orderBy: { orderIndex: "asc" }, take: 20 },
      milestones: { select: { title: true, dueDate: true }, orderBy: { orderIndex: "asc" }, take: 12 },
    },
  });
  if (!eng) throw new Error(`engagement ${engagementId} not found`);

  const { bodyMd, provider } = await draftContract({
    clientName: eng.tenant.name,
    engagementName: eng.name,
    budgetMinor: eng.budgetMinor,
    currency: eng.currency,
    charter: eng.charter,
    deliverables: eng.deliverables,
    milestones: eng.milestones,
  });

  const stored = await storeFile("engagement-agreement.md", Buffer.from(bodyMd, "utf8"), "text/markdown");
  const doc = await prisma.document.create({
    data: {
      tenantId: eng.tenant.id,
      engagementId,
      name: `Engagement Agreement — ${eng.tenant.name}`,
      kind: "CONTRACT",
      mimeType: "text/markdown",
      url: stored.ref,
      sizeBytes: stored.sizeBytes,
      source: "AGENT",
      clientVisible: false, // operator reviews + releases before the client signs
    },
  });

  const contactName = eng.summary?.match(/contact:\s*([^<]+)</i)?.[1]?.trim() || eng.tenant.name;
  const envelope = await prisma.envelope.create({
    data: {
      tenantId: eng.tenant.id,
      engagementId,
      documentId: doc.id,
      title: `Engagement Agreement — ${eng.name}`,
      signerName: contactName,
      signerEmail: eng.tenant.channelAddress ?? "",
      status: "DRAFT",
      docType: "AGREEMENT",
    },
  });

  await prisma.auditLog
    .create({ data: { action: "CONTRACT_DRAFTED", entity: "Envelope", entityId: envelope.id, meta: `${provider} · ${bodyMd.length} chars` } })
    .catch(() => {});
  await notifyOperators("CONTRACT_READY", `Engagement agreement drafted for ${eng.tenant.name} — review and release for signature.`).catch(() => {});

  return { documentId: doc.id, envelopeId: envelope.id, provider, chars: bodyMd.length };
}
