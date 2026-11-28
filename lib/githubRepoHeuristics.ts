// KYVORIX AI — decides when a message is about the user's connected repository
// and which files are worth reading automatically. Pure and dependency-free so
// it can be verified directly; the network reads live in githubContext.server.ts.

// When the user asks about the repository without naming a file, a few
// well-chosen files are read automatically so the assistant can really answer.
export const MAX_AUTO_FILES = 5;
export const MAX_AUTO_FILE_CHARS = 14_000;
export const MAX_AUTO_TOTAL_CHARS = 48_000;
export const MAX_TREE_PATHS_SHOWN = 300;

/** Does this message talk about the user's connected code or repository? */
export function isRepositoryQuestion(text: string): boolean {
  return REPOSITORY_WORDS.test(text) || SINHALA_REPOSITORY_WORDS.test(text);
}

// Deliberately specific: generic words such as "file", "review" or "bug" appear
// in everyday chat and must not trigger repository reads.
const REPOSITORY_WORDS = /\b(?:repo|repos|repository|repositories|github|git hub|codebase|code base|readme|commits?|branch(?:es)?|pull requests?|source code|(?:my|our|the)\s+(?:code|project|app|website|site|backend|frontend)|project\s+(?:structure|files|folders)|(?:file|folder|directory)\s+structure)\b/i;
const SINHALA_REPOSITORY_WORDS = /රෙපෝ|රිපෝ|රිපොසිටරි|ගිතුබ්|මගේ\s*(?:ප්‍රොජෙක්ට්|ව්‍යාපෘති|කෝඩ්|කේතය|වෙබ්සයිට්|ඇප්)/i;

const ORIENTATION_FILES: Array<{ pattern: RegExp; limit: number }> = [
  { pattern: /^readme(?:\.[a-z]+)?$/i, limit: 1 },
  { pattern: /^package\.json$/, limit: 1 },
  { pattern: /^(?:pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|pom\.xml|build\.gradle|composer\.json|gemfile)$/i, limit: 2 },
];
const SKIPPED_PATH = /(?:^|\/)(?:node_modules|\.next|dist|build|coverage|vendor|\.git)\/|(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|woff2?|ttf|mp[34]|mov|lock|map|min\.js)$/i;

/**
 * Chooses files to read when the user did not name one: the repository's
 * orientation files (README, package manifest) plus the source files whose
 * path best matches the words in the message. Only paths that really exist in
 * the tree are returned.
 */
export function chooseAutoFiles(userText: string, treePaths: string[]): string[] {
  const candidates = treePaths.filter((path) => !SKIPPED_PATH.test(path));
  const chosen: string[] = [];
  const add = (path: string | undefined) => {
    if (path && !chosen.includes(path) && chosen.length < MAX_AUTO_FILES) chosen.push(path);
  };

  // Top-level orientation files first (shallowest path wins).
  for (const { pattern, limit } of ORIENTATION_FILES) {
    candidates
      .filter((path) => pattern.test(path.split("/").pop() ?? "") && path.split("/").length <= 2)
      .sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)
      .slice(0, limit)
      .forEach(add);
  }

  // Then files whose path shares words with the message.
  const words = [...new Set((userText.toLowerCase().match(/[a-z0-9_.-]{4,}/g) ?? []).filter((word) => !STOP_WORDS.has(word)))];
  if (words.length > 0) {
    const scored = candidates
      .map((path) => {
        const lower = path.toLowerCase();
        const score = words.reduce((total, word) => total + (lower.includes(word) ? (lower.split("/").pop()!.includes(word) ? 3 : 1) : 0), 0);
        return { path, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length);
    for (const entry of scored) add(entry.path);
  }
  return chosen;
}

const STOP_WORDS = new Set([
  "this", "that", "with", "from", "have", "what", "when", "where", "which", "your", "about", "into", "them", "then",
  "does", "doing", "show", "tell", "explain", "please", "look", "check", "read", "repo", "repository", "github", "file", "files",
  "code", "project", "there", "here", "would", "could", "should", "make", "need", "want", "like", "also", "just", "some",
]);

export function summarizeTree(treePaths: string[]): string {
  if (treePaths.length <= MAX_TREE_PATHS_SHOWN) return treePaths.join("\n");
  // Very large repository: show the top-level layout with counts, then the first paths.
  const counts = new Map<string, number>();
  for (const path of treePaths) {
    const top = path.includes("/") ? `${path.split("/")[0]}/` : "(root files)";
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  const layout = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} — ${count} files`).join("\n");
  return `TOP-LEVEL LAYOUT:\n${layout}\n\nFIRST ${MAX_TREE_PATHS_SHOWN} PATHS:\n${treePaths.slice(0, MAX_TREE_PATHS_SHOWN).join("\n")}\n... [${treePaths.length - MAX_TREE_PATHS_SHOWN} more files not shown]`;
}

