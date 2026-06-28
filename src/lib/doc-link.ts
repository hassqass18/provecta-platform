import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed download links for documents. Lets any surface (web back
 * office, mobile app, client portal) hand out an openable URL — `/d/<id>?exp&sig`
 * — without exposing the underlying blob URL or requiring a bearer header on the
 * open. Signed with AUTH_SECRET; the `/d/[id]` route verifies + audits + streams.
 */

const TTL_DEFAULT = 60 * 30; // 30 minutes

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not set");
  return s;
}

function sig(id: string, exp: number): string {
  return createHmac("sha256", secret())
    .update(`${id}.${exp}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signDocPath(id: string, ttlSec = TTL_DEFAULT): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return `/d/${id}?exp=${exp}&sig=${sig(id, exp)}`;
}

export function verifyDocSig(id: string, exp: number, providedSig: string): boolean {
  if (!exp || Math.floor(Date.now() / 1000) >= exp) return false;
  const expected = sig(id, exp);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
