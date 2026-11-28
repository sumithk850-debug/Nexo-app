// KYVORIX AI — read-only browsing of PUBLIC GitHub repositories.
//
// These helpers let the assistant find someone's public repository on the web
// and "go inside" it: repository overview + README, folder listings, and single
// text files. They only perform GET requests against api.github.com, validate
// every identifier before it reaches a URL, bound every result, and never touch
// the user's connected repository or credentials. Everything returned is
// untrusted external data.
//
// Deliberately free of "server-only" and "@/" imports so the exact production
// code can also be verified under plain Node.

const GITHUB_API = "https://api.github.com";
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const REF_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,99}$/;
const MAX_PATH_CHARS = 400;
const MAX_FILE_BYTES = 200_000;
const MAX_FILE_CHARS = 8_000;
const MAX_README_CHARS = 5_000;
const MAX_ENTRIES = 80;
const REQUEST_TIMEOUT_MS = 10_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PublicRepoReference {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Normalizes a repository-relative path, or returns null when it is unsafe. */
export function normalizeRepoPath(value: unknown): string | null {
  const raw = cleanString(value, MAX_PATH_CHARS + 1);
  if (raw.length > MAX_PATH_CHARS) return null;
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  if (trimmed.includes("\\") || trimmed.includes("\0")) return null;
  const parts = trimmed.split("/");
  return parts.every((part) => Boolean(part) && part !== "." && part !== "..") ? parts.join("/") : null;
}

/**
 * Accepts "owner/repo", "github.com/owner/repo", a full github.com URL (including
 * /tree/<branch>/<folder> and /blob/<branch>/<file> links) and optional explicit
 * path / ref arguments. Returns null for anything that is not a plain public
 * github.com repository reference.
 */
export function parsePublicRepoReference(input: unknown, pathInput?: unknown, refInput?: unknown): PublicRepoReference | null {
  let value = cleanString(input, 500);
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^(?:www\.)?github\.com$/i.test(url.hostname) || url.username || url.password) return null;
    value = url.pathname;
  } else {
    value = value.replace(/^(?:www\.)?github\.com\//i, "");
  }

  const parts = value.split(/[?#]/)[0].split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo) || repo === "." || repo === "..") return null;

  let embeddedRef: string | undefined;
  let embeddedPath = "";
  if ((parts[2] === "tree" || parts[2] === "blob") && parts[3]) {
    embeddedRef = decodeURIComponentSafe(parts[3]);
    embeddedPath = parts.slice(4).map(decodeURIComponentSafe).join("/");
  }

  const explicitPath = pathInput === undefined || pathInput === null || pathInput === "" ? undefined : normalizeRepoPath(pathInput);
  if (explicitPath === null) return null;
  const path = explicitPath !== undefined ? explicitPath : normalizeRepoPath(embeddedPath);
  if (path === null) return null;

  const explicitRef = cleanString(refInput, 100);
  const ref = explicitRef || embeddedRef;
  if (ref && (!REF_PATTERN.test(ref) || ref.includes("..") || ref.endsWith("/") || ref.endsWith(".lock"))) return null;
  return { owner, repo, path, ...(ref ? { ref } : {}) };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function apiHeaders(accept = "application/vnd.github+json"): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "KYVORIX-AI-Public-Reader/1.0",
  };
  const token = typeof process !== "undefined" ? process.env.GITHUB_PUBLIC_API_TOKEN : undefined;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubGet(url: string, fetchImpl: FetchLike, accept?: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: apiHeaders(accept), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new Error("GitHub's public API is not available right now. Try again shortly.");
  }
  if (response.ok) return response;
  if (response.status === 404) throw new Error("That repository or path was not found, or it is not public.");
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub's public API rate limit has been reached and is not accessible right now. Try again in a few minutes.");
  }
  if (response.status === 451) throw new Error("GitHub reports this repository is not available for legal reasons.");
  throw new Error(`GitHub's public API returned an unexpected response (HTTP ${response.status}) and is not available right now.`);
}

interface ContentEntry {
  name?: unknown;
  path?: unknown;
  type?: unknown;
  size?: unknown;
}

function shapeEntries(items: unknown[]): Array<{ name: string; path: string; type: "file" | "dir" | "other"; size?: number }> {
  return items.slice(0, MAX_ENTRIES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as ContentEntry;
    if (typeof entry.name !== "string" || typeof entry.path !== "string") return [];
    const type = entry.type === "file" ? "file" : entry.type === "dir" ? "dir" : "other";
    return [{ name: entry.name.slice(0, 200), path: entry.path.slice(0, 400), type, ...(typeof entry.size === "number" && type === "file" ? { size: entry.size } : {}) } as { name: string; path: string; type: "file" | "dir" | "other"; size?: number }];
  });
}

