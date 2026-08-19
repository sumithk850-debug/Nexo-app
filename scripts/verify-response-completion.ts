import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_AUTOMATIC_RESPONSE_CONTINUATIONS,
  RESPONSE_CONTINUATION_MARKER,
  canAutomaticallyContinue,
  consumeResponseContinuationMarker,
} from "../lib/responseContinuation";

const combined = `First section.${RESPONSE_CONTINUATION_MARKER}Second section.`;
const consumed = consumeResponseContinuationMarker(combined);
assert.equal(consumed.shouldContinue, true, "length-limit marker must request a seamless continuation");
assert.equal(consumed.content, "First section.Second section.", "continuation marker must never leak into the transcript");
assert.equal(canAutomaticallyContinue(0), true, "first output-limit continuation must be allowed");
assert.equal(canAutomaticallyContinue(MAX_AUTOMATIC_RESPONSE_CONTINUATIONS - 1), true, "final bounded continuation must be allowed");
assert.equal(canAutomaticallyContinue(MAX_AUTOMATIC_RESPONSE_CONTINUATIONS), false, "automatic continuation must remain bounded");

const githubContextSource = readFileSync("lib/githubContext.server.ts", "utf8");
assert.match(githubContextSource, /MAX_FILE_BYTES = 200_000/, "repository reads must preserve full common application files");
assert.match(githubContextSource, /GITHUB_READ_MAX_ATTEMPTS = 4/, "repository reads must retry transient failures");
assert.match(githubContextSource, /Do not infer, summarize, explain, or propose unrelated work from this unread file/, "unread files must never trigger invented analysis");

const chatRouteSource = readFileSync("app/api/chat/route.ts", "utf8");
assert.match(chatRouteSource, /finish_reason === "length"/, "server must detect an output-limited response");
assert.match(chatRouteSource, /RESPONSE_CONTINUATION_MARKER/, "server must signal output continuation without truncating text");

const pageSource = readFileSync("app/page.tsx", "utf8");
assert.match(pageSource, /needsAutomaticContinuation/, "client must resume output-limited streams automatically");
assert.doesNotMatch(pageSource, /The provider ended before it returned the file findings/, "client must not fabricate partial repository summaries");

console.log("Repository-read retry and response-completion checks passed.");
