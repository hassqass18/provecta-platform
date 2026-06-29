import { chat, extractText, llmConfigured, type ContentBlock } from "@/lib/llm/anthropic";
import { consultBrain } from "@/lib/agent/consult-brain";

/**
 * Pluggable prospect-research layer (pre-proposal "research / audit / analyze").
 *
 * Two providers ship now:
 *  - ClaudeWebSearchProvider — Claude's native web_search server tool + bRRAIn
 *    grounding (live facts about the prospect, cited).
 *  - TranscriptOnlyProvider  — transcript + bRRAIn only, no web (cheap/fast).
 *
 * A third (firmographic enrichment vendor, e.g. Apollo) drops in later by
 * implementing ResearchProvider — nothing else changes. Keyless → STUB brief.
 */

export interface ResearchInput {
  company: string;
  contact?: string | null;
  domain?: string | null;
  transcript?: string | null;
}
export interface ResearchSource {
  title: string;
  url: string;
}
export type ResearchProviderName = "CLAUDE_WEB" | "TRANSCRIPT" | "STUB";
export interface ResearchResult {
  briefMd: string;
  signals: string[];
  sources: ResearchSource[];
  provider: ResearchProviderName;
}
export interface ResearchProvider {
  name: ResearchProviderName;
  research(input: ResearchInput): Promise<ResearchResult>;
}

const VOICE =
  "You are bRRAIn, the operating intelligence of Provecta Group — a Business Operations firm. " +
  "Voice: precise, senior-consultant, plain and confident; no fluff, no hype, no emojis. " +
  "Never invent facts, figures, names, or commitments; flag assumptions explicitly. Provecta Group is a Genius Co company.";

const BRIEF_SHAPE =
  "Produce a 'Prospect Research Brief' in Markdown with these sections: " +
  "**Company overview** (what they do, size/footprint if known), **Market & context** (industry, competitive/operating dynamics), " +
  "**Likely pain points** (tie explicitly to what the prospect said in the transcript where available), " +
  "**Signals & triggers** (why now — growth, funding, hiring, expansion, tooling gaps), " +
  "**Fit for Provecta** (where our Business-Operations-on-bRRAIn model helps), and **Open questions** (what to confirm in scoping). " +
  "Where a fact is not established, say so or mark [ASSUMPTION] — never fabricate. " +
  "End with one final line exactly: SIGNALS: <semicolon-separated short signal phrases>.";

async function groundingBlock(query: string): Promise<string> {
  try {
    const snips = await consultBrain(query, { max: 3 });
    if (!snips.length) return "";
    return (
      "\n\nGrounding from the Provecta knowledge base (bRRAIn) — use only what's relevant:\n" +
      snips.map((s) => `--- ${s.path} ---\n${s.text}`).join("\n\n")
    );
  } catch {
    return "";
  }
}

