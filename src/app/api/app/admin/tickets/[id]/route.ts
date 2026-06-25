import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { ticketDetail, ticketAction } from "@/server/tickets";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const d = await ticketDetail(id);
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(d);
}

const schema = z.object({
  action: z.enum(["SET_STATUS", "SET_PRIORITY", "ASSIGN", "REPLY"]),
  value: z.string().nullable().optional(),
  body: z.string().max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const r = await ticketAction(id, parsed.data);
  return NextResponse.json(r);
}
