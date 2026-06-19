import { prisma } from "@/lib/db";
import { assertBacked } from "@/lib/comms/honesty";
import type { ClaimKind, Backing } from "@/lib/comms/honesty";
import { sendComm } from "../comms/send";

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
