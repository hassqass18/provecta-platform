import { NextResponse } from "next/server";
import * as zoho from "@/lib/zoho";

// Ported from pgco.world /api/revops-audit. Upsert Lead (39-field map) → tag →
// Campaigns list → optional Day-0 email → convert Lead to Deal (Qualification).

function buildLeadData(body: Record<string, string>, isPartial: boolean): Record<string, unknown> {
  const data: Record<string, unknown> = {
    First_Name: body.firstName,
    Last_Name: body.lastName || "(not provided)",
    Email: body.email,
    Phone: body.phone,
    Company: body.company,
    Designation: body.role,
    Website: body.website,
    Industry: body.industry,
    Lead_Source: "RevOps Audit",
    Lead_Status: isPartial ? "Partial Intake" : "New",
    Company_Headcount: body.companyHeadcount,
    Annual_Revenue_Range: body.annualRevenueRange,
    Business_Model: body.businessModel,
    Avg_Deal_Size: body.avgDealSize,
    Sales_Cycle_Length: body.salesCycleLength,
    Close_Rate: body.closeRate,
    Sales_Process_Status: body.salesProcessStatus,
    Current_CRM: body.currentCRM,
    CRM_Adoption: body.crmAdoption,
    Active_Deals_Count: body.activeDealsCount,
    Forecast_Confidence: body.forecastConfidence,
    Pipeline_Challenges: body.pipelineChallenges,
    Lead_Sources_Used: body.leadSourcesUsed,
    ICP_Status: body.icpStatus,
    Outbound_Motion: body.outboundMotion,
    Sales_Mktg_Alignment: body.salesMktgAlignment,
    Marketing_Automation: body.marketingAutomation,
    Revenue_Tools: body.revenueTools,
    Data_Quality: body.dataQuality,
    Revenue_Team_Size: body.revenueTeamSize,
    RevOps_Role_Status: body.revopsRoleStatus,
    Pipeline_Review_Cadence: body.pipelineReviewCadence,
    Revenue_Challenge: body.revenueChallenge,
    Previous_Attempts: body.previousAttempts,
    Six_Month_Goal: body.sixMonthGoal,
    Urgency_Level: body.urgencyLevel,
    Budget_Status: body.budgetStatus,
    Decision_Structure: body.decisionStructure,
    Preferred_Engagement: body.preferredEngagement,
    Audit_Trigger: body.auditTrigger,
    Additional_Context: body.additionalContext,
    Audit_Type: "RevOps Audit",
  };
  for (const k of Object.keys(data)) {
    if (data[k] === undefined || data[k] === null || data[k] === "") delete data[k];
  }
  if (!isPartial) {
    data.Description = [
      `RevOps Audit — ${new Date().toISOString().split("T")[0]}`,
      body.currentCRM && `CRM: ${body.currentCRM}`,
      body.avgDealSize && `Deal Size: ${body.avgDealSize}`,
      body.salesCycleLength && `Cycle: ${body.salesCycleLength}`,
      body.urgencyLevel && `Urgency: ${body.urgencyLevel}`,
      body.budgetStatus && `Budget: ${body.budgetStatus}`,
      body.revenueChallenge && `Challenge: ${String(body.revenueChallenge).slice(0, 300)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return data;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: zoho.CORS });
}

export async function POST(req: Request) {
  if (!zoho.zohoConfigured()) {
    return NextResponse.json({ error: "Zoho not configured" }, { status: 503, headers: zoho.CORS });
  }
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: zoho.CORS });

  const isPartial = body.stage === "partial";
  if (!body.firstName || !body.email || !body.company) {
    return NextResponse.json({ error: "Missing required fields: firstName, email, company" }, { status: 400, headers: zoho.CORS });
  }

  try {
    const token = await zoho.getAccessToken();
    const leadData = buildLeadData(body, isPartial);

    let leadId: string | null = body.leadId || null;
    let action = "created";

    if (!leadId && isPartial) {
      const existing = await zoho.findLeadByEmail(token, body.email);
      if (existing && existing.id) leadId = existing.id;
    }

    if (leadId) {
      await zoho.updateLead(token, leadId, leadData);
      action = "updated";
    } else {
      const created = await zoho.createLead(token, leadData);
      leadId = created?.data?.[0]?.details?.id ?? null;
      if (!leadId) return NextResponse.json({ error: "Lead creation failed", detail: created }, { status: 500, headers: zoho.CORS });
    }

    const sideEffects: Record<string, unknown> = { tag: null, campaigns: null, email: null, convert: null };

    try {
      const tags = ["revops-audit-inbound"];
      if (isPartial) tags.push("partial-intake");
      await zoho.addLeadTags(token, leadId, tags);
      sideEffects.tag = "ok";
    } catch (e) {
      sideEffects.tag = `error: ${(e as Error).message}`;
    }

    if (!isPartial) {
      try {
        const campaignsToken = await zoho.getCampaignsAccessToken();
        const listKey = process.env.ZOHO_CAMPAIGNS_LIST_KEY_REVOPS;
        if (listKey) {
          const result = await zoho.addContactToCampaignsList(campaignsToken, listKey, {
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            company: body.company,
            phone: body.phone,
          });
          sideEffects.campaigns = result?.status || "submitted";
        } else sideEffects.campaigns = "skipped: list key not set";
      } catch (e) {
        sideEffects.campaigns = `error: ${(e as Error).message}`;
      }

      try {
        const tmpl = process.env.ZOHO_DAY0_TEMPLATE_ID_REVOPS;
        if (tmpl) {
          await zoho.sendLeadEmail(token, leadId, tmpl, body.email, `${body.firstName} ${body.lastName || ""}`.trim());
          sideEffects.email = "sent";
        } else sideEffects.email = "skipped: no template";
      } catch (e) {
        sideEffects.email = `error: ${(e as Error).message}`;
      }

      try {
        const conv = await zoho.convertLead(token, leadId, {
          Deal_Name: `${body.company} — RevOps Audit`,
          Stage: "Qualification",
          Closing_Date: zoho.plusDays(30),
          Lead_Source: "RevOps Audit",
        });
        const r = conv?.data?.[0];
        sideEffects.convert =
          r && (r.Deals || r.code === "SUCCESS")
            ? { deal_id: r.Deals, account_id: r.Accounts, contact_id: r.Contacts }
            : `error: ${JSON.stringify(conv).slice(0, 250)}`;
      } catch (e) {
        sideEffects.convert = `error: ${(e as Error).message}`;
      }
    }

    return NextResponse.json({ success: true, id: leadId, action, stage: body.stage || "full", sideEffects }, { headers: zoho.CORS });
  } catch (err) {
    return NextResponse.json({ error: "Submission failed", detail: (err as Error).message }, { status: 500, headers: zoho.CORS });
  }
}
