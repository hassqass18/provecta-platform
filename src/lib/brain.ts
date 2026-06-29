import { prisma } from "./db";
import { chat, extractText, llmConfigured } from "./llm/anthropic";
import { consultBrain } from "./agent/consult-brain";

// bRRAIn intelligence layer. Generation runs on the real Claude engine
// (lib/llm/anthropic) grounded with bRRAIn retrieval (consultBrain). When no
// ANTHROPIC_API_KEY is present it degrades to a deterministic stub so the build
// still runs keyless. `brainProvider` tracks the (future) official bRRAIn API.

export type BrainProvider = "STUB" | "AMB" | "BRRAIN";

export function brainProvider(): BrainProvider {
  if (process.env.BRRAIN_API_KEY && process.env.BRRAIN_API_URL) return "BRRAIN";
  if (process.env.BRRAIN_API_KEY) return "AMB";
  return "STUB";
}

export function brainConfigured(): boolean {
  return brainProvider() !== "STUB";
}

const PROVECTA_VOICE =
  "You are bRRAIn, the operating intelligence of Provecta Group — the first business-operations firm built on bRRAIn. " +
  "Voice: precise, senior-consultant, plain and confident; no fluff, no hype, no emojis. " +
  "Never invent facts, figures, names, or commitments; if something isn't grounded, say what you'd need. " +
  "Provecta Group is a Genius Co company.";

// Pull a few relevant bRRAIn snippets and render them as a grounding block.
async function grounding(query: string): Promise<string> {
  try {
    const snips = await consultBrain(query, { max: 4 });
    if (!snips.length) return "";
    return (
      "\n\nGrounding from the Provecta knowledge base (bRRAIn) — use only what's relevant:\n" +
      snips.map((s) => `--- ${s.path} ---\n${s.text}`).join("\n\n")
    );
  } catch {
    return "";
  }
}

export async function askBrain(prompt: string, opts?: { engagementId?: string }): Promise<string> {
  const provider = brainProvider();
  let response: string;

  if (llmConfigured()) {
    try {
      const ground = await grounding(prompt);
      const res = await chat({
        system: PROVECTA_VOICE + ground,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 900,
        temperature: 0.4,
      });
      response = extractText(res.content) || stubAnswer(prompt);
    } catch {
      response = stubAnswer(prompt);
    }
  } else {
    response = stubAnswer(prompt);
  }

  await prisma.brainQuery.create({
    data: { prompt, response, provider, engagementId: opts?.engagementId },
  }).catch(() => {});
  return response;
}

function stubAnswer(prompt: string): string {
  return `Grounded answer (local bRRAIn): ${prompt.slice(0, 140)}…`;
}

// Draft a support / client reply — real, grounded, honest.
export async function draftReply(
  subject: string,
  lastMessage: string,
  opts?: { engagementId?: string }
): Promise<string> {
  const provider = brainProvider();
  let response: string;

  if (llmConfigured()) {
    try {
      const ground = await grounding(`${subject} ${lastMessage}`);
      const res = await chat({
        system:
          PROVECTA_VOICE +
          " Write a concise, helpful reply to the client. Be specific and honest; do not over-promise dates, money, or outcomes. " +
          "If you cannot resolve it, say a Provecta specialist is on it and give the realistic next step." +
          ground,
        messages: [
          { role: "user", content: `Ticket subject: ${subject}\nClient's latest message: ${lastMessage || "(none)"}\n\nWrite the reply.` },
        ],
        maxTokens: 500,
        temperature: 0.4,
      });
      response = extractText(res.content) || stubReply(subject, lastMessage);
    } catch {
      response = stubReply(subject, lastMessage);
    }
  } else {
    response = stubReply(subject, lastMessage);
  }

  await prisma.brainQuery.create({
    data: { prompt: `Draft reply: ${subject}`, response, provider, engagementId: opts?.engagementId },
  }).catch(() => {});
  return response;
}

function stubReply(subject: string, lastMessage: string): string {
  const ref = lastMessage ? ` On your note — "${lastMessage.slice(0, 80)}" — ` : " ";
  return `Hi, thanks for reaching out about "${subject}". We've logged this and a Provecta specialist is reviewing it now.${ref}we'll follow up with concrete next steps within one business day. — Provecta Group`;
}

// Proposal-from-transcript: bRRAIn drafts a real, tailored proposal from the
// discovery transcript (grounded in bRRAIn). Falls back to a heuristic draft
// when the engine isn't keyed.
export async function proposalFromTranscript(
  title: string,
  transcript: string,
): Promise<{ bodyMd: string; suggestedBudgetMinor: number }> {
  if (llmConfigured()) {
    try {
      const ground = await grounding(`${title} ${transcript.slice(0, 500)}`);
      const res = await chat({
        system:
          PROVECTA_VOICE +
          " You are drafting a client proposal from a discovery transcript. Produce a complete, tailored proposal in Markdown with these sections: " +
          "Understanding (the client's specific situation + priorities), Recommended approach (phased, concrete to THIS client), Scope & deliverables, " +
          "Success criteria, Timeline (indicative), and Investment. Ground the approach in Provecta's bRRAIn-powered delivery model. " +
          "Do not invent client facts not present in the transcript. " +
          "After the Markdown, output a final line exactly: BUDGET_USD: <integer>  (your best indicative total in USD)." +
          ground,
        messages: [{ role: "user", content: `Proposal title: ${title}\n\nDiscovery transcript / notes:\n${transcript.slice(0, 12000)}` }],
        maxTokens: 2200,
        temperature: 0.5,
      });
      const text = extractText(res.content);
      const m = text.match(/BUDGET_USD:\s*\$?([\d,]+)/i);
      const usd = m ? Number(m[1].replace(/,/g, "")) : 0;
      const bodyMd = text.replace(/\n?BUDGET_USD:.*$/i, "").trim();
      if (bodyMd) {
        const suggestedBudgetMinor = usd > 0 ? usd * 100 : heuristicBudgetMinor(transcript);
        return { bodyMd, suggestedBudgetMinor };
      }
    } catch {
      // fall through to heuristic
    }
  }
  return heuristicProposal(title, transcript);
}

function heuristicBudgetMinor(transcript: string): number {
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  return Math.min(12_000_000, Math.max(1_500_000, wordCount * 1500));
}

function heuristicProposal(title: string, transcript: string): { bodyMd: string; suggestedBudgetMinor: number } {
  const sentences = transcript.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 20);
  const painPoints = sentences.slice(0, 4);
  const suggestedBudgetMinor = heuristicBudgetMinor(transcript);
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

## Indicative investment
${(suggestedBudgetMinor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} (refined after scoping).

_Draft generated from the discovery transcript — review before sending._`;
  return { bodyMd, suggestedBudgetMinor };
}
