import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Team roster (internal users). GET = all admin/staff; POST = add an operator.
export async function GET(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ team: users, canManage: isSuperAdmin(admin) });
}

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  role: z.enum(["STAFF", "ADMIN"]).optional(),
  password: z.string().min(6).max(100).optional(),
});

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only an admin can add team members." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }
  const tempPassword = parsed.data.password ?? `Provecta-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await hash(tempPassword);
  const user = await prisma.user.create({
    data: { email, name: parsed.data.name, passwordHash, role: parsed.data.role ?? "STAFF" },
  });
  return NextResponse.json({ ok: true, id: user.id, login: { email, password: tempPassword } });
}
