import { prisma } from "./db";

// Brain layer. Today: AI Memory Brain (via BRRAIN_API_URL/KEY) when configured;
// otherwise a deterministic local stub so the build runs keyless. Swap-in point
// for the official bRRAIn API (referral: https://brrain.io/architecture?ref=957c790577).

export type BrainProvider = "STUB" | "AMB" | "BRRAIN";

export function brainProvider(): BrainProvider {
  if (process.env.BRRAIN_API_KEY && process.env.BRRAIN_API_URL) return "BRRAIN";
  if (process.env.BRRAIN_API_KEY) return "AMB";
  return "STUB";
}

export function brainConfigured(): boolean {
  return brainProvider() !== "STUB";
}

export async function askBrain(prompt: string, opts?: { engagementId?: string }): Promise<string> {
  const provider = brainProvider();
  let response: string;

  if (provider === "STUB") {
    response = stubAnswer(prompt);
  } else {
    // Real call would go here (gated on keys). Kept stubbed until keys exist.
    response = stubAnswer(prompt);
  }

  await prisma.brainQuery.create({
    data: { prompt, response, provider, engagementId: opts?.engagementId },
  });
  return response;
}

function stubAnswer(prompt: string): string {
  return `Grounded answer (local brain): ${prompt.slice(0, 140)}…`;
}

// Proposal-from-transcript: parse a discovery transcript into a structured
// proposal draft. The transcript idea — record the call, brain drafts a proposal.
export function proposalFromTranscript(title: string, transcript: string): {
  bodyMd: string;
  suggestedBudgetMinor: number;
} {
  const sentences = transcript
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const painPoints = sentences.slice(0, 4);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  // Naive heuristic: scale a starting estimate by discovery depth.
  const suggestedBudgetMinor = Math.min(12_000_000, Math.max(1_500_000, wordCount * 1500));

  const bodyMd = `# Proposal — ${title}

## Understanding
Based on our discovery conversation, we identified the following priorities:
${painPoints.map((p) => `- ${p}`).join("\n") || "- (insufficient detail captured)"}

## Recommended approach
Provecta will deliver this as a phased Business Operations engagement on the bRRAIn-powered platform:

1. **Discovery & audit** — current-state map, KPI baseline, readiness (ADKAR) scorecard.
2. **Design & build** — native build of the operating model on the platform.
3. **Automation & integration** — connect the systems you already use into one source of truth.
4. **Enablement & handover** — training, runbooks, and a measured move to autonomous operations.

## Why Provecta
The first business operations firm built on bRRAIn — custom solutions at a fraction of
traditional software-development cost, delivered on a platform your team is onboarded onto.

## Indicative investment
${(suggestedBudgetMinor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} (refined after scoping).

_Draft generated from the discovery transcript — review before sending._`;

  return { bodyMd, suggestedBudgetMinor };
}
