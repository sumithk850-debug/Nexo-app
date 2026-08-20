import assert from "node:assert/strict";
import {
  countFileLines,
  createProposedFileActivities,
  createVerifiedReadActivities,
  mergeFileActivities,
} from "../lib/fileActivity";

const readActivities = createVerifiedReadActivities(["app/page.tsx", "app/page.tsx", "lib/auth.ts"]);
assert.equal(readActivities.length, 2, "Verified read previews must be de-duplicated by file path");
assert.equal(readActivities[0].state, "loading", "Verified read previews must start in a real loading state");
assert.equal(readActivities[0].action, "reading", "Verified read preview must retain its read action");

const proposed = createProposedFileActivities([
  { type: "reading", filePath: "ignored.ts" },
  {
    type: "editing",
    filePath: "app/page.tsx",
    language: "typescript",
    diffRaw: "- old line\n+ new line",
    diffHunk: { remove: ["old line"], add: ["new line"] },
  },
  { type: "creating", filePath: "lib/new-file.ts", newContent: "export const ready = true;" },
]);
assert.equal(proposed.length, 2, "Read narration must not create an unverified proposed-change preview");
assert.equal(proposed[0].state, "proposed", "Edits must stay proposed until an approved commit is verified");
assert.equal(proposed[0].diff, "- old line\n+ new line", "Edit previews must retain the diff for the viewer");
assert.equal(proposed[1].lineCount, 1, "Create previews must expose their actual proposed line count");

const hydrated = mergeFileActivities(readActivities, [{
  ...readActivities[0],
  state: "success",
  content: "line one\nline two",
  lineCount: countFileLines("line one\nline two"),
  message: "Verified live file from the selected GitHub repository.",
}]);
assert.equal(hydrated.length, 2, "Hydrating a read preview must replace it instead of duplicating it");
assert.equal(hydrated[0].state, "success", "A successful GitHub fetch must update the preview state");
assert.equal(hydrated[0].lineCount, 2, "Full file viewer metadata must count all lines");

const stable = mergeFileActivities(hydrated, [hydrated[0]]);
assert.strictEqual(stable, hydrated, "Unchanged artifact lists must preserve identity and avoid redundant message updates");
assert.strictEqual(stable[0], hydrated[0], "Unchanged artifacts must preserve identity and avoid redundant message updates");

console.log("File activity preview verification passed.");
