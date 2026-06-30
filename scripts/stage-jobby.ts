/**
 * Stage the "Jobby" client engagement into the Provecta back office.
 * Idempotent: re-running cleanly re-stages only Jobby's own records.
 * Creates NO client user (portal credentials are added later).
 * Excludes internal-only docs (equity memo, reserve term sheet).
 *
 * Run:  node --env-file=.env --import tsx scripts/stage-jobby.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JOBBY_DIR = "C:/Users/swozz/Documents/AI_Memory_Brain/projects/staging/Jobby";
const SLUG = "jobby";
const CODE = "PRV-JOB-001";
const d = (iso: string) => new Date(iso + "T12:00:00Z");

async function fileDoc(name: string, relPath: string, mime: string) {
  const bytes = readFileSync(`${JOBBY_DIR}/${relPath}`);
  const fb = await prisma.fileBlob.create({
    data: { name, contentType: mime, sizeBytes: bytes.length, data: new Uint8Array(bytes) },
  });
  return { ref: `db:${fb.id}`, sizeBytes: bytes.length };
}

async function cleanup(tenantId: string) {
  const eng = await prisma.engagement.findUnique({ where: { code: CODE } });
  if (!eng) return;
  // collect db:<id> FileBlobs referenced by this engagement's documents, delete them after
  const docs = await prisma.document.findMany({ where: { engagementId: eng.id }, select: { url: true } });
  const blobIds = docs.map((x) => x.url).filter((u): u is string => !!u && u.startsWith("db:")).map((u) => u.slice(3));
  await prisma.ticket.deleteMany({ where: { engagementId: eng.id } });
  await prisma.document.deleteMany({ where: { engagementId: eng.id } });
  await prisma.deliverable.deleteMany({ where: { engagementId: eng.id } });
  await prisma.task.deleteMany({ where: { engagementId: eng.id } });
  await prisma.milestone.deleteMany({ where: { engagementId: eng.id } });
  await prisma.kpi.deleteMany({ where: { engagementId: eng.id } });
  await prisma.sla.deleteMany({ where: { engagementId: eng.id } });
  await prisma.charter.deleteMany({ where: { engagementId: eng.id } });
  await prisma.invoice.deleteMany({ where: { engagementId: eng.id } });
  await prisma.engagement.delete({ where: { id: eng.id } });
  if (blobIds.length) await prisma.fileBlob.deleteMany({ where: { id: { in: blobIds } } });
}

async function main() {
  // ── Tenant (upsert by slug) ──────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: "Jobby Technologies Ltd", type: "CLIENT", isDemo: false, preferredChannel: "EMAIL" },
    create: { name: "Jobby Technologies Ltd", slug: SLUG, type: "CLIENT", isDemo: false, preferredChannel: "EMAIL" },
  });

  await cleanup(tenant.id);

  // ── Engagement + Charter ─────────────────────────────────────────────
  const eng = await prisma.engagement.create({
    data: {
      tenantId: tenant.id,
      name: "Jobby — Platform Rebuild & Cost Optimization",
      code: CODE,
      status: "ACTIVE",
      summary:
        "Took Jobby off Replit and onto an owned, scalable stack; removed the AI token-cost blow-up (1,000-candidate pass $616 → $3.88, ~99.4%); built the workforce, M-Pesa wage rail, and gig-data credit rails. Now in the legal/commercial and production-migration phase.",
      budgetMinor: 0,
      currency: "USD",
      startDate: d("2026-06-12"),
      targetEndDate: d("2026-09-30"),
      charter: {
        create: {
          objectives:
            "Remove the existential token-cost curve; give Jobby an owned, portable platform; lay the workforce, payments, and credit rails that turn a hiring app into a financial platform.",
          scope:
            "Cost re-architecture (extract-once → embed → rerank → score → sort); greenfield build (matching, Jobby Work, Kenya payroll, M-Pesa B2C rail, gig-data credit engine); legal/commercial agreements; production migration; phased go-live.",
          outOfScope:
            "Live lending before CBK Digital Credit Provider licensing; production payroll before accountant statutory sign-off; data transfer offshore without DPA 2019 basis.",
          sponsor: "Jobby Technologies Ltd",
          successCriteria:
            "AI scoring cost down ~99%; platform owned and portable; mutual NDA + Non-Compete executed; production go-live of hiring + Jobby Work; credit product sequenced behind licensing.",
        },
      },
    },
  });

  // ── Milestones ───────────────────────────────────────────────────────
  const mk = (o: any) => prisma.milestone.create({ data: { engagementId: eng.id, source: "HUMAN", clientVisible: true, ...o } });
  const m1 = await mk({ title: "Research & Optimization Audit", description: "Diagnose the token-cost problem to its root; specify the fix.", status: "COMPLETED", orderIndex: 1, dueDate: d("2026-06-20"), completedAt: d("2026-06-20"), phaseSummary: "Cost problem traced to an O(n²) re-scan; fix specified." });
  const m2 = await mk({ title: "Greenfield Platform Build", description: "Owned Next.js/Postgres stack implementing the full value chain.", status: "COMPLETED", orderIndex: 2, dueDate: d("2026-06-24"), completedAt: d("2026-06-24"), phaseSummary: "Built, tested, deployed in demo/owned mode." });
  const m3 = await mk({ title: "Legal & Commercial Agreements", description: "Balanced, Kenya-enforceable mutual NDA + Non-Compete; stakeholder packet delivered.", status: "IN_PROGRESS", orderIndex: 3, dueDate: d("2026-07-15"), phaseSummary: "Packet delivered; awaiting counsel review + execution." });
  const m4 = await mk({ title: "Production Provisioning & Data Migration", description: "Stand up production DB, connect live integrations, migrate Replit data.", status: "PENDING", orderIndex: 4, dueDate: d("2026-07-31"), phaseSummary: "Move from demo to live production." });
  const m5 = await mk({ title: "Statutory & Regulatory Readiness", description: "Accountant statutory sign-off; data-protection + lending licensing.", status: "PENDING", orderIndex: 5, dueDate: d("2026-08-31"), phaseSummary: "PAYE/NSSF/SHIF/AHL sign-off; ODPC; CBK DCP." });
  const m6 = await mk({ title: "Phased Go-Live", description: "Hiring + Jobby Work first; then wage disbursement; then credit behind licensing.", status: "PENDING", orderIndex: 6, dueDate: d("2026-09-30"), phaseSummary: "Sequenced production launch." });

  // ── Tasks ────────────────────────────────────────────────────────────
  const T = (milestoneId: string, title: string, status: string, priority: string, dueDate?: string) =>
    ({ engagementId: eng.id, milestoneId, title, status, priority, source: "HUMAN", ...(dueDate ? { dueDate: d(dueDate) } : {}) });
  await prisma.task.createMany({
    data: [
      T(m1.id, "Diagnose token-cost problem (O(n²) re-scan)", "DONE", "HIGH"),
      T(m1.id, "Deliver Research & Optimization Audit", "DONE", "HIGH"),
      T(m1.id, "Correct investor market/statutory figures", "DONE", "MEDIUM"),
      T(m2.id, "Build extract→embed→rerank→score→sort funnel", "DONE", "HIGH"),
      T(m2.id, "Build Jobby Work reliability loop", "DONE", "MEDIUM"),
      T(m2.id, "Build Kenya payroll engine (PAYE/NSSF/SHIF/AHL)", "DONE", "MEDIUM"),
      T(m2.id, "Build M-Pesa B2C wage rail + WhatsApp adapters", "DONE", "HIGH"),
      T(m2.id, "Build gig-data credit engine", "DONE", "MEDIUM"),
      T(m2.id, "Deploy demo + /preview stakeholder walkthrough", "DONE", "MEDIUM"),
      T(m3.id, "Deliver Stakeholder Packet (briefing + NDA + non-compete)", "DONE", "HIGH"),
      T(m3.id, "Client + Kenyan counsel review of agreements", "TODO", "HIGH", "2026-07-08"),
      T(m3.id, "Fill bracketed fields + Schedule 1 in agreements", "TODO", "HIGH", "2026-07-08"),
      T(m3.id, "Execute mutual NDA + Non-Compete", "TODO", "HIGH", "2026-07-15"),
      T(m4.id, "Confirm + export Jobby data from Replit", "TODO", "HIGH", "2026-07-18"),
      T(m4.id, "Provision production Neon DB + set DATABASE_URL", "TODO", "MEDIUM", "2026-07-22"),
      T(m4.id, "Connect live M-Pesa Daraja + messaging credentials", "TODO", "MEDIUM", "2026-07-25"),
      T(m4.id, "Migrate data into owned platform", "TODO", "MEDIUM", "2026-07-31"),
      T(m5.id, "Accountant signs off statutory table (PAYE/NSSF/SHIF/AHL)", "TODO", "HIGH", "2026-08-10"),
      T(m5.id, "ODPC data-protection registration (both parties)", "TODO", "MEDIUM", "2026-08-20"),
      T(m5.id, "CBK Digital Credit Provider licensing (before lending)", "TODO", "MEDIUM", "2026-08-31"),
      T(m6.id, "Go live: hiring + Jobby Work", "TODO", "HIGH", "2026-09-10"),
      T(m6.id, "Enable M-Pesa wage disbursement", "TODO", "MEDIUM", "2026-09-20"),
      T(m6.id, "Sequence credit product behind CBK licence", "TODO", "LOW", "2026-09-30"),
    ],
  });

  // ── Deliverables ─────────────────────────────────────────────────────
  const dl = (o: any) => prisma.deliverable.create({ data: { engagementId: eng.id, clientVisible: true, ...o } });
  const dAudit = await dl({ milestoneId: m1.id, title: "Research & Optimization Audit", kind: "AUDIT", version: "v1", isFinal: true, status: "DELIVERED", orderIndex: 1 });
  const dBuild = await dl({ milestoneId: m2.id, title: "Build Plan & Target Architecture", kind: "ARCHITECTURE", version: "v1", isFinal: true, status: "DELIVERED", orderIndex: 2 });
  const dImpl = await dl({ milestoneId: m2.id, title: "Implementation Plan & Rollout", kind: "BUILD", version: "v1", isFinal: true, status: "DELIVERED", orderIndex: 3 });
  const dPacket = await dl({ milestoneId: m3.id, title: "Stakeholder Packet (Briefing + NDA + Non-Compete)", kind: "REPORT", version: "v2", isFinal: true, status: "DELIVERED", orderIndex: 4 });
  const dSummary = await dl({ milestoneId: m3.id, title: "Engagement Summary", kind: "REPORT", version: "v1", isFinal: true, status: "DELIVERED", orderIndex: 5 });

  // ── Documents (real bytes; client-facing only) ───────────────────────
  const MD = "text/markdown";
  const docs: Array<{ name: string; rel: string; mime: string; kind: string; milestoneId?: string; deliverableId?: string; isFinal?: boolean }> = [
    { name: "Jobby — Stakeholder Packet.pdf", rel: "Jobby_Stakeholder_Packet.pdf", mime: "application/pdf", kind: "DOCUMENT", milestoneId: m3.id, deliverableId: dPacket.id, isFinal: true },
    { name: "Mutual NDA (draft).md", rel: "Legal/NDA_Mutual.md", mime: MD, kind: "CONTRACT", milestoneId: m3.id },
    { name: "Non-Compete & Non-Circumvention (draft).md", rel: "Legal/Non-Compete_Non-Circumvention.md", mime: MD, kind: "CONTRACT", milestoneId: m3.id },
    { name: "Stakeholder Briefing.md", rel: "Jobby_Stakeholder_Briefing.md", mime: MD, kind: "DOCUMENT", milestoneId: m3.id },
    { name: "Engagement Summary — What We Did.md", rel: "Jobby_Engagement_Summary.md", mime: MD, kind: "DOCUMENT", milestoneId: m3.id, deliverableId: dSummary.id },
    { name: "Research & Optimization Audit.md", rel: "Jobby_bRRAIn_01_Research_and_Optimization_Audit.md", mime: MD, kind: "RESEARCH", milestoneId: m1.id, deliverableId: dAudit.id, isFinal: true },
    { name: "Build Plan & Target Architecture.md", rel: "Jobby_bRRAIn_02_Build_Plan.md", mime: MD, kind: "DOCUMENT", milestoneId: m2.id, deliverableId: dBuild.id, isFinal: true },
    { name: "Implementation Plan & Rollout.md", rel: "Jobby_bRRAIn_03_Implementation_Plan.md", mime: MD, kind: "DOCUMENT", milestoneId: m2.id, deliverableId: dImpl.id, isFinal: true },
  ];
  for (const x of docs) {
    const stored = await fileDoc(x.name, x.rel, x.mime);
    await prisma.document.create({
      data: {
        tenantId: tenant.id, engagementId: eng.id, name: x.name, kind: x.kind, mimeType: x.mime,
        milestoneId: x.milestoneId ?? null, deliverableId: x.deliverableId ?? null,
        url: stored.ref, sizeBytes: stored.sizeBytes, isFinal: !!x.isFinal, clientVisible: true, source: "HUMAN",
      },
    });
  }

  // ── KPIs ─────────────────────────────────────────────────────────────
  await prisma.kpi.createMany({
    data: [
      { engagementId: eng.id, label: "Engagement progress", value: 40, unit: "%", target: 100, trend: "UP" },
      { engagementId: eng.id, label: "AI scoring cost reduction", value: 99.4, unit: "%", target: 99, trend: "UP" },
      { engagementId: eng.id, label: "Platform build", value: 100, unit: "%", target: 100, trend: "FLAT" },
      { engagementId: eng.id, label: "Cost per 1,000-candidate pass", value: 3.88, unit: "$", target: 5, trend: "DOWN" },
    ],
  });

  const counts = {
    tenant: tenant.name,
    engagement: eng.code,
    milestones: await prisma.milestone.count({ where: { engagementId: eng.id } }),
    tasks: await prisma.task.count({ where: { engagementId: eng.id } }),
    deliverables: await prisma.deliverable.count({ where: { engagementId: eng.id } }),
    documents: await prisma.document.count({ where: { engagementId: eng.id } }),
    kpis: await prisma.kpi.count({ where: { engagementId: eng.id } }),
  };
  console.log("✓ Jobby staged:", JSON.stringify(counts, null, 2));
  console.log("  Tenant:", tenant.id, "| Engagement:", eng.id);
  console.log("  No client user created (portal credentials deferred). Internal equity/partnership docs excluded.");
}

main()
  .catch((e) => { console.error("STAGE-JOBBY ERROR:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
