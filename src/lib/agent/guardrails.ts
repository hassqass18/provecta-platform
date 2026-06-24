/**
 * bRRAIn client-agent OUTPUT guardrails.
 *
 * The client-facing agent reasons over org-wide internal knowledge but must
 * NEVER reveal: IP / strategy / ideation / internal material, other clients'
 * data, personnel names, or contract content (unless the client explicitly
 * asks about THEIR OWN contract — then only the minimum necessary, with
 * specifics routed to a human).
 *
 * Pure logic, no DB. Run on every drafted client reply BEFORE it is sent.
 * Philosophy: favor false-positives — when unsure, escalate rather than leak.
 *
 * Reuses scrubPII (personnel-name redaction) and assertBacked from comms/honesty.
 */
import { scrubPII } from "@/lib/comms/honesty";

/**
 * Sensitivity classification for a knowledge source by its path (primary
 * signal) with text as a secondary hint.
 *
 *  - SHAREABLE   : safe to surface to the client.
 *  - REASON_ONLY : the agent may reason over it internally but must not quote
 *                  or reveal it (strategy, ideation, decisions, roadmaps, BD).
 *  - FORBIDDEN   : never load into a client-facing reasoning context at all
 *                  (contracts, legal, secrets/keys, env files).
 */
export type Sensitivity = "SHAREABLE" | "REASON_ONLY" | "FORBIDDEN";

export interface GuardInput {
  /** The drafted client-facing reply text. */
  draft: string;
  /** True only when the client explicitly asked about THEIR OWN contract. */
  clientAskedAboutContract?: boolean;
  /** Personnel names to scrub (Hassan, staff, etc.) — brand rule. */
  personnelNames?: string[];
  /** Internal snippets that must not appear near-verbatim in the draft. */
  doNotQuote?: string[];
}

export interface GuardResult {
  /** False if any HARD violation — caller must escalate, not auto-send. */
  safe: boolean;
  /** The sanitized text (PII-scrubbed; sentences redacted where applicable). */
  text: string;
  /** Machine-readable violation codes accumulated during checking. */
  violations: string[];
}

/** FORBIDDEN-tier path markers: never surface in any form. */
const FORBIDDEN_PATH = /contracts?|legal|\.env/i;

/**
 * REASON_ONLY-tier path markers: internal-only material the agent may reason
 * over but must not reveal.
 */
const REASON_ONLY_PATH =
  /strateg|ideation|decisions-learnings|Master-Context|NextSteps|Product_Development|BD\//i;

/**
 * Classify a knowledge source's sensitivity, primarily from its path.
 *
 * `text` is accepted as a secondary signal but the path decision dominates:
 * we never downgrade a forbidden/internal path because the text "looks" benign.
 */
export function classifySensitivity(path: string, text?: string): Sensitivity {
  const p = path ?? "";

  if (FORBIDDEN_PATH.test(p) || p.includes("keys.md")) {
    return "FORBIDDEN";
  }

  if (REASON_ONLY_PATH.test(p)) {
    return "REASON_ONLY";
  }

  // Secondary text signal: obvious secret material is forbidden even if the
  // path looked innocuous (false-positive-safe).
  if (text && /-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key\s*[:=]/i.test(text)) {
    return "FORBIDDEN";
  }

  return "SHAREABLE";
}

/** Contract / legal-instrument references in client copy. */
const CONTRACT_REF = /\bcontract(s|ual)?\b|\bclause\b|\bagreement\b/i;

/**
 * IP / strategy / internal markers. A match flags the sentence as an
 * internal leak. Tuned to be conservative-but-not-paranoid.
 */
const INTERNAL_MARKERS =
  /\b(strateg(?:y|ic|ies)|roadmap|internal|ideation|margins?|COGS|valuation|IP|playbooks?)\b/i;

/** Split text into sentences while preserving the original delimiters. */
function splitSentences(text: string): string[] {
  // Keep trailing punctuation/space with each chunk so re-joining is lossless.
  const matches = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g);
  return matches ?? (text.length > 0 ? [text] : []);
}

/** Normalize text to a lowercase word array for overlap comparison. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Detect a contiguous >= 12-word overlap between a snippet and the draft.
 * Near-verbatim reproduction of internal material is a hard leak.
 */
function hasVerbatimOverlap(draft: string, snippet: string, minWords = 12): boolean {
  const draftWords = words(draft);
  const snippetWords = words(snippet);
  if (snippetWords.length < minWords || draftWords.length < minWords) return false;

  const draftJoined = ` ${draftWords.join(" ")} `;
  for (let i = 0; i + minWords <= snippetWords.length; i++) {
    const window = snippetWords.slice(i, i + minWords).join(" ");
    if (draftJoined.includes(` ${window} `)) return true;
  }
  return false;
}

/**
 * Build the set of internal-marker regexes, including any other-client names
 * provided (their appearance in a client reply is a cross-tenant leak).
 */
function buildInternalRegexes(otherClientNames: string[]): RegExp[] {
  const regexes: RegExp[] = [INTERNAL_MARKERS];
  for (const name of otherClientNames) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regexes.push(new RegExp(`\\b${escaped}\\b`, "i"));
  }
  return regexes;
}

/**
 * Guard a drafted client reply. Returns sanitized text plus a safety verdict.
 *
 * Pipeline:
 *  1. Scrub personnel names (brand rule).
 *  2. Contract rule — references without an explicit client ask are a hard
 *     violation routed to a human; with a valid ask, allowed + soft note.
 *  3. IP/strategy markers — redact offending sentences and hard-fail.
 *  4. Near-verbatim internal leak — hard-fail on >= 12-word overlap.
 */
export function guardClientReply(input: GuardInput): GuardResult {
  const { draft, clientAskedAboutContract, personnelNames, doNotQuote } = input;
  const violations: string[] = [];
  let safe = true;

  // 1. Personnel-name scrub (reused brand rule).
  let text = scrubPII(draft, personnelNames ?? []);

  // 2. Contract rule.
  if (CONTRACT_REF.test(text)) {
    if (!clientAskedAboutContract) {
      // Hard violation: never auto-send contract talk the client didn't ask for.
      violations.push("contract-reference");
      safe = false;
    } else {
      // Allowed, but specifics must go through a human.
      const note =
        " (Note: for any specific contract terms, I'll loop in your Provecta point of contact directly.)";
      if (!text.includes("loop in your Provecta point of contact")) {
        text = `${text.trimEnd()}${note}`;
      }
    }
  }

  // 3. IP / strategy / cross-tenant markers — redact offending sentences.
  const internalRegexes = buildInternalRegexes([]);
  const sentences = splitSentences(text);
  let internalLeak = false;
  const rebuilt = sentences.map((sentence) => {
    const hit = internalRegexes.some((re) => re.test(sentence));
    if (hit && sentence.trim().length > 0) {
      internalLeak = true;
      // Preserve trailing whitespace so spacing/structure survives.
      const trailing = sentence.match(/\s*$/)?.[0] ?? "";
      return `[redacted internal content]${trailing}`;
    }
    return sentence;
  });
  if (internalLeak) {
    text = rebuilt.join("");
    violations.push("internal-leak");
    safe = false;
  }

  // 4. Near-verbatim internal leak.
  for (const snippet of doNotQuote ?? []) {
    if (snippet && hasVerbatimOverlap(text, snippet)) {
      violations.push("verbatim-internal");
      safe = false;
      break;
    }
  }

  return { safe, text, violations };
}
