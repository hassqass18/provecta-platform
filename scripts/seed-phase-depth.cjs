/* Enrich the Sierra Homes demo engagement with deep, drill-down phase content:
   per-milestone detail + nested deliverables + documents filed under phases.
   Idempotent: clears prior seeded deliverables for the engagement, re-creates. */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const t = await p.tenant.findFirst({ where: { isDemo: true } });
  const e = await p.engagement.findFirst({ where: { tenantId: t.id }, orderBy: { createdAt: "desc" } });
  const ms = await p.milestone.findMany({ where: { engagementId: e.id }, orderBy: { orderIndex: "asc" } });
  const byTitle = Object.fromEntries(ms.map((m) => [m.title, m]));
  const docs = await p.document.findMany({ where: { engagementId: e.id } });
  const doc = (name) => docs.find((d) => d.name.toLowerCase().includes(name));

  const M1 = byTitle["Discovery & RevOps audit"];
  const M2 = byTitle["CRM architecture & build"];
  const M3 = byTitle["Lead-to-deal automation"];
  const M4 = byTitle["Enablement & handover"];

  // ── Milestone detail (the deep phase write-ups) ──────────────────────
  await p.milestone.update({
    where: { id: M1.id },
    data: {
      phaseSummary: "Diagnose the revenue engine end-to-end and quantify the leakage.",
      approvalStatus: "APPROVED",
      detail: [
        "## Discovery & Revenue Operations Audit",
        "",
        "The foundational phase. We mapped the full revenue engine — people, process, data, and tooling — across marketing, sales, and post-sale, then quantified where revenue leaks today.",
        "",
        "### What we did",
        "- 6 stakeholder interviews (sales, ops, finance, leadership)",
        "- Reviewed the existing pipeline, lead sources, and conversion data (trailing 12 months)",
        "- Audited the current CRM hygiene, field usage, and automation gaps",
        "- Built the revenue waterfall: lead → MQL → SQL → opportunity → closed-won",
        "",
        "### Key findings",
        "- **Lead leakage:** 38% of inbound leads had no owner within 48h — primary conversion drag.",
        "- **Data integrity:** 4 competing sources of truth; no single pipeline definition.",
        "- **Stage drift:** opportunities sat an avg. 21 days in 'Qualification' with no exit criteria.",
        "- **Reporting:** no reliable forecast — leadership flying blind on the back half of the quarter.",
        "",
        "### Recommendation",
        "Re-architect the CRM around a single revenue model with enforced stage gates, owner-on-create routing, and a clean lead-to-deal automation spine. Detailed in the next phase.",
      ].join("\n"),
    },
  });

  await p.milestone.update({
    where: { id: M2.id },
    data: {
      phaseSummary: "Design and build the CRM to operationalize the audit.",
      approvalStatus: "PENDING",
      detail: [
        "## CRM Architecture & Build",
        "",
        "Translating the audit into a working system. This phase defines the data model, pipeline, and automation, then builds it in your CRM.",
        "",
        "### Architecture decisions",
        "- **Single revenue object model:** Lead → Deal with a deterministic conversion (no duplicate sources of truth).",
        "- **Pipeline:** 6 stages with explicit entry/exit criteria and required fields per stage.",
        "- **Owner-on-create:** round-robin routing so no inbound lead is ever unowned.",
        "- **Custom fields:** 34 standardized fields backing the audit's scoring + forecast.",
        "",
        "### Build scope (in progress)",
        "- Stage gates + validation rules",
        "- Lead source attribution + UTM capture",
        "- Forecast + pipeline-health dashboards",
        "- Data migration + de-duplication from the 4 legacy sources",
        "",
        "Review the architecture deliverable below and approve to greenlight the build, or request changes with comments.",
      ].join("\n"),
    },
  });

  await p.milestone.update({
    where: { id: M3.id },
    data: {
      phaseSummary: "Automate the funnel from inbound lead to closed deal.",
      detail: [
        "## Lead-to-Deal Automation",
        "",
        "Wire the funnel so leads move themselves: capture → score → route → convert, with SLAs enforced at each hop.",
        "",
        "### Planned automations",
        "- Inbound capture from web forms + ad channels → normalized lead",
        "- Lead scoring (fit + intent) → auto-tier (A/B/C)",
        "- SLA routing: A-tier owned within 15 min, alerts on breach",
        "- Auto-convert qualified leads to deals with the correct stage + fields",
        "",
        "Kicks off once the CRM architecture (previous phase) is approved.",
      ].join("\n"),
    },
  });

  await p.milestone.update({
    where: { id: M4.id },
    data: {
      phaseSummary: "Train the team and hand over a self-sufficient revenue engine.",
      detail: [
        "## Enablement & Handover",
        "",
        "Make the team self-sufficient: SOPs, training, dashboards, and a clean handover so the system runs without us.",
        "",
        "### Deliverables",
        "- Role-based SOP pack (rep, manager, ops)",
        "- Live training sessions + recorded walkthroughs",
        "- Manager forecast + pipeline-health dashboards",
        "- 30-day hypercare + handover checklist",
      ].join("\n"),
    },
  });

  // ── Nested deliverables (idempotent re-seed) ─────────────────────────
  await p.deliverable.deleteMany({ where: { engagementId: e.id } });
  const D = (milestoneId, o) =>
    p.deliverable.create({ data: { engagementId: e.id, milestoneId, ...o } });

  await D(M1.id, {
    title: "Revenue Operations Audit Report",
    kind: "REPORT", version: "v1", isFinal: true, status: "DELIVERED",
    approvalStatus: "APPROVED", orderIndex: 0,
    documentId: doc("revops audit")?.id ?? null,
    detail: "The full audit: revenue waterfall, leakage quantification, data-integrity findings, and the prioritized remediation roadmap. Signed off by the client.",
  });
  await D(M1.id, {
    title: "Discovery Findings & Stakeholder Map",
    kind: "AUDIT", version: "v1", isFinal: true, status: "DELIVERED",
    approvalStatus: "APPROVED", orderIndex: 1,
    detail: "Synthesis of the 6 stakeholder interviews, current-state process maps, and the agreed single definition of the pipeline.",
  });

  await D(M2.id, {
    title: "CRM Architecture & Data Model",
    kind: "ARCHITECTURE", version: "v2", isFinal: false, status: "IN_PROGRESS",
    approvalStatus: "PENDING", orderIndex: 0,
    documentId: doc("architecture")?.id ?? null,
    detail: "The proposed object model, 6-stage pipeline with gates, 34-field schema, and routing design. Awaiting your approval to greenlight the build.",
  });
  await D(M2.id, {
    title: "CRM Build — Phase 1 (configuration)",
    kind: "BUILD", version: "v1", isFinal: false, status: "IN_PROGRESS",
    approvalStatus: "NONE", orderIndex: 1,
    detail: "Live configuration: stage gates, validation rules, attribution capture, and the first dashboards.",
  });

  await D(M3.id, {
    title: "Lead-to-Deal Automation Blueprint",
    kind: "ARCHITECTURE", version: "v1", isFinal: false, status: "IN_PROGRESS",
    approvalStatus: "NONE", orderIndex: 0,
    detail: "Scoring model, SLA routing rules, and the auto-conversion logic — staged for build after the CRM architecture is approved.",
  });

  await D(M4.id, {
    title: "Enablement & SOP Pack",
    kind: "DELIVERABLE", version: "v1", isFinal: false, status: "IN_PROGRESS",
    approvalStatus: "NONE", orderIndex: 0,
    detail: "Role-based SOPs, training materials, manager dashboards, and the 30-day hypercare + handover plan.",
  });

  // ── File documents under their phases ────────────────────────────────
  if (doc("revops audit")) await p.document.update({ where: { id: doc("revops audit").id }, data: { milestoneId: M1.id } });
  if (doc("architecture")) await p.document.update({ where: { id: doc("architecture").id }, data: { milestoneId: M2.id } });
  // MSA stays engagement-level (a contract, not phase-specific).

  const dcount = await p.deliverable.count({ where: { engagementId: e.id } });
  console.log(`Seeded: 4 milestone details + ${dcount} deliverables; documents filed under phases.`);
  await p.$disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
