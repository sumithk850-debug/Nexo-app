// NEXO AI — Craft V3 response parser
// Parses Craft V3's structured output to detect file operations (read,
// create, edit, delete) so the chat UI can render live status cards and
// build an approval card summarizing all proposed changes.

export type FileActionType = "reading" | "creating" | "editing" | "deleting";

export interface FileAction {
  type: FileActionType;
  filePath: string;
  language?: string;
  newContent?: string;   // for creating
  oldContent?: string;   // for editing/deleting (if known)
  linesChanged?: number;
  // For editing: the parsed diff. hunk is preferred over newContent; the
  // approval flow shows the diff and applies it to the original file content
  // rather than rewriting the full file.
  diffHunk?: DiffHunk;
  diffRaw?: string;
  isDiff?: boolean;
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
// which is the format Craft V3's system prompt instructs it to use. Content
// blocks are used for NEW files only — edits must come as diff blocks.
const CODE_BLOCK_WITH_PATH = /```([A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)```/g;
// NOTE: a generic code-block regex could also match diff blocks (since "diff"
// is a valid language token), so parseCraftResponse processes code blocks
// first and marks them as diffs via the DIFF_BLOCK_WITH_PATH pass — the
// diff pass must run on the raw text independently (see below).
const CODE_BLOCK_WITH_PATH_NONDIFF = /```(?:(?!diff)[A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)```/g;

// Matches diff blocks tagged like:
//   ```diff:src/components/Auth.tsx
//   - old line
//   + new line
//   ```
// which is how Craft V3's system prompt instructs it to propose EDITS —
// only the changed lines, never the full file.
const DIFF_BLOCK_WITH_PATH = /```diff:([^\n`]+)\n([\s\S]*?)```/g;

export interface DiffHunk {
  remove: string[]; // lines to remove (leading "- " stripped)
  add: string[]; // lines to add (leading "+ " stripped)
}

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

// Parses a ```diff:path``` block into hunks of remove/add lines. Returns null
// if the block contains no real changes (only context/whitespace) — such an
// empty diff is a model failure mode and must not produce an approval card.
function parseDiffBlock(raw: string): DiffHunk | null {
  const remove: string[] = [];
  const add: string[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("- ")) {
      remove.push(line.slice(2));
    } else if (line.startsWith("-")) {
      remove.push(line.slice(1));
    } else if (line.startsWith("+ ")) {
      add.push(line.slice(2));
    } else if (line.startsWith("+")) {
      add.push(line.slice(1));
    }
    // lines without a prefix are unchanged context — ignored for the patch
  }

  if (remove.length === 0 && add.length === 0) return null;
  return { remove, add };
}

// Applies a parsed diff hunk to the original file content. It finds the
// removed lines as a contiguous span in the original and replaces that span
// with the added lines. Throws an Error if the removal anchor can't be
// located — the caller must then fall back gracefully instead of silently
// overwriting the file.
export function applyDiff(original: string, hunk: DiffHunk): string {
  const origLines = original.split("\n");

  if (hunk.remove.length === 0) {
    // Pure addition: if a removal anchor can't be located, append the new
    // lines at the end of the file.
    return origLines.concat(hunk.add).join("\n");
  }

  const anchor = hunk.remove[0];
  const anchorIdx = origLines.findIndex((line) => line === anchor);
  if (anchorIdx === -1) {
    throw new Error(`Diff anchor line not found in original file: "${anchor.slice(0, 80)}"`);
  }

  // Replace the matched removal span with the added lines.
  return [
    ...origLines.slice(0, anchorIdx),
    ...hunk.add,
    ...origLines.slice(anchorIdx + hunk.remove.length),
  ].join("\n");
}

// A code block with an explicit file path always represents real proposed
// content (a create or an edit). A "reading" marker for that same path is
// Craft V3 narrating that it looked at the file before proposing the change —
// it must never downgrade or overwrite an already-detected create/edit action.
// Markers are only allowed to refine a code-block action among the mutating
// types (creating/editing/deleting); "reading" can only ever apply to a path
// that has no code block of its own.
function canMarkerOverride(currentType: FileActionType, incomingType: FileActionType): boolean {
  if (incomingType === "reading") return false;
  return true;
}

export function parseCraftResponse(text: string): ParsedCraftResponse {
  const fileActions: FileAction[] = [];
  const seenPaths = new Set<string>();

  // 1. Pull code blocks with explicit file paths — these represent
  // create/edit proposals with full new content. A path seen here is a real
  // mutating action and takes precedence over anything markers claim later.
  // Empty (or whitespace-only) code blocks are a known model failure mode —
  // they must be ignored entirely so no blank approval card is rendered and
  // no empty file is ever committed.
  let match: RegExpExecArray | null;
  // Exclude "diff:" blocks here so they are only handled by the diff pass.
  const codeBlockRegex = new RegExp(CODE_BLOCK_WITH_PATH_NONDIFF);
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const [, path, content] = match;
    const trimmedPath = path.trim();
    const trimmedContent = content.trim();
    if (seenPaths.has(trimmedPath)) continue;
    if (!trimmedContent) continue; // empty block → not a real proposal, skip
    seenPaths.add(trimmedPath);

    fileActions.push({
      type: "editing", // default assumption; refined below if a marker says otherwise
      filePath: trimmedPath,
      language: detectLanguageFromPath(trimmedPath),
      newContent: trimmedContent,
      linesChanged: countLines(trimmedContent),
    });
  }

  // 1b. Pull diff blocks (```diff:path) — these are edit proposals containing
  // only the changed lines. A diff for a path that already has a real code
  // block (e.g. a full content block for a new file) is ignored in favor of
  // that code block.
  const diffRegex = new RegExp(DIFF_BLOCK_WITH_PATH);
  while ((match = diffRegex.exec(text)) !== null) {
    const [, path, rawDiff] = match;
    const trimmedPath = path.trim();
    if (seenPaths.has(trimmedPath)) continue;
    const hunk = parseDiffBlock(rawDiff);
    if (!hunk) continue; // empty diff → skip, no approval card
    seenPaths.add(trimmedPath);

    const changedCount = hunk.add.length + hunk.remove.length;
    fileActions.push({
      type: "editing",
      filePath: trimmedPath,
      language: detectLanguageFromPath(trimmedPath),
      diffHunk: hunk,
      diffRaw: rawDiff.trim(),
      isDiff: true,
      linesChanged: changedCount,
    });
  }

  // 2. Pull explicit action markers and merge/refine type info.
  // Markers for a path that already has a code block (a real create/edit)
  // may only refine it to another mutating type (e.g. "creating" instead of
  // the "editing" default) — a "reading" marker is informational narration
  // and must not overwrite a real proposed change.
  const markerRegex = new RegExp(ACTION_MARKER);
  while ((match = markerRegex.exec(text)) !== null) {
    const [, actionWord, rawPath] = match;
    const filePath = rawPath.trim();
    const type = actionWord.toLowerCase() as FileActionType;

    const existing = fileActions.find((f) => f.filePath === filePath);
    if (existing) {
      if (canMarkerOverride(existing.type, type)) {
        existing.type = type;
      }
      // else: ignore a "reading" marker for a path that already has a real
      // code-block action — the create/edit stands.
    } else {
      // A marker without a code block or diff — informational only (e.g. a
      // "reading" narration). Keep it so the live status cards can show it,
      // but it never counts as a mutating proposal.
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

// ---------------------------------------------------------------------------
// Streaming-friendly segmentation
// ---------------------------------------------------------------------------
// The chat UI must NEVER dump whole file bodies into the message stream. While
// Craft V3 streams, we split its output into ordered segments: plain prose is
// rendered as markdown, while every file operation (read / create / edit /
// delete) collapses into a compact status card showing only the file path and,
// for edits, the changed lines. Blocks that are still mid-stream (no closing
// fence yet) are matched too, so the card appears the moment the operation
// starts instead of after the whole file has been printed.

export type CraftSegment =
  | { kind: "text"; text: string }
  | { kind: "action"; action: FileAction; streaming: boolean };

const SEGMENT_SCANNER =
  /```diff:([^\n`]+)\n([\s\S]*?)(?:```|$)|```([A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)(?:```|$)|\[(READING|CREATING|EDITING|DELETING)\s+FILE\][ \t]*([^\n]*)/gi;

function isClosed(text: string, endIndex: number): boolean {
  // A block is complete when the scanner consumed a closing fence.
  return text.slice(Math.max(0, endIndex - 3), endIndex) === "```";
}

export function parseCraftSegments(text: string): CraftSegment[] {
  const segments: CraftSegment[] = [];
  const seenMarkers = new Set<string>();
  const scanner = new RegExp(SEGMENT_SCANNER);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    if (raw.trim()) segments.push({ kind: "text", text: raw });
  };

  while ((match = scanner.exec(text)) !== null) {
    pushText(text.slice(lastIndex, match.index));
    lastIndex = scanner.lastIndex;
    const closed = isClosed(text, scanner.lastIndex);

    if (match[1] !== undefined) {
      // ```diff:path — an edit: show only the changed lines.
      const filePath = match[1].trim();
      const rawDiff = match[2] ?? "";
      const hunk = parseDiffBlock(rawDiff);
      segments.push({
        kind: "action",
        streaming: !closed,
        action: {
          type: "editing",
          filePath,
          language: detectLanguageFromPath(filePath),
          diffHunk: hunk ?? undefined,
          diffRaw: rawDiff.trim(),
          isDiff: true,
          linesChanged: hunk ? hunk.add.length + hunk.remove.length : 0,
        },
      });
      seenMarkers.add(`editing:${filePath}`);
    } else if (match[4] !== undefined) {
      // ```language:path — a new file: never print its body, only a card.
      const filePath = match[4].trim();
      const content = (match[5] ?? "").trim();
      segments.push({
        kind: "action",
        streaming: !closed,
        action: {
          type: "creating",
          filePath,
          language: match[3] || detectLanguageFromPath(filePath),
          newContent: content,
          linesChanged: content ? countLines(content) : 0,
        },
      });
      seenMarkers.add(`creating:${filePath}`);
    } else if (match[6] !== undefined) {
      const type = match[6].toLowerCase() as FileActionType;
      const filePath = (match[7] ?? "").trim();
      if (!filePath) continue;
      const key = `${type}:${filePath}`;
      if (seenMarkers.has(key)) continue;
      seenMarkers.add(key);
      segments.push({
        kind: "action",
        // A bare marker at the very end of the stream is an operation still
        // in flight — keep it pulsing until more output arrives after it.
        streaming: scanner.lastIndex >= text.trimEnd().length,
        action: {
          type,
          filePath,
          language: detectLanguageFromPath(filePath),
        },
      });
    }
  }

  pushText(text.slice(lastIndex));
  return segments;
}

// Removes every file block and action marker from a response, leaving only the
// prose. Used wherever the raw text is shown outside the segmented renderer.
export function stripFileBlocks(text: string): string {
  return text.replace(new RegExp(SEGMENT_SCANNER), "").replace(/\n{3,}/g, "\n\n").trim();
}
