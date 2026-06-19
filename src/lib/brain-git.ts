import { createHash } from "node:crypto";

// P1A — GitBrainSource: read FINAL deliverables from the brain git repo via the
// GitHub Contents API. Gated: returns null config when GITHUB_BRAIN_TOKEN /
// BRAIN_REPO_* are unset, so the build never blocks on credentials.

export type BrainGitConfig = {
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
  token: string;
};

export type BrainFile = {
  relPath: string; // path relative to the tenant folder
  fullPath: string; // repo path
  name: string;
  sha: string;
  sizeBytes: number;
  isFinal: boolean;
  reason: "FINAL_DIR" | "FRONTMATTER" | "NOT_FINAL";
};

export function brainGitConfig(): BrainGitConfig | null {
  const token = process.env.GITHUB_BRAIN_TOKEN;
  const owner = process.env.BRAIN_REPO_OWNER;
  const repo = process.env.BRAIN_REPO_NAME;
  if (!token || !owner || !repo) return null;
  return {
    owner,
    repo,
    token,
    branch: process.env.BRAIN_REPO_BRANCH || "main",
    pathPrefix: process.env.BRAIN_PATH_PREFIX || "projects/staging",
  };
}

export function brainGitConfigured(): boolean {
  return brainGitConfig() !== null;
}

type GhEntry = { name: string; path: string; type: "file" | "dir"; sha: string; size: number };

async function gh(cfg: BrainGitConfig, repoPath: string): Promise<unknown> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "provecta-platform-brain-sync",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub Contents ${repoPath} → HTTP ${res.status}`);
  return res.json();
}

export async function listDir(cfg: BrainGitConfig, repoPath: string): Promise<GhEntry[]> {
  const data = await gh(cfg, repoPath);
  if (!Array.isArray(data)) return [];
  return data as GhEntry[];
}

export async function getFileText(cfg: BrainGitConfig, repoPath: string): Promise<string | null> {
  const data = (await gh(cfg, repoPath)) as { content?: string; encoding?: string } | null;
  if (!data?.content) return null;
  return Buffer.from(data.content, (data.encoding as BufferEncoding) || "base64").toString("utf8");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function hasFinalFrontmatter(text: string): boolean {
  // `status: FINAL` within a leading --- frontmatter block (or near the top).
  const head = text.slice(0, 600);
  return /^\s*status\s*:\s*FINAL\s*$/im.test(head);
}

/**
 * Walk a tenant's brain folder and return FINAL deliverables. A file is FINAL if
 * it sits under a `FINAL/` directory, or (for .md) carries `status: FINAL`
 * front-matter. Bounded recursion; only fetches content for candidate .md files.
 */
export async function listFinalsForFolder(
  cfg: BrainGitConfig,
  brainFolder: string,
  maxDepth = 4
): Promise<BrainFile[]> {
  const root = `${cfg.pathPrefix}/${brainFolder}`.replace(/\/+/g, "/");
  const out: BrainFile[] = [];

  async function walk(repoPath: string, depth: number, underFinalDir: boolean) {
    if (depth > maxDepth) return;
    const entries = await listDir(cfg, repoPath);
    for (const e of entries) {
      if (e.type === "dir") {
        await walk(e.path, depth + 1, underFinalDir || e.name.toUpperCase() === "FINAL");
      } else if (e.type === "file") {
        let isFinal = underFinalDir;
        let reason: BrainFile["reason"] = underFinalDir ? "FINAL_DIR" : "NOT_FINAL";
        if (!isFinal && e.name.toLowerCase().endsWith(".md")) {
          const text = await getFileText(cfg, e.path);
          if (text && hasFinalFrontmatter(text)) {
            isFinal = true;
            reason = "FRONTMATTER";
          }
        }
        if (isFinal) {
          out.push({
            relPath: e.path.startsWith(root + "/") ? e.path.slice(root.length + 1) : e.name,
            fullPath: e.path,
            name: e.name,
            sha: e.sha,
            sizeBytes: e.size,
            isFinal,
            reason,
          });
        }
      }
    }
  }

  await walk(root, 0, false);
  return out;
}
