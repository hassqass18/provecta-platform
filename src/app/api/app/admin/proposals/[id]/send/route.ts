import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { sendProposal } from "@/server/proposal/send";

// Operator-gated proposal send (mobile/API front door). Mints a public accept
// token, marks SENT, and emails the prospect the link. Shared logic in
// server/proposal/send.ts (the web uses a server action over the same code).
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const r = await sendProposal(id, admin.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, status: "SENT", link: r.link, emailed: r.emailed, gated: r.gated });
}
