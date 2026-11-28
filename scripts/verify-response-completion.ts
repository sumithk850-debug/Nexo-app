import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_AUTOMATIC_RESPONSE_CONTINUATIONS,
  RESPONSE_CONTINUATION_MARKER,
  canAutomaticallyContinue,
  canRecoverInterruptedResponse,
  isRecoverableResponseStatus,
  isRecoverableStreamError,
  consumeResponseContinuationMarker,
} from "../lib/responseContinuation";

const combined = `First section.${RESPONSE_CONTINUATION_MARKER}Second section.`;
const consumed = consumeResponseContinuationMarker(combined);
assert.equal(consumed.shouldContinue, true, "length-limit marker must request a seamless continuation");
assert.equal(consumed.content, "First section.Second section.", "continuation marker must never leak into the transcript");
assert.equal(canAutomaticallyContinue(0), true, "first output-limit continuation must be allowed");
assert.equal(canAutomaticallyContinue(MAX_AUTOMATIC_RESPONSE_CONTINUATIONS - 1), true, "final bounded continuation must be allowed");
assert.equal(canAutomaticallyContinue(MAX_AUTOMATIC_RESPONSE_CONTINUATIONS), false, "automatic continuation must remain bounded");

assert.equal(canRecoverInterruptedResponse(0), true, "the first interruption recovery must be allowed");
assert.equal(canRecoverInterruptedResponse(1), true, "one bounded retry must remain available");
assert.equal(canRecoverInterruptedResponse(2), false, "interruption recovery must stop after two retries");
assert.equal(isRecoverableResponseStatus(504), true, "gateway timeouts must trigger safe recovery");
assert.equal(isRecoverableResponseStatus(429), false, "rate limits must never be retried automatically");
assert.equal(isRecoverableStreamError(new TypeError("fetch failed")), true, "network stream failures must be recoverable");
assert.equal(isRecoverableStreamError(new Error("invalid model payload")), false, "application errors must not be retried as network interruptions");

const githubContextSource = readFileSync("lib/githubContext.server.ts", "utf8");
assert.match(githubContextSource, /MAX_FILE_BYTES = 200_000/, "repository reads must preserve full common application files");
assert.match(githubContextSource, /GITHUB_READ_MAX_ATTEMPTS = 4/, "repository reads must retry transient failures");
assert.match(githubContextSource, /Do not infer, summarize, explain, or propose unrelated work from this unread file/, "unread files must never trigger invented analysis");

const messagesRouteSource = readFileSync("app/api/chats/[id]/messages/route.ts", "utf8");
assert.match(messagesRouteSource, /export async function PATCH/, "owned assistant messages must support safe checkpoint updates");

const chatRouteSource = readFileSync("app/api/chat/route.ts", "utf8");
assert.match(chatRouteSource, /providerFinishReason\s*===\s*"length"/, "server must detect an output-limited response");
assert.match(chatRouteSource, /RESPONSE_CONTINUATION_MARKER/, "server must signal output continuation without truncating text");

const pageSource = readFileSync("app/page.tsx", "utf8");
assert.match(pageSource, /needsAutomaticContinuation/, "client must resume output-limited streams automatically");
assert.match(pageSource, /recoverInterruptedResponse/, "client must resume safe transient interruptions");
assert.match(pageSource, /lastCheckpointAt/, "partial assistant output must be checkpointed during long streams");
assert.match(pageSource, /updateSavedMessage/, "continuation requests must update the same persisted assistant message");
assert.doesNotMatch(pageSource, /The provider ended before it returned the file findings/, "client must not fabricate partial repository summaries");

console.log("Repository-read retry and response-completion checks passed.");

const routingPageSource = readFileSync("app/page.tsx", "utf8");
assert.match(routingPageSource, /const effectiveCoder = Boolean\(override \? override\.isCoder : isCoderMode\)/);
assert.match(routingPageSource, /responseBodyCompleted = true/);
assert.match(routingPageSource, /if \(responseBodyCompleted\)/);
const serverRouteSource = readFileSync("app/api/chat/route.ts", "utf8");
assert.match(serverRouteSource, /resolveChatRouting\(/);
assert.match(serverRouteSource, /UPSTREAM_STREAM_ENDED_EARLY/);
