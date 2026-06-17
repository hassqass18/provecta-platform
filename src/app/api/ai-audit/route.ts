import { NextResponse } from "next/server";
import * as zoho from "@/lib/zoho";

// Ported from pgco.world /api/ai-audit. Score → tier → upsert Lead → tags →
// AI Prospects Campaigns list → optional Day-0 email → convert to Deal.

const ADOPTION_LABELS: Record<string, string> = {
  none: "No AI adoption yet",
  few: "1-5 early adopters",
  some: "6-25 people (growing)",
  most: "Company-wide adoption",
};
const READINESS_LABELS: Record<string, string> = {
  nowhere: "Data is siloed/inaccessible",
  scattered: "Data exists but scattered",
  structured: "Structured, mostly clean",
  "ai-ready": "AI-ready data infrastructure",
};
const TIMELINE_LABELS: Record<string, string> = {
  now: "Ready to start now",
  soon: "Within 3-6 months",
  exploring: "Exploring options",
  future: "6-12+ months out",
};

function scoreToTier(score: number): { label: string; tag: string } {
  if (score >= 16) return { label: "Tier 1 – AI-Ready", tag: "tier-1-ai" };
  if (score >= 10) return { label: "Tier 2 – AI-Emerging", tag: "tier-2-ai" };
  if (score >= 5) return { label: "Tier 3 – AI-Aware", tag: "tier-3-ai" };
  return { label: "Tier 4 – AI-Unaware", tag: "tier-4-ai" };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: zoho.CORS });
}

export async function POST(req: Request) {
  if (!zoho.zohoConfigured()) {
    return NextResponse.json({ error: "Zoho not configured" }, { status: 503, headers: zoho.CORS });
  }
  const body = (await req.json().catch(() => null)) as
    | { firstName?: string; lastName?: string; email?: string; company?: string; role?: string; phone?: string; answers?: Record<string, string>; score?: number }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: zoho.CORS });

  const { firstName, lastName, email, company, role, phone, answers = {}, score = 0 } = body;
  if (!firstName || !email || !company) {
    return NextResponse.json({ error: "Missing required fields: firstName, email, company" }, { status: 400, headers: zoho.CORS });
  }

  try {
    const token = await zoho.getAccessToken();
    const adoptionLabel = ADOPTION_LABELS[answers.q1] || answers.q1 || "";
    const readinessLabel = READINESS_LABELS[answers.q4] || answers.q4 || "";
    const timelineLabel = TIMELINE_LABELS[answers.q7] || answers.q7 || "";
    const tier = scoreToTier(score);

    const leadData: Record<string, unknown> = {
      First_Name: firstName,
      Last_Name: lastName || "(not provided)",
      Email: email,
      Phone: phone,
      Company: company,
      Designation: role,
      Lead_Source: "AI Audit",
      Lead_Status: "New",
      AI_Adoption_Level: adoptionLabel,
      AI_Readiness_Score: String(score),
      AI_Readiness_Tier: tier.label,
      Implementation_Timeline: timelineLabel,
      Audit_Type: "AI Audit",
      Description: [
        "AI Memory Brain Assessment",
        `Score: ${score}/21 — ${tier.label}`,
        `AI Adoption: ${adoptionLabel}`,
        `Data Readiness: ${readinessLabel}`,
        `Timeline: ${timelineLabel}`,
        `Biggest Barrier: ${answers.q5 || "N/A"}`,
        `Primary Use Case: ${answers.q3 || "N/A"}`,
        `Success Metric: ${answers.q6 || "N/A"}`,
        `AI Tools Used: ${answers.q2 || "N/A"}`,
      ].join("\n"),
    };
    for (const k of Object.keys(leadData)) {
      if (leadData[k] === undefined || leadData[k] === null || leadData[k] === "") delete leadData[k];
    }

    let leadId = "";
    const existing = await zoho.findLeadByEmail(token, email);
    if (existing && existing.id) {
      leadId = existing.id;
      await zoho.updateLead(token, leadId, leadData);
    } else {
      const created = await zoho.createLead(token, leadData);
      leadId = created?.data?.[0]?.details?.id ?? "";
      if (!leadId) return NextResponse.json({ error: "Lead creation failed", detail: created }, { status: 500, headers: zoho.CORS });
    }

    const sideEffects: Record<string, unknown> = { tag: null, campaigns: null, email: null, convert: null };

    try {
      await zoho.addLeadTags(token, leadId, ["ai-audit-inbound", tier.tag]);
      sideEffects.tag = "ok";
    } catch (e) {
      sideEffects.tag = `error: ${(e as Error).message}`;
    }

    try {
      const campaignsToken = await zoho.getCampaignsAccessToken();
      const listKey = process.env.ZOHO_CAMPAIGNS_LIST_KEY_AI;
      if (listKey) {
        const result = await zoho.addContactToCampaignsList(campaignsToken, listKey, { firstName, lastName, email, company, phone });
        sideEffects.campaigns = result?.status || "submitted";
      } else sideEffects.campaigns = "skipped: list key not set";
    } catch (e) {
      sideEffects.campaigns = `error: ${(e as Error).message}`;
    }

    try {
      const tmpl = process.env.ZOHO_DAY0_TEMPLATE_ID_AI;
      if (tmpl) {
        await zoho.sendLeadEmail(token, leadId, tmpl, email, `${firstName} ${lastName || ""}`.trim());
        sideEffects.email = "sent";
      } else sideEffects.email = "skipped: no template";
    } catch (e) {
      sideEffects.email = `error: ${(e as Error).message}`;
    }

    try {
      const conv = await zoho.convertLead(token, leadId, {
        Deal_Name: `${company} — AMB ${tier.label}`,
        Stage: "Qualification",
        Closing_Date: zoho.plusDays(30),
        Lead_Source: "AI Audit",
      });
      const r = conv?.data?.[0];
      sideEffects.convert =
        r && (r.Deals || r.code === "SUCCESS")
          ? { deal_id: r.Deals, account_id: r.Accounts, contact_id: r.Contacts }
          : `error: ${JSON.stringify(conv).slice(0, 250)}`;
    } catch (e) {
      sideEffects.convert = `error: ${(e as Error).message}`;
    }

    return NextResponse.json({ success: true, id: leadId, tier: tier.label, score, sideEffects }, { headers: zoho.CORS });
  } catch (err) {
    return NextResponse.json({ error: "Submission failed", detail: (err as Error).message }, { status: 500, headers: zoho.CORS });
  }
}
