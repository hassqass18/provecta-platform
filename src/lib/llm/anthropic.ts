/**
 * Claude Messages API client with tool use.
 *
 * Ported from the proven zoho-controller implementation. Uses raw `fetch`
 * against the Messages API rather than the SDK so it runs anywhere (edge,
 * node, serverless) without extra dependencies.
 *
 * Hardening:
 *  - System block is sent with cache_control:ephemeral so a bulky brand/state
 *    prompt is cached across turns. Subsequent calls only pay for new tokens.
 *  - On HTTP 429 (rate limit), retry with exponential backoff up to 3 times.
 *    If the configured model is exhausted, fall back to claude-haiku-4-5
 *    which has much higher per-minute limits.
 *  - On other 5xx errors, retry with backoff.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ChatResponse {
  id: string;
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
  content: ContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

/** True when an API key is present in the environment. */
export function llmConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ApiResult {
  status: number;
  data: unknown;
}

async function callApi(body: Record<string, unknown>, apiKey: string): Promise<ApiResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  return { status: res.status, data };
}

/** Best-effort extraction of a numeric retry_after from an error body. */
function retryAfterSeconds(data: unknown): number | undefined {
  if (data && typeof data === "object") {
    const err = (data as { error?: unknown }).error;
    if (err && typeof err === "object") {
      const ra = (err as { retry_after?: unknown }).retry_after;
      if (typeof ra === "number") return ra;
    }
  }
  return undefined;
}

export type ToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

export async function chat(input: {
  system: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const primaryModel = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  // Prompt caching: send the system as a single block with cache_control.
  // This makes the bulky brand+state prompt a "cached" token after the first
  // call within ~5 minutes, dramatically reducing input token count and
  // pressure on the per-minute rate limit.
  const systemBlocks = [
    { type: "text", text: input.system, cache_control: { type: "ephemeral" } as const },
  ];

  const baseBody: Record<string, unknown> = {
    max_tokens: input.maxTokens ?? 1024,
    temperature: input.temperature ?? 0.6,
    system: systemBlocks,
    messages: input.messages,
  };
  if (input.tools && input.tools.length) baseBody.tools = input.tools;
  if (input.toolChoice) baseBody.tool_choice = input.toolChoice;

  // Try primary model with retries.
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await callApi({ ...baseBody, model: primaryModel }, apiKey);
    if (r.status >= 200 && r.status < 300) {
      if (attempt > 0) console.info("anthropic.recovered", { attempt, model: primaryModel });
      return r.data as ChatResponse;
    }
    lastErr = JSON.stringify(r.data).slice(0, 400);
    console.warn("anthropic.error", { status: r.status, attempt, model: primaryModel, err: lastErr });
    if (r.status === 429) {
      // Honour retry-after if Anthropic returned one in the body.
      const ra = retryAfterSeconds(r.data);
      const wait = ra ? ra * 1000 : 8_000 * (attempt + 1);
      await sleep(wait);
      continue;
    }
    if (r.status >= 500 && r.status < 600) {
      await sleep(2_000 * (attempt + 1));
      continue;
    }
    // 4xx other than 429 — fatal.
    throw new Error("Anthropic " + r.status + ": " + lastErr);
  }

  // Primary exhausted — fall back to Haiku (higher per-minute limits).
  if (primaryModel !== FALLBACK_MODEL) {
    console.warn("anthropic.fallback_to_haiku", { reason: "primary exhausted", primary: primaryModel });
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await callApi({ ...baseBody, model: FALLBACK_MODEL }, apiKey);
      if (r.status >= 200 && r.status < 300) {
        return r.data as ChatResponse;
      }
      lastErr = JSON.stringify(r.data).slice(0, 400);
      console.warn("anthropic.fallback_error", { status: r.status, attempt, err: lastErr });
      if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
        await sleep(4_000 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw new Error("Anthropic exhausted both primary + fallback: " + lastErr);
}

export function extractText(content: ContentBlock[]): string {
  return content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

export function extractToolUses(
  content: ContentBlock[],
): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  return content
    .filter(
      (c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        c.type === "tool_use",
    )
    .map((c) => ({ id: c.id, name: c.name, input: c.input }));
}
