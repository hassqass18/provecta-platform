import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

// Register an Expo push token for the signed-in user's device. Idempotent on the
// token (a device re-registers on every launch). Push fan-out (agent reply,
// milestone complete, document approved, invoice issued) reads these rows.
const schema = z.object({
  expoPushToken: z.string().trim().min(1).max(255),
  platform: z.enum(["ios", "android"]).optional(),
});

export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "expoPushToken required." }, { status: 400 });
  }

  await prisma.deviceToken.upsert({
    where: { expoPushToken: parsed.data.expoPushToken },
    create: {
      userId: user.id,
      tenantId: user.tenantId,
      expoPushToken: parsed.data.expoPushToken,
      platform: parsed.data.platform ?? "ios",
    },
    update: { userId: user.id, tenantId: user.tenantId, lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
