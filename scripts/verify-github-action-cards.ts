import assert from "node:assert/strict";
import {
  createGitHubActionBlock,
  parseGitHubActionActivitiesHeader,
  parseGitHubActionBlocks,
  stripGitHubActionBlocks,
  type GitHubActionActivity,
} from "../lib/githubActionParser";

const readActivity: GitHubActionActivity = {
  id: "read-1",
  operation: "read_file",
  state: "success",
  repository: "sumithk850-debug/Nexo-app",
  target: "app/page.tsx",
  summary: "GitHub confirmed the file content was fetched.",
  url: "https://github.com/sumithk850-debug/Nexo-app",
};

const block = createGitHubActionBlock(readActivity);
assert.deepEqual(parseGitHubActionBlocks(block), [readActivity]);
assert.equal(stripGitHubActionBlocks(`Before\n\n${block}\n\nAfter`), "Before\n\nAfter");

const header = encodeURIComponent(JSON.stringify([readActivity, {
  ...readActivity,
  id: "failed-1",
  operation: "list_files",
  state: "error",
  target: "app",
  summary: "GitHub could not list this folder.",
  url: "javascript:alert(1)",
}]));
const parsedHeader = parseGitHubActionActivitiesHeader(header);
assert.equal(parsedHeader.length, 2);
assert.equal(parsedHeader[0].state, "success");
assert.equal(parsedHeader[1].state, "error");
assert.equal(parsedHeader[1].url, undefined, "non-GitHub links must be rejected");
assert.deepEqual(parseGitHubActionActivitiesHeader("%invalid"), []);
assert.deepEqual(parseGitHubActionActivitiesHeader(encodeURIComponent(JSON.stringify([{ ...readActivity, state: "completed" }]))), []);

console.log("GitHub action card parsing and safety checks passed.");
