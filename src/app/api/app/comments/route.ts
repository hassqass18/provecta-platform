import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { resolveTarget, postComment, type TargetType } from "@/server/collab";

const schema = z.object({
  targetType: z.enum(["MILESTONE", "DELIVERABLE", "DOCUMENT", "ENGAGEMENT"]),
  targetId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

// Client posts a comment on a milestone / deliverable / document. The target
// must belong to the caller's tenant; the comment mirrors to the back office.
export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ error: "no workspace" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });

  const ref = await resolveTarget(parsed.data.targetType, parsed.data.targetId);
  if (!ref || ref.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { comment } = await postComment({
    targetType: parsed.data.targetType as TargetType,
    targetId: parsed.data.targetId,
    authorType: "CLIENT",
    authorId: user.id,
    authorName: user.name,
    body: parsed.data.body,
  });

  return NextResponse.json({
    ok: true,
    comment: { id: comment.id, authorType: "CLIENT", authorName: user.name, body: comment.body, createdAt: comment.createdAt },
  });
}
