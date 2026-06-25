import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { resolveTarget, postApproval } from "@/server/collab";

const schema = z.object({
  targetType: z.enum(["MILESTONE", "DELIVERABLE"]),
  targetId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  note: z.string().trim().max(2000).optional(),
});

// Client approves / rejects / requests changes on a milestone or deliverable.
// Updates the sign-off state and notifies the back office in real time.
export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ error: "no workspace" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval." }, { status: 400 });

  const ref = await resolveTarget(parsed.data.targetType, parsed.data.targetId);
  if (!ref || ref.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { status } = await postApproval({
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    decision: parsed.data.decision,
    note: parsed.data.note ?? null,
    actorType: "CLIENT",
    actorId: user.id,
    actorName: user.name,
  });

  return NextResponse.json({ ok: true, approvalStatus: status });
}
