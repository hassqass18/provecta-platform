import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { generateProposalForEngagement } from "@/server/proposal/generate";

// Operator/mobile: (re)generate the proposal body for an engagement, grounded on
// its research brief + transcript. Runs the LLM (~40s) — allow the full window.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    const r = await generateProposalForEngagement(id);
    return NextResponse.json({ ok: true, chars: r.chars, budgetMinor: r.budgetMinor });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation failed" }, { status: 400 });
  }
}
