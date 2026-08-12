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
  summary?: TaskSummary;
}

// The compact task-completion report Craft V3 must emit at the end of a task
// (```task-summary fenced block). Parsed into a structured report card.
export interface TaskSummary {
  status: "completed" | "partial" | "blocked";
  filesRead: string[];
  filesChanged: { path: string; created: boolean; additions?: number; deletions?: number }[];
  filesDeleted: string[];
  details?: string;
}

export interface ParsedTaskSummaryLine {
  summary: TaskSummary;
  start: number;
  end: number; // index right after the closing fence
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

// Matches the task-completion report block:
//   ```task-summary
//   status: completed
//   files read: ...
//   files changed: ...
//   files deleted: ...
//   details: ...
//   ```
const TASK_SUMMARY_BLOCK = /```task-summary\n([\s\S]*?)```/g;

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

  // Prefer an exact match of the FULL removal span so we never delete lines
  // that merely start with the same anchor line somewhere else in the file.
  let anchorIdx = -1;
  for (let i = 0; i + hunk.remove.length <= origLines.length; i++) {
    if (hunk.remove.every((line, k) => origLines[i + k] === line)) {
      anchorIdx = i;
      break;
    }
  }
  const anchor = hunk.remove[0];
  if (anchorIdx === -1) {
    // Fall back to the single anchor line (model may have mis-copied context).
    anchorIdx = origLines.findIndex((line) => line === anchor);
  }
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
function canMarkerOverride(incomingType: FileActionType): boolean {
  return incomingType !== "reading";
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
      if (canMarkerOverride(type)) {
        existing.type = type;
      }
      // else: ignore a "reading" marker for a path that already has a real
      // code-block action — the create/edit stands.
    } else {
  // A marker without a code block or diff. A "reading" marker is only
  // informational narration, but a bare "deleting" or "creating" marker
  // IS a mutating proposal — deletions intentionally carry no content
  // (the commit API deletes by path + sha), so they must trigger the
  // approval card too.
      fileActions.push({
        type,
        filePath,
        language: detectLanguageFromPath(filePath),
      });
    }
  }

  // Task-completion report blocks never count as proposals and are never
  // treated as file content — they are parsed separately above.

  // A response "has a proposal" (needs approval) only when at least one
  // action actually changes repository state — reading alone doesn't. Bare
  // deleting/creating markers also count because the commit flow can act on
  // them without any content block.
  const hasProposal = fileActions.some(
    (f) => f.type === "editing" || f.type === "creating" || f.type === "deleting"
  );

  // Try to detect an auto-generated commit message if the model included one,
  // e.g. a line starting with "Commit message:" or wrapped in quotes near the end.
  const commitMatch = text.match(/commit message:?\s*["']?([^\n"']+)["']?/i);
  const commitMessage = commitMatch ? commitMatch[1].trim() : undefined;

  // Pull the optional task-completion report from the end of the message.
  const summary = parseTaskSummaryBlock(text);

  return { fileActions, hasProposal, commitMessage, summary: summary ?? undefined };
}

// Parses a ```task-summary fenced block (if present) into a structured report.
// Returns null when no such block exists — a missing summary is fine.
export function parseTaskSummaryBlock(text: string): TaskSummary | null {
  const regex = new RegExp(TASK_SUMMARY_BLOCK);
  const match = regex.exec(text);
  if (!match) return null;
  return parseTaskSummaryLines(match[1]);
}

