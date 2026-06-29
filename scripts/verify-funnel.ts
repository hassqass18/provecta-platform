/**
 * End-to-end acquisition-funnel verification against PROD (api + db):
 * prospect intake → research → proposal → send → accept (creds + activate) →
 * contract draft → release → client in-app sign. Drives the async jobs via the
 * agent-tick cron endpoint. Run: pnpm tsx scripts/verify-funnel.ts
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
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
const BASE = "https://www.pgco.world";
const CRON = process.env.CRON_SECRET!;

async function jpost(path: string, token: string | null, body: unknown) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, data: (await r.json().catch(() => null)) as any };
}
async function tick() {
  const r = await fetch(BASE + "/api/cron/agent-tick", { headers: { authorization: `Bearer ${CRON}` } });
  return (await r.json().catch(() => null)) as any;
}

async function main() {
  const { prisma } = await import("../src/lib/db");

  // 1. admin login
  const login = await jpost("/api/app/login", null, { email: "hassan.qaseem@gc-usa.com", password: "8CRpssMRZQxR" });
  const token = login.data?.token as string;
  console.log("1. admin login:", token ? "OK" : "FAIL");

  // 2. prospect intake
  const company = `Acme Robotics ${Math.random().toString(36).slice(2, 6)}`;
  const email = `prospect+${Math.random().toString(36).slice(2, 8)}@example.com`;
  const intake = await jpost("/api/app/admin/prospects", token, {
    company, contactName: "Dana Ng", contactEmail: email, domain: "acme.example",
    transcript: "Discovery: Acme Robotics scaling field-service ops across 3 regions. Pain: manual dispatch, no unified CRM, slow quote-to-cash, no analytics on technician utilization.",
  });
  const engagementId = intake.data?.engagementId as string;
  const tenantId = intake.data?.tenantId as string;
  console.log("2. prospect intake:", intake.status, "| engagement:", engagementId, "| code:", intake.data?.code);

  // 3-4. drain research → proposal (each ~45s). Loop ticks until no PENDING jobs.
  for (let i = 0; i < 5; i++) {
    const pending = await prisma.ingestJob.count({ where: { tenantId, status: "PENDING" } });
    const proposal = await prisma.proposal.findFirst({ where: { engagementId }, select: { id: true, bodyMd: true, status: true } });
    console.log(`   tick ${i}: pendingJobs=${pending} proposalChars=${proposal?.bodyMd?.length ?? 0}`);
    if (pending === 0 && proposal?.bodyMd) break;
    const t = await tick();
    console.log(`   → drained ${t?.drained} jobs:`, JSON.stringify(t?.results));
  }
  const research = await prisma.document.findFirst({ where: { engagementId, kind: "RESEARCH" }, select: { sizeBytes: true } });
  const proposal = await prisma.proposal.findFirst({ where: { engagementId } });
  console.log("3. research brief:", research ? `${research.sizeBytes} bytes ✅` : "MISSING ❌");
  console.log("4. proposal body:", proposal?.bodyMd ? `${proposal.bodyMd.length} chars, status=${proposal.status} ✅` : "MISSING ❌");

  // 5. send proposal (email gated → returns link)
  const send = await jpost(`/api/app/admin/proposals/${proposal!.id}/send`, token, {});
  const link = send.data?.link as string;
  const acceptToken = link?.split("/p/")[1];
  console.log("5. send:", send.status, "| emailed:", send.data?.emailed, "| gated:", send.data?.gated, "| token:", acceptToken?.slice(0, 8) + "…");

  // 6. public accept
  const accept = await jpost(`/api/p/${acceptToken}/accept`, null, {});
  console.log("6. accept:", accept.status, "| ok:", accept.data?.ok, "| client email:", accept.data?.email);
  const clientUser = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  const engAfter = await prisma.engagement.findUnique({ where: { id: engagementId }, select: { status: true } });
  const planned = await prisma.milestone.count({ where: { engagementId, source: "BRAIN" } });
  console.log(`   client user: ${clientUser ? clientUser.role + " ✅" : "MISSING ❌"} | engagement: ${engAfter?.status} | BRAIN milestones: ${planned}`);

  // 7. drain contract job (~45s)
  for (let i = 0; i < 4; i++) {
    const env = await prisma.envelope.findFirst({ where: { engagementId } });
    if (env) break;
    const t = await tick();
    console.log(`   contract tick ${i}: drained ${t?.drained}:`, JSON.stringify(t?.results));
  }
  const env = await prisma.envelope.findFirst({ where: { engagementId } });
  const contractDoc = await prisma.document.findFirst({ where: { engagementId, kind: "CONTRACT" }, select: { sizeBytes: true } });
  console.log("7. contract:", env ? `envelope=${env.status}, doc=${contractDoc?.sizeBytes ?? 0} bytes ✅` : "MISSING ❌");

  // 8. operator release
  const release = await jpost(`/api/app/admin/contracts/${env!.id}/release`, token, {});
  console.log("8. release:", release.status, "| envelope status:", release.data?.status);

  // 9. client signs in-app (set a known password to log in, then sign)
  await prisma.user.update({ where: { email }, data: { passwordHash: await hash("Test-1234") } });
  const clogin = await jpost("/api/app/login", null, { email, password: "Test-1234" });
  const ctoken = clogin.data?.token as string;
  const sign = await jpost(`/api/app/contracts/${env!.id}/sign`, ctoken, { signature: "Dana Ng", agree: true });
  const envFinal = await prisma.envelope.findUnique({ where: { id: env!.id }, select: { status: true, completedAt: true } });
  console.log("9. client sign:", sign.status, "| envelope:", envFinal?.status, envFinal?.completedAt ? "(completed) ✅" : "❌");

  console.log("\n=== FUNNEL E2E:", envFinal?.status === "SIGNED" ? "PASS ✅" : "incomplete", "===");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
