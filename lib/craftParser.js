"use strict";
// NEXO AI — Craft V3 response parser
// Parses Craft V3's structured output to detect file operations (read,
// create, edit, delete) so the chat UI can render live status cards and
// build an approval card summarizing all proposed changes.
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDiff = applyDiff;
exports.parseCraftResponse = parseCraftResponse;
exports.parseCraftSegments = parseCraftSegments;
exports.stripFileBlocks = stripFileBlocks;
// Matches fenced code blocks tagged like:
//   ```typescript:src/components/Auth.tsx
//   ...content...
//   ```
// which is the format Craft V3's system prompt instructs it to use. Content
// blocks are used for NEW files only — edits must come as diff blocks.
var CODE_BLOCK_WITH_PATH = /```([A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)```/g;
// NOTE: a generic code-block regex could also match diff blocks (since "diff"
// is a valid language token), so parseCraftResponse processes code blocks
// first and marks them as diffs via the DIFF_BLOCK_WITH_PATH pass — the
// diff pass must run on the raw text independently (see below).
var CODE_BLOCK_WITH_PATH_NONDIFF = /```(?:(?!diff)[A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)```/g;
// Matches diff blocks tagged like:
//   ```diff:src/components/Auth.tsx
//   - old line
//   + new line
//   ```
// which is how Craft V3's system prompt instructs it to propose EDITS —
// only the changed lines, never the full file.
var DIFF_BLOCK_WITH_PATH = /```diff:([^\n`]+)\n([\s\S]*?)```/g;
// Matches inline action markers the model can emit, e.g.:
//   [READING FILE] src/auth/login.js
//   [CREATING FILE] src/hooks/useAuth.js
//   [DELETING FILE] src/old_utils.js
var ACTION_MARKER = /\[(READING|CREATING|EDITING|DELETING)\s+FILE\]\s*([^\n]+)/gi;
function detectLanguageFromPath(path) {
    var _a, _b, _c;
    var ext = (_b = (_a = path.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
    var map = {
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
    return (_c = map[ext]) !== null && _c !== void 0 ? _c : "text";
}
function countLines(content) {
    return content.split("\n").length;
}
// Parses a ```diff:path``` block into hunks of remove/add lines. Returns null
// if the block contains no real changes (only context/whitespace) — such an
// empty diff is a model failure mode and must not produce an approval card.
function parseDiffBlock(raw) {
    var remove = [];
    var add = [];
    for (var _i = 0, _a = raw.split("\n"); _i < _a.length; _i++) {
        var rawLine = _a[_i];
        var line = rawLine.trimEnd();
        if (line.startsWith("- ")) {
            remove.push(line.slice(2));
        }
        else if (line.startsWith("-")) {
            remove.push(line.slice(1));
        }
        else if (line.startsWith("+ ")) {
            add.push(line.slice(2));
        }
        else if (line.startsWith("+")) {
            add.push(line.slice(1));
        }
        // lines without a prefix are unchanged context — ignored for the patch
    }
    if (remove.length === 0 && add.length === 0)
        return null;
    return { remove: remove, add: add };
}
// Applies a parsed diff hunk to the original file content. It finds the
// removed lines as a contiguous span in the original and replaces that span
// with the added lines. Throws an Error if the removal anchor can't be
// located — the caller must then fall back gracefully instead of silently
// overwriting the file.
function applyDiff(original, hunk) {
    var origLines = original.split("\n");
    if (hunk.remove.length === 0) {
        // Pure addition: if a removal anchor can't be located, append the new
        // lines at the end of the file.
        return origLines.concat(hunk.add).join("\n");
    }
    var anchor = hunk.remove[0];
    var anchorIdx = origLines.findIndex(function (line) { return line === anchor; });
    if (anchorIdx === -1) {
        throw new Error("Diff anchor line not found in original file: \"".concat(anchor.slice(0, 80), "\""));
    }
    // Replace the matched removal span with the added lines.
    return __spreadArray(__spreadArray(__spreadArray([], origLines.slice(0, anchorIdx), true), hunk.add, true), origLines.slice(anchorIdx + hunk.remove.length), true).join("\n");
}
// A code block with an explicit file path always represents real proposed
// content (a create or an edit). A "reading" marker for that same path is
// Craft V3 narrating that it looked at the file before proposing the change —
// it must never downgrade or overwrite an already-detected create/edit action.
// Markers are only allowed to refine a code-block action among the mutating
// types (creating/editing/deleting); "reading" can only ever apply to a path
// that has no code block of its own.
function canMarkerOverride(currentType, incomingType) {
    if (incomingType === "reading")
        return false;
    return true;
}
function parseCraftResponse(text) {
    var fileActions = [];
    var seenPaths = new Set();
    // 1. Pull code blocks with explicit file paths — these represent
    // create/edit proposals with full new content. A path seen here is a real
    // mutating action and takes precedence over anything markers claim later.
    // Empty (or whitespace-only) code blocks are a known model failure mode —
    // they must be ignored entirely so no blank approval card is rendered and
    // no empty file is ever committed.
    var match;
    // Exclude "diff:" blocks here so they are only handled by the diff pass.
    var codeBlockRegex = new RegExp(CODE_BLOCK_WITH_PATH_NONDIFF);
    while ((match = codeBlockRegex.exec(text)) !== null) {
        var path = match[1], content = match[2];
        var trimmedPath = path.trim();
        var trimmedContent = content.trim();
        if (seenPaths.has(trimmedPath))
            continue;
        if (!trimmedContent)
            continue; // empty block → not a real proposal, skip
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
    var diffRegex = new RegExp(DIFF_BLOCK_WITH_PATH);
    while ((match = diffRegex.exec(text)) !== null) {
        var path = match[1], rawDiff = match[2];
        var trimmedPath = path.trim();
        if (seenPaths.has(trimmedPath))
            continue;
        var hunk = parseDiffBlock(rawDiff);
        if (!hunk)
            continue; // empty diff → skip, no approval card
        seenPaths.add(trimmedPath);
        var changedCount = hunk.add.length + hunk.remove.length;
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
    var markerRegex = new RegExp(ACTION_MARKER);
    var _loop_1 = function () {
        var actionWord = match[1], rawPath = match[2];
        var filePath = rawPath.trim();
        var type = actionWord.toLowerCase();
        var existing = fileActions.find(function (f) { return f.filePath === filePath; });
        if (existing) {
            if (canMarkerOverride(existing.type, type)) {
                existing.type = type;
            }
            // else: ignore a "reading" marker for a path that already has a real
            // code-block action — the create/edit stands.
        }
        else {
            // A marker without a code block or diff. A "reading" marker is only
            // informational narration, but a bare "deleting" or "creating" marker
            // IS a mutating proposal — deletions intentionally carry no content
            // (the commit API deletes by path + sha), so they must trigger the
            // approval card too.
            fileActions.push({
                type: type,
                filePath: filePath,
                language: detectLanguageFromPath(filePath),
            });
        }
    };
    while ((match = markerRegex.exec(text)) !== null) {
        _loop_1();
    }
    // A response "has a proposal" (needs approval) only when at least one
    // action actually changes repository state — reading alone doesn't. Bare
    // deleting/creating markers also count because the commit flow can act on
    // them without any content block.
    var hasProposal = fileActions.some(function (f) { return f.type === "editing" || f.type === "creating" || f.type === "deleting"; });
    // Try to detect an auto-generated commit message if the model included one,
    // e.g. a line starting with "Commit message:" or wrapped in quotes near the end.
    var commitMatch = text.match(/commit message:?\s*["']?([^\n"']+)["']?/i);
    var commitMessage = commitMatch ? commitMatch[1].trim() : undefined;
    return { fileActions: fileActions, hasProposal: hasProposal, commitMessage: commitMessage };
}
var SEGMENT_SCANNER = /```diff:([^\n`]+)\n([\s\S]*?)(?:```|$)|```([A-Za-z0-9#_+-]+):([^\n`]+)\n([\s\S]*?)(?:```|$)|\[(READING|CREATING|EDITING|DELETING)\s+FILE\][ \t]*([^\n]*)/gi;
function isClosed(text, endIndex) {
    // A block is complete when the scanner consumed a closing fence.
    return text.slice(Math.max(0, endIndex - 3), endIndex) === "```";
}
function parseCraftSegments(text) {
    var _a, _b, _c;
    var segments = [];
    var seenMarkers = new Set();
    var scanner = new RegExp(SEGMENT_SCANNER);
    var lastIndex = 0;
    var match;
    var pushText = function (raw) {
        if (raw.trim())
            segments.push({ kind: "text", text: raw });
    };
    while ((match = scanner.exec(text)) !== null) {
        pushText(text.slice(lastIndex, match.index));
        lastIndex = scanner.lastIndex;
        var closed_1 = isClosed(text, scanner.lastIndex);
        if (match[1] !== undefined) {
            // ```diff:path — an edit: show only the changed lines.
            var filePath = match[1].trim();
            var rawDiff = (_a = match[2]) !== null && _a !== void 0 ? _a : "";
            var hunk = parseDiffBlock(rawDiff);
            segments.push({
                kind: "action",
                streaming: !closed_1,
                action: {
                    type: "editing",
                    filePath: filePath,
                    language: detectLanguageFromPath(filePath),
                    diffHunk: hunk !== null && hunk !== void 0 ? hunk : undefined,
                    diffRaw: rawDiff.trim(),
                    isDiff: true,
                    linesChanged: hunk ? hunk.add.length + hunk.remove.length : 0,
                },
            });
            seenMarkers.add("editing:".concat(filePath));
        }
        else if (match[4] !== undefined) {
            // ```language:path — a new file: never print its body, only a card.
            var filePath = match[4].trim();
            var content = ((_b = match[5]) !== null && _b !== void 0 ? _b : "").trim();
            segments.push({
                kind: "action",
                streaming: !closed_1,
                action: {
                    type: "creating",
                    filePath: filePath,
                    language: match[3] || detectLanguageFromPath(filePath),
                    newContent: content,
                    linesChanged: content ? countLines(content) : 0,
                },
            });
            seenMarkers.add("creating:".concat(filePath));
        }
        else if (match[6] !== undefined) {
            var type = match[6].toLowerCase();
            var filePath = ((_c = match[7]) !== null && _c !== void 0 ? _c : "").trim();
            if (!filePath)
                continue;
            var key = "".concat(type, ":").concat(filePath);
            if (seenMarkers.has(key))
                continue;
            seenMarkers.add(key);
            segments.push({
                kind: "action",
                // A bare marker at the very end of the stream is an operation still
                // in flight — keep it pulsing until more output arrives after it.
                streaming: scanner.lastIndex >= text.trimEnd().length,
                action: {
                    type: type,
                    filePath: filePath,
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
function stripFileBlocks(text) {
    return text.replace(new RegExp(SEGMENT_SCANNER), "").replace(/\n{3,}/g, "\n\n").trim();
}
