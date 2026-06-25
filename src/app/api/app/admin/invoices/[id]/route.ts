import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { invoiceAction } from "@/server/app-billing";

const schema = z.object({ action: z.enum(["SEND", "MARK_PAID", "VOID"]) });

// SEND is gated on a payments key; MARK_PAID records a manual/out-of-band payment.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const r = await invoiceAction(id, parsed.data.action);
  return NextResponse.json(r);
}
