// Zoho CRM + Campaigns integration — ported from the pgco.world Netlify/Vercel
// functions (_zoho.js, 2026-05-10 Path B + Lead-to-Deal conversion). Gated: if
// the Zoho env vars are absent, zohoConfigured() is false and routes 503 gracefully.

const DC = process.env.ZOHO_DATA_CENTER || "com";

export function zohoConfigured(): boolean {
  return !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN);
}

async function refreshToken(refreshTokenValue: string): Promise<string> {
  const res = await fetch(
    `https://accounts.zoho.${DC}/oauth/v2/token?` +
      new URLSearchParams({
        refresh_token: refreshTokenValue,
        client_id: process.env.ZOHO_CLIENT_ID || "",
        client_secret: process.env.ZOHO_CLIENT_SECRET || "",
        grant_type: "refresh_token",
      }),
    { method: "POST" }
  );
  const body = await res.json();
  if (!body.access_token) throw new Error(`Zoho token refresh failed: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

export async function getAccessToken() {
  return refreshToken(process.env.ZOHO_REFRESH_TOKEN || "");
}
export async function getCampaignsAccessToken() {
  return refreshToken(process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN || "");
}

type Json = Record<string, unknown>;

export async function createLead(token: string, data: Json) {
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Leads`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: [data] }),
  });
  return res.json();
}

export async function updateLead(token: string, leadId: string, data: Json) {
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Leads/${leadId}`, {
    method: "PUT",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: [data] }),
  });
  return res.json();
}

export async function findLeadByEmail(token: string, email: string) {
  const params = new URLSearchParams({ criteria: `(Email:equals:${email})`, per_page: "1" });
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Leads/search?${params}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 204) return null;
  const body = await res.json();
  return (body && body.data && body.data[0]) || null;
}

export async function addLeadTags(token: string, leadId: string, tagNames: string[]) {
  const params = new URLSearchParams({ ids: leadId, tag_names: tagNames.join(","), over_write: "false" });
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Leads/actions/add_tags?${params}`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  return res.json();
}

export async function sendLeadEmail(token: string, leadId: string, templateId: string | undefined, toEmail: string, toName?: string) {
  if (!templateId) return null;
  const payload = {
    data: [
      {
        from: { user_name: "Hassan Qaseem", email: process.env.ZOHO_FROM_EMAIL || "hassan.qaseem@gc-usa.com" },
        to: [{ email: toEmail, user_name: toName || toEmail }],
        template: { id: templateId },
      },
    ],
  };
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v3/Leads/${leadId}/actions/send_mail`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function addContactToCampaignsList(
  token: string,
  listKey: string,
  contact: { firstName?: string; lastName?: string; email: string; company?: string; phone?: string }
) {
  const contactInfo = Object.assign(
    { "First Name": contact.firstName || "", "Last Name": contact.lastName || "", "Contact Email": contact.email },
    contact.company ? { "Company Name": contact.company } : {},
    contact.phone ? { Phone: contact.phone } : {}
  );
  const params = new URLSearchParams({
    resfmt: "JSON",
    listkey: listKey,
    contactinfo: JSON.stringify(contactInfo),
    source: "pgco.world",
  });
  const res = await fetch(`https://campaigns.zoho.${DC}/api/v1.1/json/listsubscribe?${params}`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  return res.json();
}

export async function convertLead(token: string, leadId: string, dealAttrs: Json | null, opts: Json = {}) {
  const payload = {
    data: [
      Object.assign(
        {
          overwrite: opts.overwrite ?? false,
          notify_lead_owner: opts.notify_lead_owner ?? false,
          notify_new_entity_owner: opts.notify_new_entity_owner ?? false,
        },
        opts.assign_to ? { assign_to: opts.assign_to } : {},
        dealAttrs ? { Deals: dealAttrs } : {}
      ),
    ],
  };
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Leads/${leadId}/actions/convert`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateDeal(token: string, dealId: string, data: Json) {
  const res = await fetch(`https://www.zohoapis.${DC}/crm/v2/Deals/${dealId}`, {
    method: "PUT",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: [data] }),
  });
  return res.json();
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
