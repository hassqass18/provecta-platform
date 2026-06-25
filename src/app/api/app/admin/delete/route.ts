import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Destructive: delete an engagement object. SUPER_ADMIN / ADMIN only.
const schema = z.object({
  entity: z.enum(["MILESTONE", "DELIVERABLE", "TASK", "DOCUMENT"]),
  id: z.string().min(1),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only an admin can delete." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { entity, id } = parsed.data;

  if (entity === "MILESTONE") {
    // Detach children first (tasks/deliverables/documents reference the milestone).
    await prisma.$transaction([
      prisma.task.updateMany({ where: { milestoneId: id }, data: { milestoneId: null } }),
      prisma.deliverable.updateMany({ where: { milestoneId: id }, data: { milestoneId: null } }),
      prisma.document.updateMany({ where: { milestoneId: id }, data: { milestoneId: null } }),
      prisma.milestone.delete({ where: { id } }),
    ]);
  } else if (entity === "DELIVERABLE") {
    await prisma.document.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } });
    await prisma.deliverable.delete({ where: { id } });
  } else if (entity === "TASK") {
    await prisma.task.delete({ where: { id } });
  } else {
    await prisma.document.delete({ where: { id } });
  }
  return NextResponse.json({ ok: true });
}
