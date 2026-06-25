import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { createEnvelope } from "@/server/app-billing";

const schema = z.object({
  tenantId: z.string().min(1),
  engagementId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  signerName: z.string().trim().min(1).max(120),
  signerEmail: z.string().email(),
  docType: z.string().optional(),
  country: z.string().optional(),
});

// Admin drafts a contract (e-sign envelope) for a client.
export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Title, signer name and a valid email are required." }, { status: 400 });
  const env = await createEnvelope({
    tenantId: parsed.data.tenantId,
    engagementId: parsed.data.engagementId ?? null,
    title: parsed.data.title,
    signerName: parsed.data.signerName,
    signerEmail: parsed.data.signerEmail,
    docType: parsed.data.docType,
    country: parsed.data.country,
  });
  return NextResponse.json({ ok: true, id: env.id });
}
