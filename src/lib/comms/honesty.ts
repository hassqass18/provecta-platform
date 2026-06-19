/**
 * Honesty "say-gate" + PII scrub.
 *
 * Pure logic, no DB. Run before any client-facing / outbound message is emitted.
 *
 * Money/legal claims (PAYMENT_RECEIVED, INVOICE_PAID, CONTRACT_SIGNED) must NEVER
 * pass without their backing row present — this mirrors the REGULATED/IRREVERSIBLE
 * gate as a say-gate: we never assert a financial or legal fact we cannot back.
 */

export type ClaimKind =
  | "PAYMENT_RECEIVED"
  | "INVOICE_PAID"
  | "CONTRACT_SIGNED"
  | "MILESTONE_COMPLETE"
  | "GENERIC";

export type Backing =
  | {
      paymentReceivedAt?: Date | null;
      invoiceStatus?: string | null;
      envelopeStatus?: string | null;
      milestoneStatus?: string | null;
    }
  | null;

/**
 * Returns whether a claim of the given kind is backed by the supplied evidence.
 */
export function assertBacked(
  kind: ClaimKind,
  backing: Backing
): { ok: boolean; reason?: string } {
  switch (kind) {
    case "PAYMENT_RECEIVED":
      return backing?.paymentReceivedAt
        ? { ok: true }
        : { ok: false, reason: "no Payment row" };

    case "INVOICE_PAID":
      return backing?.invoiceStatus === "PAID"
        ? { ok: true }
        : { ok: false, reason: "invoice not PAID" };

    case "CONTRACT_SIGNED":
      return backing?.envelopeStatus === "SIGNED"
        ? { ok: true }
        : { ok: false, reason: "envelope not SIGNED" };

    case "MILESTONE_COMPLETE":
      return backing?.milestoneStatus === "COMPLETED"
        ? { ok: true }
        : { ok: false, reason: "milestone not COMPLETED" };

    case "GENERIC":
      return { ok: true };

    default: {
      // Exhaustiveness guard: unknown kinds never pass.
      const _exhaustive: never = kind;
      return { ok: false, reason: `unknown claim kind: ${String(_exhaustive)}` };
    }
  }
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace each provided personnel name (case-insensitive, whole-word) with
 * "the Provecta team" — brand rule: no personnel names in client-facing copy.
 */
export function scrubPII(text: string, names: string[]): string {
  if (!names || names.length === 0) return text;

  let result = text;
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "gi");
    result = result.replace(pattern, "the Provecta team");
  }
  return result;
}

/** A provider is a stub when it is missing/unset or explicitly "STUB". */
export function isStub(provider: string | null | undefined): boolean {
  return (provider ?? "STUB") === "STUB";
}
