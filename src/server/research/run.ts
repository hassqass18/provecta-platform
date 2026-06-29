import { prisma } from "@/lib/db";
import { storeFile } from "@/server/storage";
import { getEngagementMaterials } from "@/server/rag/engagement-context";
import { auditProspect, type ResearchInput } from "./provider";

/**
 * Run prospect research for a tenant/engagement and persist the brief as an
 * internal `RESEARCH` Document (clientVisible:false) so it (a) lands in the
 * operator's review surface and (b) grounds the proposal generator via
 * getEngagementMaterials. Bounded LLM call (~50s) — safe inside the 60s cap.
 */
export async function runProspectResearch(args: {
  tenantId: string;
  engagementId?: string | null;
  input: Omit<ResearchInput, "transcript"> & { transcript?: string | null };
}): Promise<{ documentId: string; provider: string; chars: number }> {
  // Ground on the engagement's own discovery material when no transcript passed.
  let transcript = args.input.transcript ?? null;
  if (!transcript) {
    transcript = (await getEngagementMaterials(args.engagementId ?? null, args.tenantId, { maxChars: 9000 })) || null;
  }

  const result = await auditProspect({ ...args.input, transcript });

  const stored = await storeFile(
    "prospect-research-brief.md",
    Buffer.from(result.briefMd, "utf8"),
    "text/markdown",
  );
  const doc = await prisma.document.create({
    data: {
      tenantId: args.tenantId,
      engagementId: args.engagementId ?? null,
      name: `Prospect Research Brief — ${args.input.company}`,
      kind: "RESEARCH",
      mimeType: "text/markdown",
      url: stored.ref,
      sizeBytes: stored.sizeBytes,
      source: "AGENT",
      clientVisible: false,
    },
  });
  await prisma.auditLog
    .create({
      data: {
        action: "PROSPECT_RESEARCHED",
        entity: "Document",
        entityId: doc.id,
        meta: `${result.provider} · ${result.briefMd.length} chars · ${result.signals.length} signals`,
      },
    })
    .catch(() => {});
  return { documentId: doc.id, provider: result.provider, chars: result.briefMd.length };
}