// Parses the KEY : VALUE lines inside a task-summary block. Forgiving:
// malformed or missing lines simply default to safe values so the card
// still renders something useful.
export function parseTaskSummaryLines(raw: string): TaskSummary {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const filesRead: string[] = [];
  const filesChanged: TaskSummary["filesChanged"] = [];
  const filesDeleted: string[] = [];
  let status: TaskSummary["status"] = "completed";
  const detailsParts: string[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "status") {
      if (value === "partial") status = "partial";
      else if (value === "blocked") status = "blocked";
      else status = "completed";
    } else if (key === "files read") {
      for (const part of value.split(",")) {
        const p = part.trim();
        if (p) filesRead.push(p);
      }
    } else if (key === "files changed") {
      // Entries are separated by commas, but counts live inside
      // parentheses — e.g. "~src/a.ts (+2 -1), +src/c.ts (created)". Split
      // carefully so "(+2 -1)" never breaks an entry in two.
      const parts: string[] = [];
      let depth = 0;
      let buf = "";
      for (const ch of value) {
        if (ch === "(") depth++;
        else if (ch === ")") depth = Math.max(0, depth - 1);
        if (ch === "," && depth === 0) {
          parts.push(buf);
          buf = "";
        } else buf += ch;
      }
      parts.push(buf);
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const entry: (typeof filesChanged)[number] = { path: p, created: false };
        // Strip the leading "+" create marker and any "(created)" suffix.
        const cleaned = p.replace(/^[+~-]/, "").replace(/\s*\(created\)\s*/i, "");
        entry.path = cleaned.trim();
        if (p.startsWith("+")) entry.created = true;
        // ~path (+2 -1) style: extract +/- counts, then remove the counts
        // group from the path.
        const counts = cleaned.match(/\(([-+]?\d+)\s+([-+]?\d+)\)/);
        if (counts) {
          const a = parseInt(counts[1], 10);
          const b = parseInt(counts[2], 10);
          if (!Number.isNaN(a)) entry.additions = a;
          if (!Number.isNaN(b)) entry.deletions = b;
          entry.path = cleaned.replace(/\s*\([^)]*\)\s*$/, "").trim();
        } else if (!cleaned.trim()) {
          continue;
        }
        if (entry.path) filesChanged.push(entry);
      }
    } else if (key === "files deleted") {
      for (const part of value.split(",")) {
        const p = part.trim().replace(/^-/, "").trim();
        if (p) filesDeleted.push(p);
      }
    } else if (key === "details") {
      detailsParts.push(value);
    }
  }

  return {
    status,
    filesRead,
    filesChanged,
    filesDeleted,
    details: detailsParts.join(" ").trim() || undefined,
  };
}

// Spans of ```task-summary fenced blocks in the text (start/end indices).
// Used to keep summary blocks out of prose and status cards. Unclosed
// blocks (still mid-stream, no closing fence yet) are included too — they
// extend to the end of the text so streaming output renders a live card.
export function taskSummarySpans(text: string): Array<[number, number]> {
  const regex = new RegExp(TASK_SUMMARY_BLOCK);
  const spans: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) spans.push([match.index, match.index + match[0].length]);
  // Catch an unclosed summary block: ```task-summary appears but no closing
  // fence exists after it.
  const openIdx = text.lastIndexOf("```task-summary");
  if (openIdx !== -1) {
    const closedAny = spans.some(([s, e]) => openIdx >= s && openIdx < e);
    if (!closedAny) spans.push([openIdx, text.length]);
  }
  return spans;
}

// Removes every task-summary block from a response, leaving only the rest.
export function stripTaskSummaryBlocks(text: string): string {
  const spans = taskSummarySpans(text);
  if (spans.length === 0) return text;
  let result = "";
  let cursor = 0;
  for (const [start, end] of spans) {
    result += text.slice(cursor, start);
    cursor = end;
  }
  result += text.slice(cursor);
  return result.replace(/\n{3,}/g, "\n\n").trim();
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

// Server-injected marker for Gemini's built-in Google Search: emitted by
// app/api/chat/route.ts whenever the Gemini stream emits a googleSearchCall
// part. Rendered by the UI as a live "Searching..." pill in the status bar.
export const SEARCHING_MARKER = /\[NEXO:SEARCHING ([^\]]*)\]/g;

export interface SearchingAction {
  type: "searching";
  queries: string[];
}

export type CraftSegment =
  | { kind: "text"; text: string }
  | { kind: "action"; action: FileAction; streaming: boolean }
  | { kind: "searching"; action: SearchingAction; streaming: boolean }
  | { kind: "summary"; summary: TaskSummary; streaming: boolean };

