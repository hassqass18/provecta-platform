import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { postComment, type TargetType } from "@/server/collab";

const schema = z.object({
  targetType: z.enum(["MILESTONE", "DELIVERABLE", "DOCUMENT", "ENGAGEMENT"]),
  targetId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

// Staff reply on any thread from the admin cockpit → notifies the client.
export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });

  const { comment } = await postComment({
    targetType: parsed.data.targetType as TargetType,
    targetId: parsed.data.targetId,
    authorType: "STAFF",
    authorId: admin.id,
    authorName: admin.name ?? "Provecta",
    body: parsed.data.body,
  });

  return NextResponse.json({
    ok: true,
    comment: { id: comment.id, authorType: "STAFF", authorName: admin.name ?? "Provecta", body: comment.body, createdAt: comment.createdAt },
  });
}
