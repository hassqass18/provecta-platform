import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { createProspect } from "@/server/proposal/intake";

// Prospect intake — the front door of the acquisition funnel (mobile/API). Fast,
// no-LLM: creates the prospect workspace + PROPOSED engagement + empty proposal,
// captures the transcript, enqueues RESEARCH (chains proposal generation).
const schema = z.object({
  company: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().email(),
  domain: z.string().trim().max(200).optional(),
  transcript: z.string().trim().max(50000).optional(),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Company and a valid contact email are required." }, { status: 400 });
  const r = await createProspect(parsed.data, admin.id);
  return NextResponse.json({ ok: true, ...r });
}