function contextOf(input: ResearchInput): string {
  return [
    `Company: ${input.company}`,
    input.contact ? `Contact: ${input.contact}` : "",
    input.domain ? `Website/domain: ${input.domain}` : "",
    input.transcript ? `Discovery transcript / notes:\n${input.transcript.slice(0, 9000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseSignals(text: string): { briefMd: string; signals: string[] } {
  const m = text.match(/\n?SIGNALS:\s*(.+)$/i);
  const signals = m ? m[1].split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [];
  const briefMd = text.replace(/\n?SIGNALS:.*$/i, "").trim();
  return { briefMd, signals };
}

// Pull cited URLs out of web_search_tool_result content blocks, best-effort.
function extractSources(content: ContentBlock[]): ResearchSource[] {
  const out: ResearchSource[] = [];
  for (const block of content as unknown as Record<string, unknown>[]) {
    if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content as Record<string, unknown>[]) {
        if (r?.url) out.push({ title: String(r.title ?? r.url), url: String(r.url) });
      }
    }
  }
  // de-dupe by url, cap
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 12);
}

class ClaudeWebSearchProvider implements ResearchProvider {
  name = "CLAUDE_WEB" as const;
  async research(input: ResearchInput): Promise<ResearchResult> {
    const ground = await groundingBlock(`${input.company} ${input.domain ?? ""} ${(input.transcript ?? "").slice(0, 300)}`);
    const res = await chat({
      system:
        VOICE +
        " You are researching a PROSPECT before Provecta drafts a proposal. Use web_search to establish current, real facts about the company " +
        "(what they do, size, market, recent news/signals). " +
        BRIEF_SHAPE +
        ground,
      messages: [{ role: "user", content: `Research this prospect and produce the brief.\n\n${contextOf(input)}` }],
      serverTools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
      maxTokens: 1300,
      temperature: 0.4,
      budgetMs: 56_000,
      perRequestTimeoutMs: 55_000,
    });
    const { briefMd, signals } = parseSignals(extractText(res.content));
    return { briefMd, signals, sources: extractSources(res.content), provider: "CLAUDE_WEB" };
  }
}

class TranscriptOnlyProvider implements ResearchProvider {
  name = "TRANSCRIPT" as const;
  async research(input: ResearchInput): Promise<ResearchResult> {
    const ground = await groundingBlock(`${input.company} ${(input.transcript ?? "").slice(0, 300)}`);
    const res = await chat({
      system:
        VOICE +
        " You are analyzing a PROSPECT before Provecta drafts a proposal, using ONLY the discovery transcript and Provecta knowledge — no web access. " +
        "Where external facts about the company would help but are not in the transcript, mark [INPUT REQUIRED]. " +
        BRIEF_SHAPE +
        ground,
      messages: [{ role: "user", content: `Analyze this prospect and produce the brief.\n\n${contextOf(input)}` }],
      maxTokens: 1500,
      temperature: 0.4,
      budgetMs: 50_000,
      perRequestTimeoutMs: 48_000,
    });
    const { briefMd, signals } = parseSignals(extractText(res.content));
    return { briefMd, signals, sources: [], provider: "TRANSCRIPT" };
  }
}

function stubBrief(input: ResearchInput): ResearchResult {
  const briefMd = `# Prospect Research Brief — ${input.company}

## Company overview
_(bRRAIn research engine not keyed — populate with engagement materials.)_

## Likely pain points
${(input.transcript ?? "")
  .split(/[.\n]/)
  .map((s) => s.trim())
  .filter((s) => s.length > 25)
  .slice(0, 4)
  .map((p) => `- ${p}`)
  .join("\n") || "- (insufficient transcript detail captured)"}

## Open questions
- Confirm company size, market, and primary operating constraints in scoping.`;
  return { briefMd, signals: [], sources: [], provider: "STUB" };
}

/**
 * Select the active research provider. Default = transcript + Claude knowledge +
 * bRRAIn, which RELIABLY fits the Vercel Hobby 60s function cap and produces a
 * strong brief. Live web_search (set RESEARCH_WEB=on) can exceed 60s as a single
 * call, so it's opt-in — reliable on Pro or via a future 2-step async job. The
 * interface also lets a firmographic enrichment vendor (Apollo) drop in later.
 */
export function getResearchProvider(): ResearchProvider {
  const webOn = ["on", "web", "true", "1"].includes((process.env.RESEARCH_WEB ?? "").toLowerCase());
  return webOn ? new ClaudeWebSearchProvider() : new TranscriptOnlyProvider();
}

/**
 * Run prospect research. ONE LLM call per invocation (two sequential calls would
 * blow the 60s cap), degrading straight to a fast stub on failure so the
 * workflow never blocks and never 504s.
 */
export async function auditProspect(input: ResearchInput): Promise<ResearchResult> {
  if (!llmConfigured()) return stubBrief(input);
  try {
    return await getResearchProvider().research(input);
  } catch {
    return stubBrief(input);
  }
}
