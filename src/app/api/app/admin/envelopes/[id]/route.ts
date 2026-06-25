import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { envelopeAction } from "@/server/app-billing";

const schema = z.object({ action: z.enum(["SEND", "MARK_SIGNED", "DECLINE"]) });

// SEND is gated on an e-sign key (wet-ink jurisdictions excepted); MARK_SIGNED
// records a manual / wet-ink signature.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const r = await envelopeAction(id, parsed.data.action);
  return NextResponse.json(r);
}
