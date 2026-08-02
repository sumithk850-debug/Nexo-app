// NEXO AI — Craft V3 response parser
// Parses Craft V3's structured output to detect file operations (read,
// create, edit, delete) so the chat UI can render live status cards and
// build an approval card summarizing all proposed changes.

export type FileActionType = "reading" | "creating" | "editing" | "deleting";

export interface FileAction {
  type: FileActionType;
  filePath: string;
  language?: string;
  newContent?: string;   // for creating/editing
  oldContent?: string;   // for editing/deleting (if known)
  linesChanged?: number;
}

export interface ParsedCraftResponse {
  fileActions: FileAction[];
  hasProposal: boolean;
  commitMessage?: string;
}

// Matches fenced code blocks tagged like:
//   ```typescript:src/components/Auth.tsx
//   ...content...
//   ```
// which is the format Craft V3's system prompt instructs it to use.
const CODE_BLOCK_WITH_PATH = /```(\w+):([^\n`]+)\n([\s\S]*?)```/g;

// Matches inline action markers the model can emit, e.g.:
//   [READING FILE] src/auth/login.js
//   [CREATING FILE] src/hooks/useAuth.js
//   [DELETING FILE] src/old_utils.js
const ACTION_MARKER = /\[(READING|CREATING|EDITING|DELETING)\s+FILE\]\s*([^\n]+)/gi;

function detectLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
  };
  return map[ext] ?? "text";
}

function countLines(content: string): number {
  return content.split("\n").length;
}

export function parseCraftResponse(text: string): ParsedCraftResponse {
  const fileActions: FileAction[] = [];
  const seenPaths = new Set<string>();

  // 1. Pull code blocks with explicit file paths — these represent
  // create/edit proposals with full new content.
  let match: RegExpExecArray | null;
  const codeBlockRegex = new RegExp(CODE_BLOCK_WITH_PATH);
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [, lang, path, content] = match;
    const trimmedPath = path.trim();
    if (seenPaths.has(trimmedPath)) continue;
    seenPaths.add(trimmedPath);

    fileActions.push({
      type: "editing", // default assumption; refined below if a marker says otherwise
      filePath: trimmedPath,
      language: lang || detectLanguageFromPath(trimmedPath),
      newContent: content.trim(),
      linesChanged: countLines(content.trim()),
    });
  }

  // 2. Pull explicit action markers and merge/refine type info.
  const markerRegex = new RegExp(ACTION_MARKER);
  while ((match = markerRegex.exec(text)) !== null) {
    const [, actionWord, rawPath] = match;
    const filePath = rawPath.trim();
    const type = actionWord.toLowerCase() as FileActionType;

    const existing = fileActions.find((f) => f.filePath === filePath);
    if (existing) {
      existing.type = type;
    } else {
      fileActions.push({
        type,
        filePath,
        language: detectLanguageFromPath(filePath),
      });
    }
  }

  // A response "has a proposal" (needs approval) only when at least one
  // action actually changes repository state — reading alone doesn't.
  const hasProposal = fileActions.some((f) => f.type !== "reading");

  // Try to detect an auto-generated commit message if the model included one,
  // e.g. a line starting with "Commit message:" or wrapped in quotes near the end.
  const commitMatch = text.match(/commit message:?\s*["']?([^\n"']+)["']?/i);
  const commitMessage = commitMatch ? commitMatch[1].trim() : undefined;

  return { fileActions, hasProposal, commitMessage };
}
