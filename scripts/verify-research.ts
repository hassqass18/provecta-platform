/**
 * Verify the prospect-research generator (Phase A). Calls auditProspect with the
 * real Claude web_search tool and prints provider/size/timing/sources. No DB
 * writes. Run: pnpm tsx scripts/verify-research.ts
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

async function main() {
  const { auditProspect } = await import("../src/server/research/provider");
  const { llmConfigured } = await import("../src/lib/llm/anthropic");
  console.log("llmConfigured:", llmConfigured(), "| RESEARCH_WEB:", process.env.RESEARCH_WEB || "(on)");

  const t0 = Date.now();
  const r = await auditProspect({
    company: "Decathlon",
    domain: "decathlon.com",
    contact: "Head of Africa Operations",
    transcript:
      "Discovery: Decathlon wants a GTM operating model across 5 priority African markets. Pain: fragmented analytics, no single CRM source of truth, slow time-to-insight by region.",
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== RESULT in ${secs}s ===`);
  console.log("provider:", r.provider, "| chars:", r.briefMd.length, "| signals:", r.signals.length, "| sources:", r.sources.length);
  console.log("signals:", r.signals.slice(0, 6));
  console.log("sources:", r.sources.slice(0, 4).map((s) => s.url));
  console.log("\n--- first 800 chars ---\n" + r.briefMd.slice(0, 800));
}
main().catch((e) => { console.error(e); process.exit(1); });
