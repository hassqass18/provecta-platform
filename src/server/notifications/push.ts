import { prisma } from "@/lib/db";

/**
 * Expo push delivery. Sends to the registered devices (DeviceToken) of the
 * given users via the Expo Push API — no SDK, just fetch. Best-effort: every
 * failure is swallowed so a push problem never breaks the action that triggered
 * it (the in-app Notification + Communication ledger remain the source of truth).
 */

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<void> {
  if (userIds.length === 0) return;
  const devices = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { expoPushToken: true },
  });
  await sendPushToTokens(
    devices.map((d) => d.expoPushToken),
    msg,
  );
}

export async function sendPushToTenantClients(tenantId: string, msg: PushMessage): Promise<void> {
  const clients = await prisma.user.findMany({
    where: { tenantId, role: "CLIENT" },
    select: { id: true },
  });
  await sendPushToUsers(
    clients.map((c) => c.id),
    msg,
  );
}

async function sendPushToTokens(tokens: string[], msg: PushMessage): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken"));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    title: msg.title,
    body: msg.body.length > 178 ? `${msg.body.slice(0, 175)}…` : msg.body,
    data: msg.data ?? {},
    sound: "default",
    priority: "high",
    channelId: "default",
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch {
      // best-effort delivery
    }
  }
}
