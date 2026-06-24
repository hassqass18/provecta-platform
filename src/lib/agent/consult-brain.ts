import { brainGitConfig, brainGitConfigured, listDir, getFileText, type BrainGitConfig } from "@/lib/brain-git";

// Org-wide retrieval for the agent's REASONING. Returns raw snippets with their
// repo path; callers apply output guardrails separately (this does NOT decide
// what is safe to surface to a client). Never throws — on any failure → [].

export interface BrainSnippet {
  path: string;
  text: string;
}

type CodeSearchResponse = { items?: { path: string }[] };

const MAX_SNIPPET_CHARS = 4000;

/**
 * Retrieve up to `max` (default 5) relevant brain documents for `query`.
 * Uses the GitHub code-search API for relevance, then fetches each file's text.
 * If code search is unavailable (e.g. repo not indexed → 403/422), falls back to
 * a couple of top-level README / Master-Context files under the path prefix.
 */
export async function consultBrain(query: string, opts?: { max?: number }): Promise<BrainSnippet[]> {
  if (!brainGitConfigured()) return [];
  const cfg = brainGitConfig();
  if (!cfg) return [];

  const max = Math.max(1, Math.min(opts?.max ?? 5, 5));

  try {
    const paths = await searchPaths(cfg, query, max);
    const chosen = paths.length > 0 ? paths : await fallbackPaths(cfg, max);

    const snippets: BrainSnippet[] = [];
    for (const path of chosen.slice(0, max)) {
      const text = await getFileText(cfg, path);
      if (text) snippets.push({ path, text: text.slice(0, MAX_SNIPPET_CHARS) });
    }
    return snippets;
  } catch {
    return [];
  }
}

// Top `max` result paths from the GitHub code-search API. Returns [] when search
// is unavailable (403/422 → not indexed / forbidden), so the caller can fall back.
async function searchPaths(cfg: BrainGitConfig, query: string, max: number): Promise<string[]> {
  const q = `${query} repo:${cfg.owner}/${cfg.repo}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=${max}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "provecta-platform-brain-consult",
    },
  });
  if (res.status === 422 || res.status === 403) return [];
  if (!res.ok) throw new Error(`GitHub code search → HTTP ${res.status}`);
  const data = (await res.json()) as CodeSearchResponse;
  return (data.items ?? []).map((it) => it.path).slice(0, max);
}

// Fallback when code search is unavailable: list the top folders under the path
// prefix and return a couple of README / Master-Context files. Bounded — scans
// at most a couple of folders so the whole call stays within ~5 fetches.
async function fallbackPaths(cfg: BrainGitConfig, max: number): Promise<string[]> {
  const folders = (await listDir(cfg, cfg.pathPrefix)).filter((e) => e.type === "dir").slice(0, 2);
  const out: string[] = [];
  for (const folder of folders) {
    if (out.length >= max) break;
    const entries = await listDir(cfg, folder.path);
    const hit = entries.find(
      (e) => e.type === "file" && /(readme|master-context)/i.test(e.name)
    );
    if (hit) out.push(hit.path);
  }
  return out.slice(0, max);
}
