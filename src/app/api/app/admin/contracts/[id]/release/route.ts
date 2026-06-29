import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { releaseContract } from "@/server/contract/release";

// Operator releases a reviewed engagement agreement for signature (mobile/API
// front door). Shared logic in server/contract/release.ts. id = envelope id.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const r = await releaseContract(id, admin.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, status: r.status });
}
