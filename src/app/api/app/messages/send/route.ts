import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { sendComm } from "@/server/comms/send";
import { emitEvent } from "@/lib/events/emit";
import { processOneEvent } from "@/server/agent/process-one";

// The app IS the channel. A client message posts an inbound on the SAME spine
// the omnichannel webhook uses (Communication ledger + Ticket + INBOUND_TICKET
// DomainEvent → the bRRAIn agent drafts a reply → approve-first / autonomous).
// The only difference vs the public webhook: the sender is authenticated, so we
// resolve the tenant from the verified session — never from request-supplied
// identity. New channel value: APP.

const schema = z.object({ text: z.string().trim().min(1).max(4000) });
const CHANNEL = "APP";

export async function POST(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) {
    return NextResponse.json({ error: "no workspace linked to this account" }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message text required." }, { status: 400 });
  }
  const text = parsed.data.text;
  const subject = text.slice(0, 120);

  const engagement = await prisma.engagement.findFirst({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const ticket = await prisma.ticket.create({
    data: {
      tenantId: user.tenantId,
      engagementId: engagement?.id,
      subject,
      channel: CHANNEL,
      status: "OPEN",
      priority: "MEDIUM",
      autonomyState: "SUGGEST",
      proposedAction: "Triage pending — routed to Provecta.",
    },
  });
  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, author: "CLIENT", body: text },
  });

  // Log the inbound on the Communication ledger (the auditable record) and emit
  // the DomainEvent that wakes the agent loop.
  await sendComm({
    tenantId: user.tenantId,
    engagementId: engagement?.id ?? null,
    channel: CHANNEL,
    actorType: "CLIENT",
    body: text,
    direction: "IN",
  });
  const eventId = await emitEvent("INBOUND_TICKET", "Ticket", ticket.id, {
    channel: "app",
    tenantId: user.tenantId,
  });

  // Respond immediately, then run the agent right after (vital client comms get
  // a near-instant reply instead of waiting for the next scheduled tick). The
  // cron remains the safety net — processOneEvent claims the same DomainEvent,
  // so it can't be handled twice.
  after(async () => {
    try {
      await processOneEvent(eventId);
    } catch {
      // Best-effort: on any failure the event stays for the cron to retry.
    }
  });

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
