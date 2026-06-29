import { prisma } from "@/lib/db";

// Canonical autonomy policy seed. Each action category starts in SUGGEST and
// only promotes once its accrued approval ratio clears `threshold`. Regulated /
// irreversible categories carry an effectively-unreachable threshold so they
// never auto-promote — a human stays in the loop by design.

type PolicySeed = {
  actionCategory: string;
  state: string;
  riskClass: string;
  threshold: number;
};

const POLICIES: PolicySeed[] = [
  { actionCategory: "document-filing", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 10 },
  { actionCategory: "milestone-notification", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 10 },
  { actionCategory: "ticket-reply", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 12 },
  // bRRAIn generation (internal drafts; operator reviews before anything ships).
  { actionCategory: "prospect-research", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 10 },
  { actionCategory: "engagement-planning", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 12 },
  { actionCategory: "deliverable-drafting", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 12 },
  // Higher bar: outbound proposals carry more brand/commercial weight.
  { actionCategory: "proposal-send", state: "SUGGEST", riskClass: "REVERSIBLE", threshold: 20 },
  // Never auto-promotes: financial + regulated + irreversible categories.
  { actionCategory: "contract-issue", state: "SUGGEST", riskClass: "REGULATED", threshold: 9999 },
  { actionCategory: "invoice-issue", state: "SUGGEST", riskClass: "REGULATED", threshold: 9999 },
  { actionCategory: "payment", state: "SUGGEST", riskClass: "IRREVERSIBLE", threshold: 9999 },
  { actionCategory: "envelope-send", state: "SUGGEST", riskClass: "REGULATED", threshold: 9999 },
];

/**
 * Idempotently upsert the canonical autonomy policies (keyed by actionCategory).
 *
 * On create we set state/riskClass/threshold. On update we deliberately leave
 * accrued counters (approvedCount/totalCount) and the live `state` untouched so
 * re-seeding never stomps earned promotion progress — we only re-assert
 * riskClass and threshold to keep the governance metadata correct.
 */
export async function seedAutonomyPolicies(): Promise<void> {
  for (const p of POLICIES) {
    await prisma.autonomyPolicy.upsert({
      where: { actionCategory: p.actionCategory },
      create: {
        actionCategory: p.actionCategory,
        state: p.state,
        riskClass: p.riskClass,
        threshold: p.threshold,
      },
      update: {
        riskClass: p.riskClass,
        threshold: p.threshold,
      },
    });
  }
}
