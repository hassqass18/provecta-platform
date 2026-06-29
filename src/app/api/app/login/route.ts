import { NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signAppToken } from "@/lib/app-auth";

// Mobile login: email + password → argon2 verify → signed bearer token.
// Mirrors the Auth.js Credentials authorize() path but issues a token the
// native app stores in expo-secure-store. Generic error on any failure so we
// never reveal whether an email exists.

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { tenant: { select: { id: true, name: true } } },
  });
  const ok = user
    ? await verify(user.passwordHash, parsed.data.password).catch(() => false)
    : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (user.disabled) {
    return NextResponse.json({ error: "This account has been disabled. Contact Provecta Group." }, { status: 403 });
  }

  const token = signAppToken(user.id);
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId ?? null,
      tenantName: user.tenant?.name ?? null,
    },
  });
}
