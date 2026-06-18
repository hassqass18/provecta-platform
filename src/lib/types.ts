// Status vocabularies (string-typed in dev/SQLite; native enums in prod/Postgres)
// plus display helpers (label + tone) used across admin + client surfaces.

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CLIENT";
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "STAFF"];

export type Tone = "neutral" | "info" | "success" | "warn" | "danger";

// Apple-restrained palette. Light defaults below; the .appdark scope in
// globals.css overrides these arbitrary classes for the dark theme.
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-[#f5f5f7] text-[#1d1d1f] border-black/10",
  info: "bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/25",
  success: "bg-[#0071e3]/[0.08] text-[#0066cc] border-[#0071e3]/25",
  warn: "bg-[#f5f5f7] text-[#1d1d1f] border-[#1d1d1f]",
  danger: "bg-[#ff3b30]/10 text-[#d70015] border-[#ff3b30]/25",
};

export const ENGAGEMENT_STATUS: Record<string, Tone> = {
  PROPOSED: "info",
  ACTIVE: "success",
  ON_HOLD: "warn",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

export const MILESTONE_STATUS: Record<string, Tone> = {
  PENDING: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  BLOCKED: "danger",
};

export const TASK_STATUS: Record<string, Tone> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
};

export const INVOICE_STATUS: Record<string, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

export const SLA_STATUS: Record<string, Tone> = {
  MEETING: "success",
  AT_RISK: "warn",
  BREACHED: "danger",
};

export const TICKET_STATUS: Record<string, Tone> = {
  OPEN: "info",
  TRIAGED: "warn",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const AUTONOMY_STATE: Record<string, Tone> = {
  SUGGEST: "neutral",
  AUTO_WITH_REVIEW: "warn",
  AUTONOMOUS: "success",
};

export function toneFor(map: Record<string, Tone>, value: string): Tone {
  return map[value] ?? "neutral";
}

export function money(minor: number, currency = "USD"): string {
  const major = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
