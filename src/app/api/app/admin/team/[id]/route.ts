import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Change a team member's role. SUPER_ADMIN / ADMIN only; can't change your own.
const schema = z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF", "CLIENT"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only an admin can change roles." }, { status: 403 });
  const { id } = await params;
  if (id === admin.id) return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ ok: true, role: parsed.data.role });
}