/** Decodes a GitHub "contents" file payload to text, or explains why it cannot be shown. */
export function decodeGithubFile(payload: { content?: unknown; encoding?: unknown; size?: unknown }): { text?: string; reason?: string; truncated?: boolean } {
  const size = typeof payload.size === "number" ? payload.size : 0;
  if (size > MAX_FILE_BYTES) return { reason: "This file is larger than the safe read limit." };
  if (payload.encoding !== "base64" || typeof payload.content !== "string") return { reason: "GitHub did not return readable file content." };
  let text: string;
  try {
    text = Buffer.from(payload.content.replace(/\s+/g, ""), "base64").toString("utf8");
  } catch {
    return { reason: "The file content could not be decoded." };
  }
  if (text.slice(0, 8_000).includes("\u0000")) return { reason: "This looks like a binary file, so it cannot be shown as text." };
  return text.length > MAX_FILE_CHARS ? { text: text.slice(0, MAX_FILE_CHARS), truncated: true } : { text };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function githubPublicRepo(
  args: { repo?: unknown; path?: unknown; ref?: unknown },
  fetchImpl: FetchLike = fetch
): Promise<Record<string, unknown>> {
  const reference = parsePublicRepoReference(args.repo, args.path, args.ref);
  if (!reference) throw new Error('Provide a valid public GitHub repository such as "owner/name" or a github.com link. The path or branch was invalid.');
  const { owner, repo, path, ref } = reference;
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";

  const metaResponse = await githubGet(base, fetchImpl);
  const meta = (await metaResponse.json().catch(() => null)) as Record<string, unknown> | null;
  if (!meta || typeof meta.full_name !== "string" || meta.private === true) {
    throw new Error("That repository was not found, or it is not public.");
  }
  const repository = {
    fullName: meta.full_name,
    description: typeof meta.description === "string" ? meta.description.slice(0, 400) : null,
    language: typeof meta.language === "string" ? meta.language : null,
    stars: typeof meta.stargazers_count === "number" ? meta.stargazers_count : null,
    forks: typeof meta.forks_count === "number" ? meta.forks_count : null,
    defaultBranch: typeof meta.default_branch === "string" ? meta.default_branch : null,
    updatedAt: typeof meta.pushed_at === "string" ? meta.pushed_at : null,
    topics: Array.isArray(meta.topics) ? meta.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 12) : [],
    url: typeof meta.html_url === "string" ? meta.html_url : `https://github.com/${owner}/${repo}`,
  };

  if (!path) {
    const [readmeResult, listing] = await Promise.all([
      githubGet(`${base}/readme${refQuery}`, fetchImpl, "application/vnd.github.raw+json").then((res) => res.text()).catch(() => ""),
      githubGet(`${base}/contents${refQuery}`, fetchImpl).then((res) => res.json()).catch(() => null),
    ]);
    const readme = typeof readmeResult === "string" ? readmeResult.slice(0, MAX_README_CHARS) : "";
    return {
      ok: true,
      kind: "overview",
      repository: repository.fullName,
      details: repository,
      path: "",
      entries: Array.isArray(listing) ? shapeEntries(listing) : [],
      readme,
      readmeTruncated: typeof readmeResult === "string" && readmeResult.length > MAX_README_CHARS,
      note: "Public data only. Call this tool again with a path to open a folder or file.",
    };
  }

  const contentResponse = await githubGet(`${base}/contents/${encodePath(path)}${refQuery}`, fetchImpl);
  const payload = (await contentResponse.json().catch(() => null)) as unknown;
  if (Array.isArray(payload)) {
    return { ok: true, kind: "directory", repository: repository.fullName, details: repository, path, entries: shapeEntries(payload), note: "Call this tool again with one of these paths to open it." };
  }
  if (payload && typeof payload === "object" && (payload as { type?: unknown }).type === "file") {
    const file = payload as { size?: unknown; content?: unknown; encoding?: unknown };
    const decoded = decodeGithubFile(file);
    return {
      ok: true,
      kind: "file",
      repository: repository.fullName,
      details: repository,
      path,
      size: typeof file.size === "number" ? file.size : null,
      ...(decoded.text !== undefined ? { content: decoded.text, truncated: decoded.truncated === true } : { content: "", unreadable: decoded.reason ?? "The file could not be shown." }),
    };
  }
  throw new Error("That path was not found in the repository, or it is not a readable file or folder.");
}

export async function githubSearchRepositories(
  args: { query?: unknown; limit?: unknown },
  fetchImpl: FetchLike = fetch
): Promise<Record<string, unknown>> {
  const query = cleanString(args.query, 200).replace(/[\r\n\0]/g, " ").trim();
  if (query.length < 2) throw new Error("A search query of at least two characters is required.");
  const limit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.max(1, Math.min(Math.floor(args.limit), 8)) : 5;
  const response = await githubGet(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`, fetchImpl);
  const payload = (await response.json().catch(() => null)) as { total_count?: unknown; items?: unknown } | null;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    ok: true,
    query,
    totalCount: typeof payload?.total_count === "number" ? payload.total_count : items.length,
    repositories: items.slice(0, limit).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const repo = item as Record<string, unknown>;
      if (typeof repo.full_name !== "string" || repo.private === true) return [];
      return [{
        fullName: repo.full_name,
        description: typeof repo.description === "string" ? repo.description.slice(0, 300) : null,
        language: typeof repo.language === "string" ? repo.language : null,
        stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : null,
        updatedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
        url: typeof repo.html_url === "string" ? repo.html_url : `https://github.com/${repo.full_name}`,
      }];
    }),
    note: 'Tip: search "user:NAME" to list a person\'s repositories, then open one with the repository tool.',
  };
}
