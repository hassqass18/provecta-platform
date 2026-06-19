/**
 * P1A integration test — exercises the GitBrainSource client + ingest against
 * the REAL brain repo (read-only; writes nothing to the repo). Requires the
 * GITHUB_BRAIN_TOKEN / BRAIN_REPO_* env (gitignored dev env).
 */
import { prisma } from "../src/lib/db";
import { brainGitConfig, brainGitConfigured, listDir, getFileText } from "../src/lib/brain-git";
import { ingestTenantFinals } from "../src/server/brain/ingest";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };

async function main() {
  const cfg = brainGitConfig();
  if (!brainGitConfigured() || !cfg) { console.log("brain git not configured — skipping"); return; }

  // 1) live API: list the client folders under pathPrefix
  const top = await listDir(cfg, cfg.pathPrefix);
  const dirs = top.filter((e) => e.type === "dir").map((e) => e.name);
  if (dirs.length === 0) fail("listDir returned no folders under pathPrefix");
  else console.log(`  listDir(${cfg.pathPrefix}) → ${dirs.length} folders (e.g. ${dirs.slice(0, 3).join(", ")})`);

  // 2) live API: fetch + decode a known file
  const text = await getFileText(cfg, `${cfg.pathPrefix}/ProvectaGroup/Master-Context.md`);
  if (!text || !/Provecta/i.test(text)) fail("getFileText did not return decoded Master-Context content");
  else console.log(`  getFileText → ${text.length} chars decoded ok`);

  // 3) ingest pipeline against a real folder (idempotent, no-crash)
  const slug = "brain-ingest-test";
  const folder = "ProvectaGroup";
  await prisma.document.deleteMany({ where: { tenant: { slug } } });
  await prisma.tenant.deleteMany({ where: { slug } });
  const t = await prisma.tenant.create({ data: { name: "Brain Ingest Test", slug, type: "CLIENT", isDemo: true, brainFolder: folder } });

  const r1 = await ingestTenantFinals(t.id);
  console.log(`  ingest #1: finalsFound=${r1.finalsFound} created=${r1.created} updated=${r1.updated} unchanged=${r1.unchanged}`);
  const r2 = await ingestTenantFinals(t.id);
  console.log(`  ingest #2 (idempotent): created=${r2.created} unchanged=${r2.unchanged}`);
  if (r2.created !== 0) fail("ingest not idempotent — 2nd run created rows");

  // any created brain docs must be clientVisible=false (await approval)
  const leaked = await prisma.document.count({ where: { tenantId: t.id, source: "BRAIN", clientVisible: true } });
  if (leaked > 0) fail(`${leaked} brain doc(s) are clientVisible=true (should await approval)`);

  // cleanup
  await prisma.document.deleteMany({ where: { tenantId: t.id } });
  await prisma.tenant.delete({ where: { id: t.id } });

  if (failures) { console.error(`test-brain-ingest: ${failures} failure(s)`); process.exit(1); }
  console.log("test-brain-ingest: PASS — client lists/fetches real repo; ingest is idempotent and approval-gated.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
