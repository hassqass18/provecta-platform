import { prisma } from "@/lib/db";
import { readFile } from "@/server/storage";

/**
 * Per-engagement retrieval (P5). Assembles the grounding materials for a single
 * engagement from its own data: discovery transcripts + the TEXT of uploaded
 * documents (read back from object storage). This is the local, per-engagement
 * half of bRRAIn grounding — the org-wide half is `consultBrain` (bRRAIn git).
 *
 * Two trust modes:
 *  - internal (default): transcripts + ALL documents. For the generators
 *    (proposal / plan / deliverable) — operator-reviewed before anything ships.
 *  - clientSafe: shareable documents only (isFinal && clientVisible), NO
 *    transcripts. For the client-facing chat agent, so folding materials into
 *    its prompt can never leak internal discovery notes or unpublished docs.
 */

export interface MaterialsOptions {
  clientSafe?: boolean;
  maxChars?: number; // total budget across all pieces
  transcripts?: number; // max transcripts (internal mode only)
  docs?: number; // max documents to read text from
  perDocChars?: number; // cap per document
}

// Mime types / extensions we can decode straight to text. Binary formats
// (pdf, docx, images) are listed by name so the model knows they exist but
// aren't parsed here (no heavy parser dependency).
function isTextual(mime: string | null | undefined, name: string): boolean {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("text/")) return true;
  if (/(json|xml|csv|yaml|markdown|javascript|typescript)/.test(m)) return true;
  return /\.(md|markdown|txt|csv|tsv|json|ya?ml|xml|html?|log)$/i.test(name);
}

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 1024);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * Returns a single bounded plain-text grounding block for the engagement, or ""
 * when there is nothing to ground on. Never throws — storage misses degrade to a
 * name-only mention.
 */
export async function getEngagementMaterials(
  engagementId: string | null,
  tenantId: string,
  opts: MaterialsOptions = {},
): Promise<string> {
  const clientSafe = opts.clientSafe ?? false;
  const maxChars = opts.maxChars ?? 16000;
  const maxTranscripts = opts.transcripts ?? 4;
  const maxDocs = opts.docs ?? 6;
  const perDoc = opts.perDocChars ?? 4000;

  const parts: string[] = [];
  let used = 0;
  const push = (s: string) => {
    if (used >= maxChars) return;
    const slice = s.slice(0, maxChars - used);
    parts.push(slice);
    used += slice.length;
  };

  // Transcripts — internal only (discovery notes are not client-safe).
  if (!clientSafe) {
    const transcripts = await prisma.transcript.findMany({
      where: { OR: [{ engagementId: engagementId ?? undefined }, { tenantId }] },
      orderBy: { createdAt: "desc" },
      take: maxTranscripts,
    });
    for (const t of transcripts) {
      if (used >= maxChars) break;
      push(`# Transcript: ${t.title}\n${t.body}\n`);
    }
  }

  // Documents — shareable finals only in clientSafe mode, otherwise all.
  const docs = await prisma.document.findMany({
    where: {
      tenantId,
      ...(engagementId ? { engagementId } : {}),
      ...(clientSafe ? { isFinal: true, clientVisible: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: maxDocs,
    select: { name: true, kind: true, mimeType: true, url: true },
  });

  for (const d of docs) {
    if (used >= maxChars) break;
    if (isTextual(d.mimeType, d.name)) {
      const file = await readFile(d.url).catch(() => null);
      if (file && !looksBinary(file.bytes)) {
        push(`# Document: ${d.name} (${d.kind})\n${file.bytes.toString("utf8").slice(0, perDoc)}\n`);
        continue;
      }
    }
    // Binary or unreadable → name-only mention so the model knows it exists.
    push(`# Document: ${d.name} (${d.kind}${d.mimeType ? `, ${d.mimeType}` : ""}) — not text-extracted\n`);
  }

  return parts.join("\n").trim();
}
