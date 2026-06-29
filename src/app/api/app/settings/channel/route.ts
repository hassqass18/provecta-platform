import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Client self-service: choose the main point of contact (and address) their
// releases are delivered on. "We use their email until the client says
// otherwise from inside their back office."
const CHANNELS = ["WHATSAPP", "EMAIL", "SLACK", "TELEGRAM", "OPEN"] as const;
const schema = z.object({
  preferredChannel: z.enum(CHANNELS),
  channelAddress: z.string().trim().max(200).optional(),
});

export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user || !user.tenantId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const t = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { preferredChannel: true, channelAddress: true } });
  return NextResponse.json({ preferredChannel: t?.preferredChannel ?? null, channelAddress: t?.channelAddress ?? null, channels: CHANNELS });
}

export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user || !user.tenantId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid channel is required." }, { status: 400 });

  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: { preferredChannel: parsed.data.preferredChannel, channelAddress: parsed.data.channelAddress || undefined },
  });
  await prisma.auditLog
    .create({ data: { actorId: user.id, action: "CLIENT_CHANNEL_SET", entity: "Tenant", entityId: user.tenantId, meta: parsed.data.preferredChannel } })
    .catch(() => {});
  return NextResponse.json({ ok: true, preferredChannel: parsed.data.preferredChannel });
}
