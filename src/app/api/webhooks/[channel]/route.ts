import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Omnichannel inbound: WhatsApp / Slack / Telegram / Discord / Email → ticket.
// Gated: if a channel token is configured, it is required; absent ⇒ open in dev.

const CHANNEL_TOKENS: Record<string, string | undefined> = {
  whatsapp: process.env.WHATSAPP_TOKEN,
  slack: process.env.SLACK_BOT_TOKEN,
  telegram: process.env.TELEGRAM_BOT_TOKEN,
  discord: process.env.DISCORD_BOT_TOKEN,
  email: process.env.EMAIL_INBOUND_TOKEN,
};
const VALID = ["whatsapp", "slack", "telegram", "discord", "email", "portal"];

export async function GET() {
  // Channel verification handshake (e.g. WhatsApp hub.challenge) lands here.
  return NextResponse.json({ status: "ready" });
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!VALID.includes(channel)) {
    return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  }

  const expected = CHANNEL_TOKENS[channel];
  if (expected && req.headers.get("x-provecta-token") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text ?? body.message ?? "");
  const subject = String(body.subject ?? text ?? "Inbound message").slice(0, 120) || "Inbound message";

  // Route to the client whose onboarded main channel + address matches the sender
  // — that channel is their designated point of contact / information source.
  const sender = String(body.from ?? body.sender ?? body.address ?? body.msisdn ?? "").trim();
  let tenant =
    sender && channel !== "portal"
      ? await prisma.tenant.findFirst({
          where: { preferredChannel: channel.toUpperCase(), channelAddress: sender },
        })
      : null;
  // Fallbacks: explicit tenantSlug, then the demo tenant.
  if (!tenant && body.tenantSlug) {
    tenant = await prisma.tenant.findUnique({ where: { slug: String(body.tenantSlug) } });
  }
  if (!tenant) tenant = await prisma.tenant.findFirst({ where: { isDemo: true } });
  if (!tenant) return NextResponse.json({ error: "no tenant" }, { status: 400 });

  const engagement = await prisma.engagement.findFirst({ where: { tenantId: tenant.id } });
  const ticket = await prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      engagementId: engagement?.id,
      subject,
      channel: channel.toUpperCase(),
      status: "OPEN",
      priority: "MEDIUM",
      autonomyState: "SUGGEST",
      proposedAction: "Triage pending — routed to Provecta.",
    },
  });
  if (text) {
    await prisma.ticketMessage.create({ data: { ticketId: ticket.id, author: "CLIENT", body: text } });
  }
  await prisma.auditLog.create({
    data: { action: "INBOUND_TICKET", entity: "Ticket", entityId: ticket.id, meta: channel },
  });
  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
