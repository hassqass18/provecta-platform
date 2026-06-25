import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Admin adds a milestone / task / deliverable to an engagement.
const schema = z.object({
  entity: z.enum(["MILESTONE", "TASK", "DELIVERABLE"]),
  engagementId: z.string().min(1),
  milestoneId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  detail: z.string().max(20000).optional(),
  kind: z.string().optional(),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { entity, engagementId, milestoneId, title, detail, kind } = parsed.data;

  const eng = await prisma.engagement.findUnique({ where: { id: engagementId }, select: { id: true } });
  if (!eng) return NextResponse.json({ error: "engagement not found" }, { status: 404 });

  if (entity === "MILESTONE") {
    const count = await prisma.milestone.count({ where: { engagementId } });
    const m = await prisma.milestone.create({
      data: { engagementId, title, detail: detail ?? null, status: "PENDING", orderIndex: count, source: "HUMAN" },
    });
    return NextResponse.json({ ok: true, id: m.id });
  }
  if (entity === "TASK") {
    const t = await prisma.task.create({
      data: { engagementId, milestoneId: milestoneId ?? null, title, status: "TODO", source: "HUMAN" },
    });
    return NextResponse.json({ ok: true, id: t.id });
  }
  const count = await prisma.deliverable.count({ where: { engagementId } });
  const d = await prisma.deliverable.create({
    data: { engagementId, milestoneId: milestoneId ?? null, title, detail: detail ?? null, kind: kind ?? "DELIVERABLE", status: "IN_PROGRESS", orderIndex: count },
  });
  return NextResponse.json({ ok: true, id: d.id });
}
