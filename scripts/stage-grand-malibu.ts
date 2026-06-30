/**
 * Stage "The Grand Malibu" (Sierra USA Homes) as a REAL engagement in the
 * Provecta back office from Sierra_Homes_Project_Staging_Handoff.md.
 * Idempotent on the engagement code. Creates the tenant, charter, M1–M6 +
 * D1–D7 milestones, deliverables, tasks, KPIs, and the two client logins.
 * Run: pnpm tsx scripts/stage-grand-malibu.ts
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
const CODE = "PRV-SUH-GM1";
const D = (s: string) => new Date(s + "T00:00:00Z");

type Del = { title: string; kind: string; status: "IN_PROGRESS" | "DELIVERED"; final: boolean };
type Tsk = { title: string; status: "TODO" | "IN_PROGRESS" | "DONE"; priority?: "LOW" | "MEDIUM" | "HIGH" };
type MS = { key: string; title: string; summary: string; status: string; due: string; deliverables?: Del[]; tasks?: Tsk[] };

const MILESTONES: MS[] = [
  { key: "M1", title: "Brand & Strategy Foundation", summary: "Personas, brand voice, messaging hierarchy", status: "COMPLETED", due: "2026-04-14",
    deliverables: [{ title: "Brand Foundation Pack (personas, voice, messaging)", kind: "DELIVERABLE", status: "DELIVERED", final: true }],
    tasks: [{ title: "Buyer personas (Diaspora Diana, Local Lucas)", status: "DONE" }, { title: "Messaging hierarchy & brand voice", status: "DONE" }, { title: "Brand system (Navy #1D235C, Gold #D4AF1A; Playfair + Inter)", status: "DONE" }] },
  { key: "M2", title: "Core Digital Assets Production", summary: "Landing page, brochure, video, renders, floor plans", status: "COMPLETED", due: "2026-05-15",
    deliverables: [{ title: "Sales Brochure (Hero Overlay)", kind: "DELIVERABLE", status: "DELIVERED", final: true }, { title: "Landing Page / Website", kind: "BUILD", status: "DELIVERED", final: true }, { title: "3D Render Library (exterior, amenities, interiors)", kind: "DELIVERABLE", status: "DELIVERED", final: true }, { title: "Floor Plans (1BR/2BR/3BR) + Architectural Drawings", kind: "ARCHITECTURE", status: "DELIVERED", final: true }],
    tasks: [{ title: "3D render library (exterior, amenities, unit interiors)", status: "DONE" }, { title: "Floor plans + architectural drawings", status: "DONE" }, { title: "Sales brochure", status: "DONE" }, { title: "Expo banners + roll-up + standalone print panels", status: "DONE" }, { title: "Landing page / website build", status: "DONE" }] },
  { key: "M3", title: "Sales & CRM Infrastructure", summary: "Zoho CRM pipeline, WhatsApp flow, email nurture", status: "COMPLETED", due: "2026-05-31",
    deliverables: [{ title: "Zoho CRM Pipeline + Lead Scoring", kind: "BUILD", status: "DELIVERED", final: true }, { title: "WhatsApp Cloud API Flow + Cadence", kind: "BUILD", status: "DELIVERED", final: true }, { title: "Email Nurture Sequence", kind: "DELIVERABLE", status: "DELIVERED", final: true }],
    tasks: [{ title: "Zoho CRM pipeline + lead scoring", status: "DONE" }, { title: "WhatsApp Cloud API flow + cadence", status: "DONE" }, { title: "Email nurture sequence (welcome → floor plans → investment case → closing)", status: "DONE" }] },
  { key: "M4", title: "Channel Setup & Campaign Launch", summary: "Meta, YouTube, LinkedIn, organic content live", status: "IN_PROGRESS", due: "2026-06-15",
    deliverables: [{ title: "12-Week Organic Content Calendar", kind: "DELIVERABLE", status: "IN_PROGRESS", final: false }, { title: "Meta Ads Funnel (Awareness → Retargeting → Lead Gen)", kind: "BUILD", status: "IN_PROGRESS", final: false }],
    tasks: [{ title: "Organic content calendar (12-week static/AI-first)", status: "IN_PROGRESS" }, { title: "Week 1 TikTok + Instagram posts", status: "IN_PROGRESS" }, { title: "Meta Ads funnel (Awareness → Retargeting → Lead Gen)", status: "TODO", priority: "HIGH" }, { title: "LinkedIn sponsored content (local professionals + investors)", status: "TODO" }, { title: "YouTube channel + hero video live", status: "TODO" }] },
  { key: "M5", title: "Diaspora Outreach", summary: "Diaspora packs, community outreach, virtual event", status: "IN_PROGRESS", due: "2026-06-30",
    deliverables: [{ title: "Affiliate / Broker Program (10 brokers in 90 days)", kind: "BUILD", status: "IN_PROGRESS", final: false }, { title: "Influencer Roster + Tiered Outreach", kind: "DELIVERABLE", status: "IN_PROGRESS", final: false }],
    tasks: [{ title: "Affiliate/broker program (10 brokers in 90 days; 1% influencer affiliate)", status: "IN_PROGRESS" }, { title: "Influencer roster + tiered outreach", status: "IN_PROGRESS" }, { title: "Virtual investor event (diaspora-Christmas window Q3)", status: "TODO" }] },
  { key: "M6", title: "Pre-Launch Reservation Drive", summary: "20+ reservations, full paid media active", status: "IN_PROGRESS", due: "2026-09-30",
    deliverables: [{ title: "Pre-Launch Reservation Drive — Pipeline & Attribution Report", kind: "REPORT", status: "IN_PROGRESS", final: false }],
    tasks: [{ title: "Paid media live; weekly pipeline review (Zoho)", status: "IN_PROGRESS", priority: "HIGH" }, { title: "Reservation tracking → SPA on permit (Lead_Source / Affiliate_Code / Lead_Score)", status: "TODO" }, { title: "Reach 20+ reservations before permit", status: "TODO", priority: "HIGH" }] },
  { key: "D1", title: "Structural / Mechanical Drawings Submission", summary: "Critical path (R-010) — BLOCKED; gates permits → construction", status: "BLOCKED", due: "2026-06-30",
    deliverables: [{ title: "Structural / Mechanical Drawings (R-010)", kind: "ARCHITECTURE", status: "IN_PROGRESS", final: false }],
    tasks: [{ title: "Unblock R-010 structural/mechanical drawings (critical path for permits)", status: "TODO", priority: "HIGH" }] },
  { key: "D2", title: "Permit Acquisition", summary: "Secure all critical permits (at risk)", status: "IN_PROGRESS", due: "2026-06-30" },
  { key: "D3", title: "Sales Campaign Completion", summary: "Phase 1 pre-launch campaign delivered", status: "IN_PROGRESS", due: "2026-06-30" },
  { key: "D4", title: "20+ Unit Reservations", summary: "Pre-permit reservation target", status: "PENDING", due: "2026-09-30" },
  { key: "D5", title: "Financial Close & Funding Secured", summary: "Close the ~KES 326M funding gap", status: "IN_PROGRESS", due: "2026-09-30",
    deliverables: [{ title: "Investor Deck + Returns Model", kind: "REPORT", status: "DELIVERED", final: true }, { title: "KCB Bank Financing Package (credit submission, deal economics, valuation, bios)", kind: "REPORT", status: "DELIVERED", final: true }],
    tasks: [{ title: "Investor deck + returns model", status: "DONE" }, { title: "KCB bank financing package", status: "DONE" }, { title: "Close ~KES 326M funding gap", status: "IN_PROGRESS", priority: "HIGH" }] },
  { key: "D6", title: "Site Mobilization & Ground-Breaking", summary: "Construction start", status: "PENDING", due: "2026-09-30" },
  { key: "D7", title: "Practical Completion (3 Towers)", summary: "36-month build → all 88 units", status: "PENDING", due: "2029-09-30" },
];

const KPIS = [
  { label: "Landing-page conversion (visitor→lead)", unit: "%", target: 5 },
  { label: "Email open rate (nurture sequence)", unit: "%", target: 22 },
  { label: "Meta cost-per-lead (KES)", unit: "$", target: 3000 },
  { label: "Pre-permit reservations", unit: "count", target: 20 },
  { label: "Signed SPAs (Phase 2)", unit: "count", target: 43 },
  { label: "Lead response time (target <60s)", unit: "score", target: 60 },
];

const CLIENTS = [
  { email: "sylharding@sierrahomesfl.com", name: "Sylvester Harding" },
  { email: "hatibuj@gmail.com", name: "Rajab Hatibu" },
];

async function main() {
  const { prisma } = await import("../src/lib/db");

  if (await prisma.engagement.findUnique({ where: { code: CODE } })) {
    console.log(`Engagement ${CODE} already exists — aborting to avoid duplicates.`);
    return prisma.$disconnect();
  }
  // Clean up any orphan tenant from a prior failed run (no engagements yet).
  const orphans = await prisma.tenant.findMany({ where: { name: "Sierra USA Homes" }, select: { id: true, _count: { select: { engagements: true } } } });
  for (const o of orphans) if (o._count.engagements === 0) await prisma.tenant.delete({ where: { id: o.id } });

  const tenant = await prisma.tenant.create({
    data: { name: "Sierra USA Homes", slug: `sierra-usa-homes-${randomBytes(2).toString("hex")}`, type: "CLIENT", preferredChannel: "EMAIL", channelAddress: CLIENTS[0].email },
  });

  const eng = await prisma.engagement.create({
    data: {
      tenantId: tenant.id,
      name: "The Grand Malibu — GTM & Pre-Launch",
      code: CODE,
      status: "ACTIVE",
      currency: "KES",
      budgetMinor: 0, // INT4 can't hold KES 909.9M in minor units — full financials live in the charter
      startDate: D("2026-04-01"),
      targetEndDate: D("2029-09-30"),
      summary:
        "Provecta delivers the go-to-market system + pre-launch reservation drive for The Grand Malibu (88-unit, 3-tower coastal development, Nyali, Mombasa). Brand → digital assets → Zoho CRM/RevOps → multi-channel launch → diaspora outreach → 20+ pre-permit reservations by Q3 2026. Guardrails: name 'The Grand Malibu'; pricing 'on request' externally; returns 'projected', never 'guaranteed'.",
      charter: {
        create: {
          sponsor: "Sylvester Harding — Sierra USA Homes (final approver)",
          objectives:
            "• 20+ pre-permit unit reservations by Q3 2026.\n• Complete structural/mechanical drawings (R-010) + secure critical permits by Q2 2026.\n• Close the ~KES 326M funding gap; hold cost within the KES 909.9M budget.\n• Deliver the Phase 1 pre-launch campaign by Q2 2026 (21+ off-plan sales).\n• Commence full construction Q3 2026; 36-month build to completion Q3 2029.",
          scope:
            "88 units / 3 towers: Lincoln (22×3BR), Washington (22×3BR), Benjamin–Franklin (22×2BR + 22×1BR), 11 floors each. Plot MN/I/1691, Nyali, Mombasa. Amenities: Rooftop Lounge & Restaurant (hero), pool, gym, play area, gardens, 24h security, private lift. For-sale off-plan; landowner equity 19 units + 69 developer units (15 pre-sold). Internal financials: dev cost KES 909.9M · projected revenue KES 1.5B · profit KES 716M · ROI 91.3% · funding gap ~KES 326M.",
          outOfScope: "Physical construction (Ecotecture Ltd) + architectural sign-off; buyer-facing pricing publication (external is always 'pricing on request').",
          successCriteria:
            "1) Permit approval Q2 2026; construction starts Q3 2026. 2) 20+ pre-permit reservations; 21+ off-plan sales by Q2 2026. 3) Close ~KES 326M funding gap; cost within 5% of KES 909.9M. 4) All drawings/permits via AI-draft → human-approve (CC/DE v2.0). 5) Practical completion of all 88 units by Q3 2029.",
        },
      },
    },
  });

  let mi = 0, dCount = 0, tCount = 0;
  for (const m of MILESTONES) {
    const ms = await prisma.milestone.create({
      data: { engagementId: eng.id, title: `${m.key} · ${m.title}`, phaseSummary: m.summary, status: m.status, dueDate: D(m.due), orderIndex: ++mi, clientVisible: true, source: "HUMAN" },
    });
    let di = 0;
    for (const d of m.deliverables ?? []) {
      await prisma.deliverable.create({ data: { engagementId: eng.id, milestoneId: ms.id, title: d.title, kind: d.kind, status: d.status, isFinal: d.final, clientVisible: true, orderIndex: ++di, approvalStatus: d.final ? "APPROVED" : "NONE" } });
      dCount++;
    }
    for (const t of m.tasks ?? []) {
      await prisma.task.create({ data: { engagementId: eng.id, milestoneId: ms.id, title: t.title, status: t.status, priority: t.priority ?? "MEDIUM", source: "HUMAN" } });
      tCount++;
    }
  }

  for (const k of KPIS) {
    await prisma.kpi.create({ data: { engagementId: eng.id, label: k.label, value: 0, unit: k.unit, target: k.target, source: "HUMAN" } });
  }

  const logins: { name: string; email: string; password: string }[] = [];
  for (const c of CLIENTS) {
    const email = c.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) { console.log(`  user ${email} already exists — skipped`); continue; }
    const password = `Malibu-${randomBytes(4).toString("hex")}`;
    await prisma.user.create({ data: { email, name: c.name, passwordHash: await hash(password), role: "CLIENT", tenantId: tenant.id } });
    logins.push({ name: c.name, email, password });
  }

  console.log(`\n=== STAGED: The Grand Malibu (${CODE}) ===`);
  console.log(`tenant=${tenant.id} engagement=${eng.id}`);
  console.log(`milestones=${mi} deliverables=${dCount} tasks=${tCount} kpis=${KPIS.length}`);
  console.log(`\nCLIENT LOGINS (share securely):`);
  for (const l of logins) console.log(`  ${l.name}: ${l.email}  /  ${l.password}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
