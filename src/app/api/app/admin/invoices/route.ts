import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { createInvoice } from "@/server/app-billing";

const schema = z.object({
  tenantId: z.string().min(1),
  engagementId: z.string().optional(),
  amountMinor: z.number().int().positive(),
  currency: z.string().optional(),
  dueAt: z.string().optional(),
});

// Admin creates a DRAFT invoice for a client.
export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Amount and client are required." }, { status: 400 });
  const inv = await createInvoice({
    tenantId: parsed.data.tenantId,
    engagementId: parsed.data.engagementId ?? null,
    amountMinor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    dueAt: parsed.data.dueAt ?? null,
  });
  return NextResponse.json({ ok: true, id: inv.id, number: inv.number });
}
