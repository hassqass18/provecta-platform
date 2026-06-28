import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Capture a consultation note / call transcript / discovery write-up. Feeds the
// proposal generator (Brain · Proposals) and seeds the engagement context.
const schema = z.object({
  tenantId: z.string().optional(),
  engagementId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100000),
  source: z.enum(["UPLOAD", "DISCOVERY_CALL", "EMAIL"]).optional(),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });

  const t = await prisma.transcript.create({
    data: {
      tenantId: parsed.data.tenantId ?? null,
      engagementId: parsed.data.engagementId ?? null,
      title: parsed.data.title,
      body: parsed.data.body,
      source: parsed.data.source ?? "DISCOVERY_CALL",
    },
  });
  return NextResponse.json({ ok: true, id: t.id });
}