const SEGMENT_SCANNER =
  /```diff:([^\n`]+)\n([\s\S]*?)(?:```|$)|```([A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)(?:```|$)|\[(READING|CREATING|EDITING|DELETING)\s+FILE\][ \t]*([^\n]*)|\[NEXO:SEARCHING ([^\]]*)\]/gi;

function isClosed(text: string, endIndex: number): boolean {
  // A block is complete when the scanner consumed a closing fence.
  return text.slice(Math.max(0, endIndex - 3), endIndex) === "```";
}

function closedBlock(text: string, endIndex: number): boolean {
  return text.slice(Math.max(0, endIndex - 3), endIndex) === "```";
}

export function parseCraftSegments(text: string): CraftSegment[] {
  const segments: CraftSegment[] = [];
  const seenMarkers = new Set<string>();
  const scanner = new RegExp(SEGMENT_SCANNER);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // The ```task-summary block belongs to neither prose nor status cards —
  // it becomes a dedicated "summary" segment rendered as a report card.
  const summarySpans = taskSummarySpans(text);

  const pushText = (raw: string) => {
    if (raw.trim()) segments.push({ kind: "text", text: raw });
  };

  // A helper: skip any text that falls inside a task-summary block.
  const summaryEndAt = (pos: number): number => {
    for (const [, end] of summarySpans) if (pos < end) return end;
    return pos;
  };

  while ((match = scanner.exec(text)) !== null) {
    // The generic code-block arm of the scanner also matches a
    // ```task-summary block (treating "task-summary" as a file path). A
    // summary block must never become a status card — skip the match and
    // let the summary-spans handling below emit the report segment.
    const pathHint = match[4];
    if (pathHint !== undefined && pathHint.trim() === "task-summary") {
      lastIndex = scanner.lastIndex;
      continue;
    }
    // If the scanner landed inside a summary block, jump past the whole block.
    const currentMatch = match;
    if (summarySpans.some(([s, e]) => currentMatch.index >= s && currentMatch.index < e)) {
      const blockEnd = summaryEndAt(currentMatch.index);
      if (lastIndex < blockEnd) {
        const start = summarySpans.find(([s, e]) => currentMatch.index >= s && currentMatch.index < e)![0];
        const blockText = text.slice(Math.max(lastIndex, start), blockEnd);
        const parsed = parseTaskSummaryLines(
          blockText.replace(/^```task-summary\n|```$/g, "").trim()
        );
        if (!segments.some((seg) => seg.kind === "summary")) {
          segments.push({ kind: "summary", streaming: !closedBlock(text, blockEnd), summary: parsed });
        }
      }
      lastIndex = blockEnd;
      continue;
    }
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
    } else if (match[8] !== undefined) {
      // [NEXO:SEARCHING query1, query2] — Gemini performed a real web search
      // (built-in Google Search grounding). Show it as a live "Searching"
      // pill in the status bar; collapse to "Searched" when the response
      // finished.
      const queries = match[8]
        .split(",")
        .map((q) => q.trim())
        .filter(Boolean);
      segments.push({
        kind: "searching",
        streaming: scanner.lastIndex >= text.trimEnd().length,
        action: { type: "searching", queries },
      });
    }
  }

  pushText(text.slice(lastIndex));

  // Any remaining task-summary block that came AFTER the last scanner match.
  for (const [start, end] of summarySpans) {
    if (start < lastIndex) continue;
    if (segments.some((seg) => seg.kind === "summary")) break;
    const blockText = text.slice(start, end).replace(/^```task-summary\n|```$/g, "").trim();
    segments.push({ kind: "summary", streaming: !closedBlock(text, end), summary: parseTaskSummaryLines(blockText) });
  }

  return segments;
}

// Removes every file block and action marker from a response, leaving only the
// prose. Used wherever the raw text is shown outside the segmented renderer.
export function stripFileBlocks(text: string): string {
  return stripTaskSummaryBlocks(
    text.replace(new RegExp(SEGMENT_SCANNER), "").replace(/\n{3,}/g, "\n\n").trim()
  );
}
