import { prisma } from "@/lib/db";
import { assertBacked } from "@/lib/comms/honesty";
import type { ClaimKind, Backing } from "@/lib/comms/honesty";
import { sendComm } from "../comms/send";
import { sendOnChannel } from "../comms/transport";
import { sendPushToUsers } from "./push";

// Deliver a client update on the tenant's CHOSEN channel (EMAIL via Resend,
// WhatsApp, Slack, Telegram). Gated providers no-op. APP/PORTAL/OPEN deliver
// in-app only (handled by the in-app notification + push elsewhere).
async function deliverOnPreferredChannel(tenantId: string, body: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { preferredChannel: true, channelAddress: true } });
  const channel = tenant?.preferredChannel?.toUpperCase();
  if (!channel || !tenant?.channelAddress || ["APP", "PORTAL", "OPEN"].includes(channel)) return;
  await sendOnChannel(channel, tenant.channelAddress, body).catch(() => {});
}

/**
 * Fan out an in-app Notification to every CLIENT user of a tenant.
 *
 * Email delivery (via RESEND) is gated → in-app only for now.
 */
export async function notifyTenantClients(
  tenantId: string,
  type: string,
  body: string
): Promise<void> {
  const clients = await prisma.user.findMany({
    where: { tenantId, role: "CLIENT" },
    select: { id: true },
  });

  if (clients.length === 0) return;

  await prisma.notification.createMany({
    data: clients.map((u) => ({ userId: u.id, type, body })),
  });

  // Mirror the in-app notification to the client's devices via push. The screen
  // hint deep-links the tap; updates land on Home, replies on Messages.
  const screen = /reply|message/i.test(type) ? "messages" : "home";
  await sendPushToUsers(
    clients.map((u) => u.id),
    { title: "Provecta", body, data: { screen } },
  );

  // Also deliver on the client's chosen external channel (email/WhatsApp/…).
  await deliverOnPreferredChannel(tenantId, body);
}

/**
 * Notify the operators (SUPER_ADMIN / ADMIN) in-app + via push. Used when the
 * autonomous funnel needs a human (a prospect accepted, a contract is ready to
 * review, a deliverable is awaiting approval).
 */
export async function notifyOperators(type: string, body: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({ data: admins.map((u) => ({ userId: u.id, type, body })) });
  await sendPushToUsers(admins.map((u) => u.id), { title: "Provecta — operator", body, data: { screen: "admin" } });
}

/**
 * Emit a client-facing update: log the outbound Communication and fan out an
 * in-app Notification to the tenant's CLIENT users.
 *
 * Honesty say-gate: if a `claim` is supplied, it must be backed by `backing`
 * (e.g. a real Payment / PAID invoice / SIGNED envelope). Unbacked money or
 * legal claims are never emitted.
 */
export async function emitClientUpdate(args: {
  tenantId: string;
  engagementId?: string | null;
  channel?: string;
  body: string;
  claim?: ClaimKind;
  backing?: Backing;
}): Promise<{ ok: boolean; reason?: string }> {
  if (args.claim) {
    const v = assertBacked(args.claim, args.backing ?? null);
    if (!v.ok) return { ok: false, reason: v.reason };
  }

  await sendComm({
    tenantId: args.tenantId,
    engagementId: args.engagementId ?? null,
    channel: args.channel ?? "PORTAL",
    actorType: "AGENT",
    body: args.body,
    direction: "OUT",
  });

  await notifyTenantClients(args.tenantId, "UPDATE", args.body);

  return { ok: true };
}
