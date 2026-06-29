/**
 * Safe E2E for the transcript-upload-at-intake feature. Simulates what
 * createClient() does with an uploaded transcript file — store bytes → Document
 * → decode text → Transcript — then confirms the text surfaces in the
 * per-engagement RAG materials. Creates a throwaway tenant and DELETES
 * everything it made. Run: pnpm tsx scripts/verify-upload-intake.ts
 */
import { readFileSync } from "node:fs";
for (const f of [".env.development.local", ".env"]) {
  let raw = ""; try { raw = readFileSync(f, "utf8"); } catch { continue; }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

// Copy of crud.ts decodeTextFile (private to a "use server" file) for parity.
function decodeTextFile(bytes: Buffer, mime: string, name: string): string | null {
  const m = mime.toLowerCase();
  const textual = m.startsWith("text/") || /(json|xml|csv|yaml|markdown)/.test(m) ||
    /\.(md|markdown|txt|text|csv|tsv|json|ya?ml|xml|html?|log|vtt|srt|rtf)$/i.test(name);
  if (!textual) return null;
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return null;
  const text = bytes.toString("utf8").trim();
  return text.length ? text.slice(0, 200000) : null;
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { storeFile } = await import("../src/server/storage");
  const { getEngagementMaterials } = await import("../src/server/rag/engagement-context");

  // Unit-check decode: a binary buffer (PNG header w/ NUL) must be rejected.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]);
  console.log("decode rejects binary (.png w/ NUL):", decodeTextFile(png, "image/png", "x.png") === null ? "PASS" : "FAIL");
  console.log("decode accepts .vtt transcript:", decodeTextFile(Buffer.from("WEBVTT\n\n00:01 hello"), "", "call.vtt") ? "PASS" : "FAIL");

  const tenant = await prisma.tenant.create({ data: { name: "ZZ Upload Test", slug: `zz-upload-test-${Math.random().toString(36).slice(2, 7)}`, type: "CLIENT" } });
  const created = { transcripts: [] as string[], documents: [] as string[], blobs: [] as string[] };
  try {
    const fname = "decathlon-discovery-call.txt";
    const body = "DISCOVERY CALL — Decathlon Africa\nGoal: stand up a GTM operating model across 5 priority markets.\nConstraint: fragmented analytics, no single CRM source of truth.\nUnique marker: ZEBRA-7741.";
    const bytes = Buffer.from(body, "utf8");
    const stored = await storeFile(fname, bytes, "text/plain");
    if (stored.ref.startsWith("db:")) created.blobs.push(stored.ref.slice(3));
    const doc = await prisma.document.create({ data: { tenantId: tenant.id, name: fname, kind: "TRANSCRIPT", mimeType: "text/plain", url: stored.ref, sizeBytes: stored.sizeBytes, source: "HUMAN", clientVisible: false } });
    created.documents.push(doc.id);
    const text = decodeTextFile(bytes, "text/plain", fname);
    const tr = await prisma.transcript.create({ data: { tenantId: tenant.id, title: fname.replace(/\.[^.]+$/, ""), body: text!, source: "UPLOAD" } });
    created.transcripts.push(tr.id);

    console.log("Document created:", doc.kind, "| ref:", stored.ref.slice(0, 12) + "…", "| size:", stored.sizeBytes);
    console.log("Transcript created from file:", tr.title, "| body", tr.body.length, "chars");

    const materials = await getEngagementMaterials(null, tenant.id, { maxChars: 8000 });
    const grounded = materials.includes("ZEBRA-7741");
    console.log("\nTranscript text surfaces in engagement RAG materials:", grounded ? "PASS ✅" : "FAIL ❌");
    console.log("materials excerpt:", JSON.stringify(materials.slice(0, 120)));
  } finally {
    for (const id of created.transcripts) await prisma.transcript.delete({ where: { id } }).catch(() => {});
    for (const id of created.documents) await prisma.document.delete({ where: { id } }).catch(() => {});
    for (const id of created.blobs) await prisma.fileBlob.delete({ where: { id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    console.log("\n[cleanup] removed throwaway tenant + transcript + document + blob");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
