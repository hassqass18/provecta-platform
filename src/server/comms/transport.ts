/**
 * Channel send adapters.
 *
 * Every provider is GATED: when the relevant credentials are not configured,
 * the send is a no-op that returns `{ sent: false, gated: true }`. This lets
 * the rest of the app reason about "would have sent" without a live provider,
 * and lets EMAIL/PORTAL be handled in-app elsewhere.
 *
 * No function throws — every provider call is wrapped so a network/provider
 * failure surfaces as `{ sent: false, error }` rather than propagating.
 */

export interface SendResult {
  sent: boolean;
  gated?: boolean;
  providerMessageId?: string;
  error?: string;
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function sendSlack(address: string, body: string): Promise<SendResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: false, gated: true };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: address, text: body }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; ts?: string; error?: string }
      | null;
    if (!res.ok || !data || data.ok !== true) {
      return { sent: false, error: data?.error || `slack http ${res.status}` };
    }
    return { sent: true, providerMessageId: data.ts };
  } catch (e) {
    return { sent: false, error: errMessage(e) };
  }
}

async function sendTelegram(address: string, body: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, gated: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: address, text: body }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: { message_id?: number }; description?: string }
      | null;
    if (!res.ok || !data || data.ok !== true) {
      return { sent: false, error: data?.description || `telegram http ${res.status}` };
    }
    const id = data.result?.message_id;
    return { sent: true, providerMessageId: id != null ? String(id) : undefined };
  } catch (e) {
    return { sent: false, error: errMessage(e) };
  }
}

async function sendWhatsApp(address: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { sent: false, gated: true };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: address,
        type: "text",
        text: { body },
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;
    if (!res.ok || !data || data.error) {
      return { sent: false, error: data?.error?.message || `whatsapp http ${res.status}` };
    }
    return { sent: true, providerMessageId: data.messages?.[0]?.id };
  } catch (e) {
    return { sent: false, error: errMessage(e) };
  }
}

/**
 * Send `body` to `address` on the given `channel`. Case-insensitive on channel.
 * EMAIL / PORTAL / unknown channels are gated (handled in-app elsewhere).
 */
export async function sendOnChannel(
  channel: string,
  address: string,
  body: string,
): Promise<SendResult> {
  switch (channel.toLowerCase()) {
    case "slack":
      return sendSlack(address, body);
    case "telegram":
      return sendTelegram(address, body);
    case "whatsapp":
      return sendWhatsApp(address, body);
    case "app":
      // The app channel delivers in-app (the Communication ledger the client
      // reads) + via Expo push (notifications/fanout) — no third-party token.
      return { sent: false, gated: true };
    case "email":
    case "portal":
    default:
      return { sent: false, gated: true };
  }
}
