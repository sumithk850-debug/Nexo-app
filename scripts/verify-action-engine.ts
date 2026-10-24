import assert from "node:assert/strict";
import { createActionEvent, transitionAction, isTerminalAction, deduplicateActionEvents } from "../lib/actionEngine";

const start = { id: "github-read-1", provider: "github" as const, operation: "read_file", target: "app/page.tsx" };
const queued = createActionEvent(start, "queued", 1);
assert.equal(queued.verification, "none");
const running = transitionAction(queued, "running", undefined, 2);
const verifying = transitionAction(running, "verifying", { phase: "succeeded", summary: "Provider returned file data; checking response.", verification: "provider_acknowledged" }, 3);
const done = transitionAction(verifying, "succeeded", { phase: "succeeded", summary: "File read and result checked.", verification: "result_checked", details: { bytes: 123 } }, 4);
assert.equal(done.phase, "succeeded");
assert.equal(done.verification, "result_checked");
assert.equal(isTerminalAction(done.phase), true);
assert.throws(() => transitionAction(queued, "succeeded", { phase: "succeeded", summary: "No evidence", verification: "none" }), /verified outcome/);
assert.throws(() => transitionAction(done, "running"), /Invalid action transition|Terminal action/);
assert.equal(deduplicateActionEvents([queued, queued, running]).length, 2);
assert.throws(() => createActionEvent({ ...start, target: " " }), /required/);
console.log("Central action engine lifecycle, verification, and deduplication checks passed.");
