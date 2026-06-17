import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "hassan.qaseem@gc-usa.com";
const DEMO_CLIENT_EMAIL = "demo.client@provecta.dev";
const DEMO_CLIENT_PASSWORD = "demo1234";
const STAFF_EMAIL = "staff@provecta.dev";
const STAFF_PASSWORD = "staff1234";

function genPassword(): string {
  return randomBytes(9).toString("base64url"); // ~12 chars, url-safe
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function reset() {
  // Wave 2–4 tables
  await prisma.brainQuery.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.envelope.deleteMany();
  await prisma.jurisdictionPolicy.deleteMany();
  await prisma.adoptionAssessment.deleteMany();
  await prisma.autonomyPolicy.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.portfolioItem.deleteMany();
  // children first (FK order)
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.charter.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.sla.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function main() {
  await reset();

  // ── Tenants ──────────────────────────────────────────────────────────
  const provecta = await prisma.tenant.create({
    data: { name: "Provecta Group", slug: "provecta", type: "INTERNAL" },
  });
  const sierra = await prisma.tenant.create({
    data: { name: "Sierra Homes Group", slug: "sierra-homes", type: "CLIENT", isDemo: true },
  });
  const decathlon = await prisma.tenant.create({
    data: { name: "Decathlon Africa", slug: "decathlon-africa", type: "CLIENT" },
  });

  // ── Users ────────────────────────────────────────────────────────────
  const adminPassword = genPassword();
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL.toLowerCase(),
      name: "Hassan Wilson",
      role: "SUPER_ADMIN",
      tenantId: provecta.id,
      passwordHash: await hash(adminPassword),
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      name: "Provecta Staff",
      role: "STAFF",
      tenantId: provecta.id,
      passwordHash: await hash(STAFF_PASSWORD),
    },
  });
  const demoClient = await prisma.user.create({
    data: {
      email: DEMO_CLIENT_EMAIL,
      name: "Sierra Homes (Demo Client)",
      role: "CLIENT",
      tenantId: sierra.id,
      passwordHash: await hash(DEMO_CLIENT_PASSWORD),
    },
  });

  // ── Demo engagement: Sierra Homes ────────────────────────────────────
  const eng = await prisma.engagement.create({
    data: {
      tenantId: sierra.id,
      name: "Sierra Homes — Revenue Operations Build",
      code: "PRV-SH-001",
      status: "ACTIVE",
      summary:
        "End-to-end RevOps build: CRM architecture, lead-to-deal automation, and an AI-assisted sales operations layer on bRRAIn.",
      budgetMinor: 4_200_000,
      currency: "USD",
      startDate: days(-45),
      targetEndDate: days(75),
      proposal: {
        create: {
          status: "APPROVED",
          amountMinor: 4_200_000,
          currency: "USD",
          bodyMd: "## Scope\nRevOps design, CRM build, automation, enablement.",
          sentAt: days(-60),
          approvedAt: days(-46),
        },
      },
      charter: {
        create: {
          objectives:
            "Stand up a single source of truth for revenue ops; cut manual handoffs by 60%; instrument pipeline KPIs.",
          scope: "CRM schema, lead capture, lead-to-deal conversion, dashboards, team enablement.",
          outOfScope: "Paid media management; ERP/finance migration.",
          sponsor: "Michael Kiarie (Sierra Homes)",
          successCriteria:
            "Live CRM with 100% lead capture; <5 min speed-to-lead; 4 exec KPIs dashboarded.",
        },
      },
    },
  });

  // Milestones
  const mDiscoveryDone = await prisma.milestone.create({
    data: {
      engagementId: eng.id,
      title: "Discovery & RevOps audit",
      description: "39-point audit, stakeholder interviews, current-state map.",
      status: "COMPLETED",
      orderIndex: 1,
      dueDate: days(-30),
      completedAt: days(-31),
    },
  });
  const mCrm = await prisma.milestone.create({
    data: {
      engagementId: eng.id,
      title: "CRM architecture & build",
      description: "Schema, custom fields, pipeline stages, automation rules.",
      status: "IN_PROGRESS",
      orderIndex: 2,
      dueDate: days(10),
    },
  });
  const mAutomation = await prisma.milestone.create({
    data: {
      engagementId: eng.id,
      title: "Lead-to-deal automation",
      description: "Web-to-lead, scoring, routing, auto-conversion to deals.",
      status: "PENDING",
      orderIndex: 3,
      dueDate: days(35),
    },
  });
  const mEnable = await prisma.milestone.create({
    data: {
      engagementId: eng.id,
      title: "Enablement & handover",
      description: "Team training, runbooks, go-live.",
      status: "PENDING",
      orderIndex: 4,
      dueDate: days(70),
    },
  });

  // Tasks
  await prisma.task.createMany({
    data: [
      { engagementId: eng.id, milestoneId: mCrm.id, title: "Define pipeline stages", status: "DONE", priority: "HIGH", assigneeId: staff.id },
      { engagementId: eng.id, milestoneId: mCrm.id, title: "Build custom field set (34)", status: "IN_PROGRESS", priority: "HIGH", assigneeId: staff.id, dueDate: days(4) },
      { engagementId: eng.id, milestoneId: mCrm.id, title: "Configure dashboards", status: "TODO", priority: "MEDIUM", dueDate: days(8) },
      { engagementId: eng.id, milestoneId: mAutomation.id, title: "Design scoring model", status: "TODO", priority: "MEDIUM", dueDate: days(20) },
    ],
  });

  // Deliverables + Documents (vault)
  await prisma.document.createMany({
    data: [
      { tenantId: sierra.id, engagementId: eng.id, name: "RevOps Audit Report (Final).pdf", kind: "DOCUMENT", version: 3, isFinal: true, sizeBytes: 1_840_000 },
      { tenantId: sierra.id, engagementId: eng.id, name: "CRM Architecture Diagram.png", kind: "MEDIA", version: 1, sizeBytes: 540_000 },
      { tenantId: sierra.id, engagementId: eng.id, name: "Master Services Agreement (Signed).pdf", kind: "CONTRACT", version: 1, isFinal: true, signed: true, sizeBytes: 320_000 },
    ],
  });
  await prisma.deliverable.create({
    data: { engagementId: eng.id, title: "RevOps Audit Report", version: "v3", isFinal: true },
  });

  // KPIs
  await prisma.kpi.createMany({
    data: [
      { engagementId: eng.id, label: "Project completion", value: 42, unit: "%", target: 100, trend: "UP" },
      { engagementId: eng.id, label: "Lead capture rate", value: 96, unit: "%", target: 100, trend: "UP" },
      { engagementId: eng.id, label: "Speed-to-lead", value: 7, unit: "min", target: 5, trend: "DOWN" },
      { engagementId: eng.id, label: "Budget used", value: 38, unit: "%", target: 100, trend: "FLAT" },
    ],
  });

  // SLAs
  await prisma.sla.createMany({
    data: [
      { engagementId: eng.id, metric: "Weekly status report", target: "Every Tue 10:00 EAT", actual: "On time", status: "MEETING" },
      { engagementId: eng.id, metric: "Blocker resolution", target: "< 24h", actual: "~18h avg", status: "MEETING" },
      { engagementId: eng.id, metric: "Ticket first response", target: "< 4h", actual: "~5h avg", status: "AT_RISK" },
    ],
  });

  // Invoices + payment
  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, number: "INV-2026-0001", status: "PAID",
      amountMinor: 2_100_000, currency: "USD", method: "STRIPE",
      issuedAt: days(-44), dueAt: days(-30), paidAt: days(-40),
    },
  });
  await prisma.payment.create({
    data: { invoiceId: inv1.id, amountMinor: 2_100_000, currency: "USD", method: "STRIPE", providerRef: "pi_demo_001" },
  });
  await prisma.invoice.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, number: "INV-2026-0002", status: "SENT",
      amountMinor: 1_050_000, currency: "USD", method: "STRIPE", issuedAt: days(-5), dueAt: days(9),
    },
  });

  // Tickets (omnichannel) + messages
  const t1 = await prisma.ticket.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, subject: "Can we add a field for referral source?",
      channel: "WHATSAPP", status: "OPEN", priority: "MEDIUM",
      proposedAction: "Add 'Referral Source' picklist to Leads + map to dashboard. Est. 30 min.",
      autonomyState: "AUTO_WITH_REVIEW",
    },
  });
  await prisma.ticketMessage.createMany({
    data: [
      { ticketId: t1.id, author: "CLIENT", body: "Hey — can we track where referrals come from?" },
      { ticketId: t1.id, author: "SYSTEM", body: "Proposed: add a 'Referral Source' picklist and surface it on the pipeline dashboard. Awaiting Provecta review." },
    ],
  });
  await prisma.ticket.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, subject: "When is the next status call?",
      channel: "PORTAL", status: "RESOLVED", priority: "LOW",
      proposedAction: "Auto-reply with next scheduled call (Tue 10:00 EAT).", autonomyState: "AUTONOMOUS",
    },
  });
  await prisma.ticket.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, subject: "Dashboard shows wrong currency",
      channel: "EMAIL", status: "IN_PROGRESS", priority: "HIGH",
      proposedAction: "Escalated to staff — currency formatting fix.", autonomyState: "SUGGEST",
    },
  });

  // A second client engagement (for admin multi-tenant view)
  await prisma.engagement.create({
    data: {
      tenantId: decathlon.id, name: "Decathlon Africa — GTM Operating Model", code: "PRV-DEC-001",
      status: "ACTIVE", summary: "Go-to-market operating model + analytics layer.",
      budgetMinor: 6_500_000, currency: "USD", startDate: days(-20), targetEndDate: days(120),
      kpis: { create: [{ label: "Project completion", value: 15, unit: "%", target: 100, trend: "UP" }] },
    },
  });

  // Notifications + audit
  await prisma.notification.createMany({
    data: [
      { userId: demoClient.id, type: "MILESTONE", body: "Milestone 'Discovery & RevOps audit' completed.", read: true },
      { userId: demoClient.id, type: "INVOICE", body: "Invoice INV-2026-0002 has been sent." },
    ],
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "SEED", entity: "System", meta: "Initial demo data seeded." },
  });

  // ── Ledger: chart of accounts + entries from the seeded invoices ─────
  await prisma.ledgerAccount.createMany({
    data: [
      { code: "1000", name: "Cash / Bank", type: "ASSET" },
      { code: "1100", name: "Accounts Receivable", type: "ASSET" },
      { code: "4000", name: "Consulting Revenue", type: "INCOME" },
      { code: "2100", name: "Taxes Payable", type: "LIABILITY" },
    ],
  });
  // INV-0001 paid: Dr Cash / Cr Revenue
  await prisma.journalEntry.create({
    data: {
      memo: "INV-2026-0001 paid (Stripe)", source: "PAYMENT", engagementId: eng.id,
      lines: { create: [
        { accountCode: "1000", debitMinor: 2_100_000 },
        { accountCode: "4000", creditMinor: 2_100_000 },
      ] },
    },
  });
  // INV-0002 sent: Dr AR / Cr Revenue
  await prisma.journalEntry.create({
    data: {
      memo: "INV-2026-0002 issued", source: "INVOICE", engagementId: eng.id,
      lines: { create: [
        { accountCode: "1100", debitMinor: 1_050_000 },
        { accountCode: "4000", creditMinor: 1_050_000 },
      ] },
    },
  });

  // ── E-sign: jurisdiction policy + a sample envelope ─────────────────
  await prisma.jurisdictionPolicy.createMany({
    data: [
      { country: "ZA", docType: "LAND_TRANSFER", requireWetInk: true, note: "South Africa: land/long-lease cannot be e-signed (ECTA s4(4))." },
      { country: "ZA", docType: "LONG_LEASE", requireWetInk: true, note: "Long lease > 10 years must be wet-ink." },
      { country: "US", docType: "AGREEMENT", requireWetInk: false },
      { country: "KE", docType: "AGREEMENT", requireWetInk: false },
    ],
  });
  await prisma.envelope.create({
    data: {
      tenantId: sierra.id, engagementId: eng.id, title: "Master Services Agreement", signerName: "Michael Kiarie",
      signerEmail: "michael@sierrahomes.example", country: "KE", docType: "AGREEMENT", status: "SIGNED",
      provider: "STUB", sentAt: days(-46), completedAt: days(-45),
    },
  });

  // ── Autonomy policies (the ramp) ────────────────────────────────────
  await prisma.autonomyPolicy.createMany({
    data: [
      { actionCategory: "milestone-status-reply", state: "AUTO_WITH_REVIEW", riskClass: "REVERSIBLE", approvedCount: 7, totalCount: 7, threshold: 10 },
      { actionCategory: "ticket-portal", state: "SUGGEST", riskClass: "REVERSIBLE", approvedCount: 2, totalCount: 3, threshold: 10 },
      { actionCategory: "invoice-charge", state: "SUGGEST", riskClass: "REGULATED", approvedCount: 0, totalCount: 0, threshold: 999 },
      { actionCategory: "contract-send", state: "SUGGEST", riskClass: "IRREVERSIBLE", approvedCount: 0, totalCount: 0, threshold: 999 },
    ],
  });

  // ── Change management (ADKAR) ───────────────────────────────────────
  await prisma.adoptionAssessment.createMany({
    data: [
      { engagementId: eng.id, stakeholder: "Sales team", awareness: 4, desire: 3, knowledge: 3, ability: 2, reinforcement: 2 },
      { engagementId: eng.id, stakeholder: "Leadership", awareness: 5, desire: 4, knowledge: 4, ability: 3, reinforcement: 3 },
    ],
  });

  // ── Marketing: portfolio + blog ─────────────────────────────────────
  await prisma.portfolioItem.createMany({
    data: [
      { slug: "decathlon-africa", name: "Soul of Decathlon — Africa", client: "Decathlon", summary: "GTM operating model and analytics layer across African markets.", sector: "Retail", location: "Africa", year: 2026, orderIndex: 1 },
      { slug: "jima-farm", name: "Jima Farm", client: "Jima", summary: "Operations digitization for a large agricultural estate.", sector: "Agriculture", location: "Kazakhstan", year: 2026, orderIndex: 2 },
      { slug: "sierra-homes", name: "Sierra Homes", client: "Ecotecture", summary: "Revenue operations + project management for a residential tower.", sector: "Real Estate", location: "Kenya", year: 2026, orderIndex: 3 },
      { slug: "karibu", name: "Karibu", client: "Karibu", summary: "Real-estate platform — CRM, deal room, and B2B data API.", sector: "PropTech", location: "Kenya", year: 2026, orderIndex: 4 },
      { slug: "frontier-atlas", name: "The Frontier Atlas", client: "Frontier Atlas", summary: "Knowledge and operations platform build.", sector: "Media", location: "Global", year: 2026, orderIndex: 5 },
      { slug: "round-robin-zendesk", name: "Round Robin (Zendesk)", client: "Confidential", summary: "Round-robin routing app within the Zendesk ecosystem.", sector: "SaaS", location: "Global", year: 2026, orderIndex: 6 },
    ],
  });
  await prisma.blogPost.createMany({
    data: [
      { slug: "first-business-operations-firm-on-brrain", title: "Why we became the first Business Operations firm built on bRRAIn", excerpt: "Operations is the new battleground for AI. Here's how Provecta builds custom solutions at a fraction of traditional cost.", body: "Full post body…", tags: "bRRAIn,operations,AI" },
      { slug: "ai-implementation-without-the-60pct-failure", title: "AI implementation without the 60% failure rate", excerpt: "Most AI projects are abandoned. The difference is change management — and a platform that proves adoption.", body: "Full post body…", tags: "change-management,ADKAR,adoption" },
      { slug: "single-source-of-truth-for-services-firms", title: "The single source of truth every services firm is missing", excerpt: "Engagement spine, client portal, autonomous back office — one record, many views.", body: "Full post body…", tags: "RevOps,portal,SSOT" },
    ],
  });

  // ── Write admin credentials to a gitignored local file ───────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const creds = `# Provecta Platform — Admin Credentials (LOCAL ONLY — gitignored)

> Generated by \`pnpm db:seed\`. Do not commit. Rotate before production.

- **URL:** ${appUrl}/login
- **Admin email:** ${ADMIN_EMAIL}
- **Admin password:** \`${adminPassword}\`
- **Role:** SUPER_ADMIN (complete control)

## Demo client login (for "view as client" demo)
- **Email:** ${DEMO_CLIENT_EMAIL}
- **Password:** \`${DEMO_CLIENT_PASSWORD}\`

## Staff login
- **Email:** ${STAFF_EMAIL}
- **Password:** \`${STAFF_PASSWORD}\`

_When a Resend key or live deploy exists, these admin credentials are emailed to ${ADMIN_EMAIL} automatically._
`;
  writeFileSync(new URL("../ADMIN-CREDENTIALS.local.md", import.meta.url), creds, "utf8");

  console.log("✓ Seed complete.");
  console.log(`  Admin:       ${ADMIN_EMAIL}  (password in ADMIN-CREDENTIALS.local.md)`);
  console.log(`  Demo client: ${DEMO_CLIENT_EMAIL} / ${DEMO_CLIENT_PASSWORD}`);
  console.log(`  Staff:       ${STAFF_EMAIL} / ${STAFF_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
