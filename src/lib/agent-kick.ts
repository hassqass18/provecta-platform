import { after } from "next/server";

/**
 * Drain the job/event queue promptly WITHOUT a frequent cron.
 *
 * Vercel Hobby only runs native cron daily, so enqueued IngestJobs / DomainEvents
 * would otherwise sit PENDING until the next day. After the current response is
 * sent, fire `/api/cron/agent-tick` (which self-chains while PENDING work
 * remains). The fetch is initiated inside `after()`, so the tick spawns as an
 * independent function even if this request ends first. Best-effort — failures
 * are swallowed; the daily cron remains the backstop.
 */
export function kickAgentTick(): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://www.pgco.world").replace(/\/$/, "");
  after(async () => {
    try {
      await fetch(`${base}/api/cron/agent-tick`, {
        headers: { authorization: `Bearer ${secret}` },
        cache: "no-store",
      });
    } catch {
      // swallowed — the daily cron is the backstop
    }
  });
}
