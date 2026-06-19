import { prisma } from "./db";

// Autonomy ramp: actions graduate SUGGEST → AUTO_WITH_REVIEW → AUTONOMOUS as they
// accrue approvals — but REGULATED/IRREVERSIBLE classes never auto-promote (hard gate).

export const AUTONOMY_ORDER = ["SUGGEST", "AUTO_WITH_REVIEW", "AUTONOMOUS"] as const;

export async function ensureAutonomyPolicy(actionCategory: string, riskClass = "REVERSIBLE") {
  return prisma.autonomyPolicy.upsert({
    where: { actionCategory },
    create: { actionCategory, riskClass },
    update: {},
  });
}

export async function recordApproval(actionCategory: string) {
  const p = await ensureAutonomyPolicy(actionCategory);
  const approvedCount = p.approvedCount + 1;
  const totalCount = p.totalCount + 1;

  let state = p.state;
  // Only reversible actions may auto-promote.
  if (p.riskClass === "REVERSIBLE") {
    const ratio = approvedCount / Math.max(1, totalCount);
    if (approvedCount >= p.threshold && ratio >= 0.9) {
      const idx = AUTONOMY_ORDER.indexOf(state as (typeof AUTONOMY_ORDER)[number]);
      if (idx >= 0 && idx < AUTONOMY_ORDER.length - 1) state = AUTONOMY_ORDER[idx + 1];
    }
  }

  return prisma.autonomyPolicy.update({
    where: { actionCategory },
    data: { approvedCount, totalCount, state, updatedAt: new Date() },
  });
}

export function canAutoExecute(state: string, riskClass: string): boolean {
  // P0 global kill-switch: when AUTONOMY_FREEZE is set, every action is forced
  // to SUGGEST (nothing auto-executes), regardless of state or risk class.
  if (process.env.AUTONOMY_FREEZE) return false;
  // Hard, non-flag-overridable gate: regulated/irreversible never auto-execute.
  if (riskClass === "IRREVERSIBLE" || riskClass === "REGULATED") return false;
  return state === "AUTONOMOUS";
}
