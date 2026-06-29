/**
 * One-off P4 verification: runs the REAL draftDeliverable() code path (same as
 * the prod server action) against the prod DB for a single deliverable, prints
 * the result size + a preview, and persists it. Proves the LLM drafting engine
 * produces full content end-to-end. Run: pnpm tsx scripts/verify-p4-draft.ts
 */
import { readFileSync } from "node:fs";

// Load dev.local first (holds the ANTHROPIC key), then .env LAST so the prod
// DATABASE_URL wins over dev.local's separate dev-branch DB.
for (const f of [".env.development.local", ".env"]) {
  let raw = "";
  try { raw = readFileSync(f, "utf8"); } catch { continue; }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { draftDeliverable } = await import("../src/lib/brain");
  const { getEngagementMaterials } = await import("../src/server/rag/engagement-context");
  const { llmConfigured } = await import("../src/lib/llm/anthropic");

  console.log("llmConfigured:", llmConfigured(), "| model:", process.env.ANTHROPIC_MODEL || "(default)");

  const deliverableId = process.argv[2] || "cmqyqm9c60003l504n4bqgr87"; // GTM Current-State Audit
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { engagement: { include: { charter: true, tenant: { select: { id: true } } } } },
  });
  if (!d) { console.error("Deliverable not found:", deliverableId); process.exit(1); }

  const phase = d.milestoneId
    ? await prisma.milestone.findUnique({ where: { id: d.milestoneId }, select: { title: true } })
    : null;
  const materials = await getEngagementMaterials(d.engagementId, d.engagement.tenant.id, { maxChars: 14000 });

  console.log(`\nDrafting "${d.title}" (${d.kind}) — current detail: ${d.detail?.length ?? 0} chars`);
  const t0 = Date.now();
  const { detail, provider } = await draftDeliverable(
    {
      title: d.title,
      kind: d.kind as any,
      phaseTitle: phase?.title ?? null,
      engagementName: d.engagement.name,
      charter: d.engagement.charter,
      materials: materials || null,
    },
    { engagementId: d.engagementId }, // use prod defaults (55s budget / 52s per-request)
  );
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const isSkeleton = detail.includes("Draft skeleton — bRRAIn engine not keyed");
  console.log(`\n=== RESULT in ${secs}s ===`);
  console.log("provider(label):", provider, "| length:", detail.length, "chars | skeleton?", isSkeleton);
  console.log("\n--- first 900 chars ---\n" + detail.slice(0, 900));

  if (!isSkeleton && detail.length > 800) {
    await prisma.deliverable.update({ where: { id: d.id }, data: { detail } });
    console.log(`\n[persisted full draft to prod DB — ${detail.length} chars]`);
  } else {
    console.log("\n[NOT persisted — still skeleton/short]");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
