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

// Generic repo API call (non-Contents endpoints).
async function ghApi(cfg: BrainGitConfig, apiPath: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${apiPath}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "provecta-platform-brain-sync",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${apiPath} → HTTP ${res.status}`);
  return res.json();
}

type TreeEntry = { path: string; type: "blob" | "tree"; sha: string; size?: number };

// One recursive Trees call for the whole branch (vs. per-directory Contents walk).
async function getRecursiveTree(cfg: BrainGitConfig): Promise<{ tree: TreeEntry[]; truncated: boolean }> {
  const branch = (await ghApi(cfg, `branches/${encodeURIComponent(cfg.branch)}`)) as {
    commit: { commit: { tree: { sha: string } } };
  };
  const treeSha = branch.commit.commit.tree.sha;
  const data = (await ghApi(cfg, `git/trees/${treeSha}?recursive=1`)) as { tree: TreeEntry[]; truncated: boolean };
  return { tree: data.tree ?? [], truncated: !!data.truncated };
}

/**
 * Return a tenant's FINAL deliverables. A file is FINAL if it sits under a
 * `FINAL/` directory (detected from the tree — zero content fetches), or (for
 * .md) carries `status: FINAL` front-matter (bounded content scan). Uses ONE
 * recursive Git Trees call instead of walking the Contents API per directory.
 */
export async function listFinalsForFolder(
  cfg: BrainGitConfig,
  brainFolder: string,
  opts?: { frontmatterCap?: number }
): Promise<BrainFile[]> {
  const root = `${cfg.pathPrefix}/${brainFolder}`.replace(/\/+/g, "/");
  const prefix = `${root}/`;
  const { tree } = await getRecursiveTree(cfg);
  const blobs = tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix));

  const out: BrainFile[] = [];
  const mdCandidates: TreeEntry[] = [];
  for (const b of blobs) {
    const name = b.path.slice(b.path.lastIndexOf("/") + 1);
    const underFinal = b.path.slice(root.length).split("/").some((seg) => seg.toUpperCase() === "FINAL");
    if (underFinal) {
      out.push({ relPath: b.path.slice(prefix.length), fullPath: b.path, name, sha: b.sha, sizeBytes: b.size ?? 0, isFinal: true, reason: "FINAL_DIR" });
    } else if (name.toLowerCase().endsWith(".md")) {
      mdCandidates.push(b);
    }
  }

  // Bounded front-matter scan (FINAL/ is the cheap primary path above).
  const cap = opts?.frontmatterCap ?? 30;
  for (const b of mdCandidates.slice(0, cap)) {
    const text = await getFileText(cfg, b.path);
    if (text && hasFinalFrontmatter(text)) {
      const name = b.path.slice(b.path.lastIndexOf("/") + 1);
      out.push({ relPath: b.path.slice(prefix.length), fullPath: b.path, name, sha: b.sha, sizeBytes: b.size ?? 0, isFinal: true, reason: "FRONTMATTER" });
    }
  }
  return out;
}
