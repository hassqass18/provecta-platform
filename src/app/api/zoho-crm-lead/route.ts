import { NextResponse } from "next/server";
import * as zoho from "@/lib/zoho";

// Generic lead capture → Zoho CRM (contact form / book-a-session / newsletter).

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: zoho.CORS });
}

export async function POST(req: Request) {
  if (!zoho.zohoConfigured()) {
    return NextResponse.json({ error: "Zoho not configured" }, { status: 503, headers: zoho.CORS });
  }
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body || !body.email || !body.firstName) {
    return NextResponse.json({ error: "Missing required fields: firstName, email" }, { status: 400, headers: zoho.CORS });
  }

  try {
    const token = await zoho.getAccessToken();
    const leadData: Record<string, unknown> = {
      First_Name: body.firstName,
      Last_Name: body.lastName || "(not provided)",
      Email: body.email,
      Phone: body.phone,
      Company: body.company || "(individual)",
      Lead_Source: body.source || "Website",
      Lead_Status: "New",
      Description: body.message || "",
    };
    for (const k of Object.keys(leadData)) {
      if (leadData[k] === undefined || leadData[k] === null || leadData[k] === "") delete leadData[k];
    }

    let leadId = "";
    const existing = await zoho.findLeadByEmail(token, body.email);
    if (existing && existing.id) {
      leadId = existing.id;
      await zoho.updateLead(token, leadId, leadData);
    } else {
      const created = await zoho.createLead(token, leadData);
      leadId = created?.data?.[0]?.details?.id ?? "";
      if (!leadId) return NextResponse.json({ error: "Lead creation failed", detail: created }, { status: 500, headers: zoho.CORS });
    }
    try {
      await zoho.addLeadTags(token, leadId, [`source-${(body.source || "website").toLowerCase().replace(/\s+/g, "-")}`]);
    } catch {
      /* tag best-effort */
    }
    return NextResponse.json({ success: true, id: leadId }, { headers: zoho.CORS });
  } catch (err) {
    return NextResponse.json({ error: "Submission failed", detail: (err as Error).message }, { status: 500, headers: zoho.CORS });
  }
}
