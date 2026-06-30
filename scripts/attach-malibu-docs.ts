/**
 * Attach the REAL deliverable files to the Grand Malibu deliverables so clients
 * + operators can view/download them from the web portal AND the mobile app.
 * Each file is stored in the back office (storeFile → Vercel Blob if keyed, else
 * DB FileBlob) and linked as a clientVisible Document on its deliverable.
 * Idempotent: skips a deliverable that already has documents.
 * Run: pnpm tsx scripts/attach-malibu-docs.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";
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
const BRAIN = "C:/Users/swozz/Documents/AI_Memory_Brain";
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".md": "text/markdown",
};

// deliverableId → files (relative to BRAIN). Landing Page / Meta Ads / R-010 have
// no downloadable artifact (live site / in progress / blocked) → no doc.
const MAP: Record<string, string[]> = {
  cmr08xx9z00077kgwzj8d71uw: [ // Brand Foundation Pack
    "projects/staging/SierraHomes_AmericanDream/Marketing/SierraHomes_MarketingStandards.pdf",
    "projects/staging/SierraHomes_AmericanDream/Marketing/SierraHomes_BuyerPersonas_M1_2026-03-30.docx",
  ],
  cmr08xyir000h7kgwfxqgaoo8: ["projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/brochures/SierraHomes_Brochure_HeroOverlay_FULL.pdf"],
  cmr08xyvc000l7kgwyzlmjos7: [ // 3D Render Library
    "projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/images/08_Render_Exterior_Angle1.jpg",
    "projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/images/09_Render_Exterior_Angle2.jpg",
    "projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/images/10_Render_Exterior_Angle3.jpg",
  ],
  cmr08xz1k000n7kgwc8su8oyk: [ // Floor Plans + Architectural Drawings
    "projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/floorplans/Plot-MN-I-1691-Nyali-Mombasa-Architectural-Drawings.pdf",
    "projects/staging/Karibu_KenyaRealEstate/inventory-archive/sierra-grand-malibu/images/02_FloorPlan_3BHK_Lincoln.jpg",
  ],
  cmr08y0a200117kgwatpnltjt: ["SierraHomes_GrandMalibu_ZohoSetup.xlsx"], // Zoho CRM
  cmr08y0gi00137kgw5qofi5fs: ["projects/staging/SierraHomes_AmericanDream/Marketing/Email/SierraHomes_WhatsApp_Cadence.md"], // WhatsApp
  cmr08y0mr00157kgwap6k7b6z: ["projects/staging/SierraHomes_AmericanDream/Marketing/Email/SierraHomes_Email_NurtureSequence.md"], // Email nurture
  cmr08y1i2001f7kgwsovpm9rl: ["projects/staging/SierraHomes_AmericanDream/Marketing/GTM/SierraHomes_GrandMalibu_Content_Calendar_12wk_2026.xlsx"], // Content calendar
  cmr08y342001v7kgweh00nig5: ["projects/staging/SierraHomes_AmericanDream/Marketing/GTM/SierraHomes_GrandMalibu_Outreach_Strategy.docx"], // Affiliate/broker
  cmr08y3ac001x7kgw9t1foaik: ["projects/staging/SierraHomes_AmericanDream/Marketing/GTM/SierraHomes_Coastal_Affiliate_Outreach_Priority_2026-06-08.md"], // Influencer roster
  cmr08y46e00277kgwfqn8w9px: ["projects/staging/SierraHomes_AmericanDream/Marketing/GTM/SierraHomes_90Day_Operational_Plan_2026-05-16.md"], // Reservation drive report
  cmr08y6a9002t7kgwn1gl8kd4: ["projects/staging/SierraHomes_AmericanDream/Investment/SierraHomes_InvestorDeck_2026-04-10.pdf"], // Investor deck
  cmr08y6gi002v7kgwerusjjqk: ["projects/staging/SierraHomes_AmericanDream/Investment/SierraHomes_KCB_FinanceBreakdown_2026-05-06.pdf"], // KCB financing
};

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { storeFile } = await import("../src/server/storage");

  const eng = await prisma.engagement.findUnique({ where: { code: "PRV-SUH-GM1" }, select: { id: true, tenantId: true } });
  if (!eng) { console.error("Engagement PRV-SUH-GM1 not found"); process.exit(1); }

  let created = 0, skipped = 0, missing = 0;
  for (const [deliverableId, files] of Object.entries(MAP)) {
    const d = await prisma.deliverable.findUnique({ where: { id: deliverableId }, select: { id: true, title: true, milestoneId: true } });
    if (!d) { console.log(`  ! deliverable ${deliverableId} not found — skip`); continue; }
    const have = await prisma.document.count({ where: { deliverableId } });
    if (have > 0) { console.log(`  = ${d.title} — already has ${have} doc(s), skip`); skipped++; continue; }

    for (const rel of files) {
      const abs = `${BRAIN}/${rel}`;
      if (!existsSync(abs)) { console.log(`  ✗ MISSING ${rel}`); missing++; continue; }
      const bytes = readFileSync(abs);
      const name = basename(rel);
      const mime = MIME[extname(rel).toLowerCase()] || "application/octet-stream";
      const stored = await storeFile(name, bytes, mime);
      await prisma.document.create({
        data: {
          tenantId: eng.tenantId, engagementId: eng.id, deliverableId, milestoneId: d.milestoneId,
          name, kind: "DOCUMENT", mimeType: mime, url: stored.ref, sizeBytes: stored.sizeBytes,
          isFinal: true, clientVisible: true, source: "HUMAN",
        },
      });
      created++;
      console.log(`  ✓ ${d.title}  ←  ${name} (${(bytes.length / 1024).toFixed(0)} KB)`);
    }
  }
  console.log(`\nDONE — ${created} documents attached, ${skipped} deliverables skipped (already had docs), ${missing} files missing.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 600)); process.exit(1); });
