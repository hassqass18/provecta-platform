/**
 * Test deleteTenant() against the lingering e2e test prospects (also cleans
 * them from prod). Targets tenants whose contact email is a test address.
 * Run: pnpm tsx scripts/test-delete-tenant.ts
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
  const { prisma } = await import("../src/lib/db");
  const { deleteTenant } = await import("../src/server/tenant/delete");

  const candidates = await prisma.tenant.findMany({
    where: { OR: [{ channelAddress: { contains: "example.com" } }, { channelAddress: { contains: "resend.dev" } }, { name: { contains: "Emailcheck" } }] },
    select: { id: true, name: true, channelAddress: true },
  });
  console.log("test tenants to delete:", candidates.map((c) => `${c.name} <${c.channelAddress}>`).join(" | ") || "(none)");

  for (const c of candidates) {
    const before = await prisma.engagement.count({ where: { tenantId: c.id } });
    const r = await deleteTenant(c.id);
    const stillThere = await prisma.tenant.findUnique({ where: { id: c.id }, select: { id: true } });
    console.log(`  ${c.name}: ${r.ok ? "deleted ✅" : "FAILED ❌ " + r.error} (had ${before} engagements, tenant now ${stillThere ? "STILL PRESENT" : "gone"})`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });
