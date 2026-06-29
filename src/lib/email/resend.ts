/**
 * Outbound email via Resend. GATED on RESEND_API_KEY — when unset, returns
 * { sent:false, gated:true } (an honest no-op, like the other rails in
 * server/comms/transport.ts) so the rest of the app reasons about "would have
 * sent" without a live provider. From-address is a role-based identity on the
 * verified sending domain (no personnel names, per the brand rule).
 */

const DEFAULT_FROM = "Provecta Group <noreply@pgco.world>";

export interface EmailResult {
  sent: boolean;
  gated?: boolean;
  id?: string;
  error?: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return process.env.RESEND_FROM || DEFAULT_FROM;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, gated: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text ?? (input.html ? undefined : input.subject),
        reply_to: input.replyTo,
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) return { sent: false, error: data?.message || `resend http ${res.status}` };
    return { sent: true, id: data?.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Minimal, dependency-free Markdown → HTML for transactional emails (headings,
 * bold, links, paragraphs, list items). Good enough for proposals/contracts;
 * not a full Markdown engine.
 */
export function mdToEmailHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  const blocks = md.split(/\n{2,}/).map((b) => {
    const t = b.trim();
    if (/^#{1,6}\s/.test(t)) {
      const level = Math.min(t.match(/^#+/)![0].length, 4);
      return `<h${level} style="margin:18px 0 8px">${inline(t.replace(/^#+\s/, ""))}</h${level}>`;
    }
    if (/^([-*]|\d+\.)\s/m.test(t)) {
      const items = t.split(/\n/).map((l) => `<li>${inline(l.replace(/^([-*]|\d+\.)\s/, ""))}</li>`).join("");
      return `<ul style="margin:8px 0 8px 18px">${items}</ul>`;
    }
    return `<p style="margin:10px 0;line-height:1.5">${inline(t).replace(/\n/g, "<br/>")}</p>`;
  });
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1d1f;max-width:640px">${blocks.join("")}</div>`;
}

/** Wrap body HTML in a simple branded shell with an optional call-to-action button. */
export function emailShell(bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:22px 0"><a href="${cta.url}" style="background:#0071e3;color:#fff;text-decoration:none;padding:11px 22px;border-radius:980px;font-weight:600;display:inline-block">${cta.label}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1d1f;max-width:640px;margin:0 auto;padding:8px">
  <div style="font-weight:700;font-size:18px;margin-bottom:14px">Provecta Group</div>
  ${bodyHtml}
  ${button}
  <hr style="border:none;border-top:1px solid #e5e5e7;margin:22px 0"/>
  <p style="color:#86868b;font-size:12px">Provecta Group, a Genius Co company.</p>
</div>`;
}
