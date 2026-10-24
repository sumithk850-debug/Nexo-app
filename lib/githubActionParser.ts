export type GitHubActionState = "success" | "error" | "needs_connection";
export type GitHubActionOperation = "read_file" | "list_files";

export interface GitHubActionActivity {
  id: string;
  operation: GitHubActionOperation;
  state: GitHubActionState;
  repository?: string;
  target: string;
  summary: string;
  url?: string;
}

const BLOCK = /```github-live-action\s*\n([\s\S]*?)```/gi;
const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeActivity(value: unknown, index: number): GitHubActionActivity | null {
  if (!isRecord(value)) return null;
  const operation = value.operation;
  const state = value.state;
  const target = typeof value.target === "string" ? value.target.trim().slice(0, 400) : "";
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 500) : "";
  const repository = typeof value.repository === "string" && SAFE_REPOSITORY.test(value.repository)
    ? value.repository
    : undefined;
  const rawUrl = typeof value.url === "string" ? value.url : "";
  const url = rawUrl.startsWith("https://github.com/") && !rawUrl.includes("@")
    ? rawUrl.slice(0, 1000)
    : undefined;

  if (
    (operation !== "read_file" && operation !== "list_files") ||
    (state !== "success" && state !== "error" && state !== "needs_connection") ||
    !target || !summary
  ) return null;

  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id.slice(0, 120) : `github-action-${index + 1}`,
    operation,
    state,
    repository,
    target,
    summary,
    url,
  };
}

export function parseGitHubActionActivitiesHeader(header: string | null): GitHubActionActivity[] {
  if (!header) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 6).map(normalizeActivity).filter((item): item is GitHubActionActivity => item !== null);
  } catch {
    return [];
  }
}

export function createGitHubActionBlock(activity: GitHubActionActivity): string {
  return ```github-live-action
${JSON.stringify(activity)}
```;
}

export function parseGitHubActionBlocks(content: string): GitHubActionActivity[] {
  const cards: GitHubActionActivity[] = [];
  let index = 0;
  for (const match of content.matchAll(BLOCK)) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const activity = normalizeActivity(parsed, index++);
      if (activity) cards.push(activity);
    } catch {
      // Invalid marker blocks are ignored and never rendered as executable content.
    }
  }
  return cards;
}

export function stripGitHubActionBlocks(content: string): string {
  return content.replace(BLOCK, "").replace(/\n{3,}/g, "\n\n").trim();
}
