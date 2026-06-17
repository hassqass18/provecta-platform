// Status vocabularies (string-typed in dev/SQLite; native enums in prod/Postgres)
// plus display helpers (label + tone) used across admin + client surfaces.

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CLIENT";
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "STAFF"];

export type Tone = "neutral" | "info" | "success" | "warn" | "danger";

// Apple-restrained palette on the dark portal (brief §5.7): blue is the only
// saturated accent; red is the single exception, reserved strictly for danger.
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-white/10 text-white border-white/15",
  info: "bg-[#2997ff]/15 text-[#5ab0ff] border-[#2997ff]/30",
  success: "bg-[#2997ff]/15 text-[#5ab0ff] border-[#2997ff]/30",
  warn: "bg-white/10 text-white border-white/40",
  danger: "bg-[#ff453a]/15 text-[#ff6961] border-[#ff453a]/35",
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
