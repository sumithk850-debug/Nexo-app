import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyProgressSnapshot,
  consumeProgressMarkers,
  createProgressMarker,
  detectProgressLanguage,
  formatStepDuration,
  parseProgressSnapshot,
  prepareProgressForStorage,
  consumeSummaryMarkers,
  cleanHeadline,
  setProgressHeadline,
  withoutLocalSendStep,
  progressLabel,
  progressStatusForPhase,
  removeProgressStep,
  startProgress,
  upsertProgressStep,
  summarizeProgress,
  type MessageProgress,
  type ProgressSnapshot,
  type ProgressStep,
} from "../lib/progressSteps";
import {
  TASK_SUMMARY_RULE,
  HTTP_ENVELOPE_CLOSE,
  HTTP_ENVELOPE_OPEN,
  LIVE_PROGRESS_REQUEST_HEADER as SERVER_REQUEST_HEADER,
  LIVE_PROGRESS_RESPONSE_HEADER as SERVER_RESPONSE_HEADER,
  NoopProgressTracker,
  ProgressTracker,
  withLiveProgress,
} from "../lib/progressStream.server";
import {
  LIVE_PROGRESS_REQUEST_HEADER as CLIENT_REQUEST_HEADER,
  LIVE_PROGRESS_RESPONSE_HEADER as CLIENT_RESPONSE_HEADER,
  resolveLiveProgressResponse,
} from "../lib/liveProgress";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (path: string) => readFileSync(path, "utf8");

async function main() {
  // -------------------------------------------------------------------------
  // 1. Protocol constants must agree between server and browser.
  // -------------------------------------------------------------------------
  assert.equal(SERVER_REQUEST_HEADER.toLowerCase(), CLIENT_REQUEST_HEADER.toLowerCase());
  assert.equal(SERVER_RESPONSE_HEADER, CLIENT_RESPONSE_HEADER);
  assert.equal(HTTP_ENVELOPE_OPEN, "<kyvorix-http>");
  assert.equal(HTTP_ENVELOPE_CLOSE, "</kyvorix-http>");

  // -------------------------------------------------------------------------
  // 2. Marker round trip, validation, and chunk-split safety.
  // -------------------------------------------------------------------------
  const sample: ProgressSnapshot = {
    lang: "si",
    steps: [
      { id: "read", key: "read", label: "ඔබේ පණිවිඩය කියවමින්", status: "done", startedAt: 1000, endedAt: 1100 },
      { id: "tool:1", key: "tool", label: "GitHub read file ක්‍රියාත්මක කරමින් </kyvorix-progress><b>", detail: "a\nb", status: "running", startedAt: 1200 },
    ],
  };
  const marker = createProgressMarker(sample);
  assert.ok(!marker.slice(18, -19).includes("<"), "Marker payload must escape '<'");
  const whole = consumeProgressMarkers(`Hello ${marker} world`);
  assert.equal(whole.content, "Hello  world");
  assert.equal(whole.snapshots.length, 1);
  assert.equal(whole.snapshots[0].lang, "si");
  assert.equal(whole.snapshots[0].steps[1].detail, "a b", "Control characters must be sanitized");
  assert.ok(whole.snapshots[0].steps[1].label.includes("</kyvorix-progress>"), "Step text must survive without closing the marker early");
  assert.equal(whole.pending, "");

  // Every possible split point of a marker inside a text stream must reassemble.
  const text = `Answer part one. ${marker}Answer part two ✓ සිංහල.`;
  for (let split = 1; split < text.length; split++) {
    let buffer = "";
    let output = "";
    const seen: ProgressSnapshot[] = [];
    for (const piece of [text.slice(0, split), text.slice(split)]) {
      const consumed = consumeProgressMarkers(buffer + piece);
      buffer = consumed.pending;
      output += consumed.content;
      seen.push(...consumed.snapshots);
    }
    assert.equal(output + buffer, "Answer part one. Answer part two ✓ සිංහල.", `Split at ${split} corrupted text`);
    assert.equal(seen.length, 1, `Split at ${split} lost the marker`);
  }
  assert.deepEqual(consumeProgressMarkers("<kyvorix-progress>{not json}</kyvorix-progress>ok").content, "ok");
  assert.equal(parseProgressSnapshot({ lang: "en", steps: [{ id: "x", key: "nope", label: "x", status: "done", startedAt: 1 }] })?.steps.length, 0, "Unknown step keys are ignored");
  assert.equal(parseProgressSnapshot("nope"), null);
  // A literal "<" at the very end of text is held back, not lost.
  const held = consumeProgressMarkers("a < b <");
  assert.equal(held.content + held.pending, "a < b <");

  // -------------------------------------------------------------------------
  // 3. Labels, language and summaries.
  // -------------------------------------------------------------------------
  assert.equal(detectProgressLanguage("hello"), "en");
  assert.equal(detectProgressLanguage("ආයුබෝවන්"), "si");
  assert.equal(detectProgressLanguage("hello", "sinhala"), "si");
  assert.equal(detectProgressLanguage("ආයුබෝවන්", "english"), "en");
  assert.equal(progressLabel("tool", "en", "GitHub read file"), "Running GitHub read file");
  assert.ok(progressLabel("answer", "si").length > 0);

  // -------------------------------------------------------------------------
  // 4. Tracker behavior: lazy steps, skip, relabeling, finish.
  // -------------------------------------------------------------------------
  {
    const emitted: ProgressSnapshot[] = [];
    const tracker = new ProgressTracker((snapshot) => emitted.push(snapshot), 40);
    tracker.start("read");
    tracker.done("read");
    // A lazy step that finishes quickly never appears.
    tracker.start("context", { lazy: true });
    tracker.done("context");
    // A lazy step that is skipped never appears either.
    tracker.start("github", { lazy: true });
    tracker.skip("github");
    // A lazy step that runs long becomes visible.
    tracker.start("tools", { lazy: true });
    await sleep(80);
    let last = emitted[emitted.length - 1];
    assert.deepEqual(last.steps.map((step) => step.key), ["read", "tools"]);
    assert.equal(last.steps[1].status, "running");
    // A lazy step can be explicitly revealed when it did meaningful work.
    tracker.start("wikipedia", { lazy: true });
    tracker.done("wikipedia", { reveal: true, detail: "3 articles" });
    last = emitted[emitted.length - 1];
    assert.ok(last.steps.some((step) => step.key === "wikipedia" && step.detail === "3 articles"));
    // Switching language relabels existing steps.
    tracker.setLanguage("si");
    last = emitted[emitted.length - 1];
    assert.equal(last.lang, "si");
    assert.equal(last.steps[0].label, progressLabel("read", "si"));
    // Repeated tools keep distinct ids.
    tracker.start("tool", { id: "tool:1", arg: "GitHub list files" });
    tracker.done("tool", { id: "tool:1" });
    tracker.start("tool", { id: "tool:2", arg: "GitHub read file" });
    tracker.fail("tool", { id: "tool:2" });
    last = emitted[emitted.length - 1];
    assert.equal(last.steps.find((step) => step.id === "tool:2")?.status, "failed");
    // finish() resolves anything still running and stops further emissions.
    tracker.finish("done");
    last = emitted[emitted.length - 1];
    assert.ok(last.steps.every((step) => step.status !== "running"));
    const count = emitted.length;
    tracker.start("answer");
    tracker.done("answer");
    assert.equal(emitted.length, count, "No emissions after finish()");
    // Timers must not keep the process alive or fire after disposal.
    const quiet = new ProgressTracker(() => assert.fail("emitted after dispose"), 10);
    quiet.start("context", { lazy: true });
    quiet.dispose();
    await sleep(30);
  }

  // -------------------------------------------------------------------------
  // 5. Server wrapper <-> browser resolver, end to end.
  // -------------------------------------------------------------------------
  const liveRequest = () => new Request("http://localhost/api/chat", { method: "POST", headers: { [CLIENT_REQUEST_HEADER]: "1" } });
  const plainRequest = () => new Request("http://localhost/api/chat", { method: "POST" });
  const encoder = new TextEncoder();

  // 5a. Without the opt-in header the handler's Response is returned untouched.
  {
    const original = new Response("plain body", { status: 200, headers: { "Content-Type": "text/plain" } });
    const result = await withLiveProgress(plainRequest(), async (tracker) => {
      assert.ok(tracker instanceof NoopProgressTracker);
      return original;
    });
    assert.equal(result, original, "Non-opted-in requests must be handled exactly as before");
  }
  // The resolver is also a pass-through for ordinary responses.
  {
    const normal = new Response("x");
    assert.equal(await resolveLiveProgressResponse(normal), normal);
  }

  // 5b. Streaming answer: live progress, real headers, intact multibyte text, final snapshot.
  {
    const answer = "ආයුබෝවන්! 😀 Here is the answer — සම්පූර්ණයි.";
    const bytes = encoder.encode(answer);
    const result = await withLiveProgress(liveRequest(), async (tracker) => {
      tracker.setLanguage("si");
      tracker.start("read");
      tracker.done("read");
      tracker.start("tools");
      await sleep(15);
      tracker.done("tools");
      tracker.start("connect");
      tracker.done("connect");
      tracker.start("answer");
      // Split the answer inside multibyte characters to prove the text survives.
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (let index = 0; index < bytes.length; index += 7) {
            controller.enqueue(bytes.slice(index, index + 7));
            await sleep(2);
          }
          controller.close();
        },
      });
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Kyvorix-Action-Events": encodeURIComponent(JSON.stringify([{ id: "a" }])),
          "X-Kyvorix-Verified-Reads": encodeURIComponent(JSON.stringify(["src/a.ts"])),
        },
      });
    });
    assert.equal((result as Response).headers.get(CLIENT_RESPONSE_HEADER), "1");

    const live: ProgressSnapshot[] = [];
    const resolved = await resolveLiveProgressResponse(result as Response, { onProgress: (snapshot) => live.push(snapshot) });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(decodeURIComponent(resolved.headers.get("X-Kyvorix-Verified-Reads") ?? ""), JSON.stringify(["src/a.ts"]));
    assert.equal(JSON.parse(decodeURIComponent(resolved.headers.get("X-Kyvorix-Action-Events") ?? "[]")).length, 1);
    assert.ok(live.length >= 4, "Progress must arrive before the answer body");
    assert.equal(live[live.length - 1].steps.find((step) => step.key === "answer")?.status, "running");

    // Read the body the way the page does: decode, strip progress markers.
    const reader = resolved.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let shown = "";
    const bodySnapshots: ProgressSnapshot[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const consumed = consumeProgressMarkers(buffer + decoder.decode(value, { stream: true }));
      buffer = consumed.pending;
      shown += consumed.content;
      bodySnapshots.push(...consumed.snapshots);
    }
    shown += buffer;
    assert.equal(shown, answer, "The streamed answer must be byte-for-byte intact");
    assert.equal(bodySnapshots.length, 1, "A final snapshot closes the stream");
    const final = bodySnapshots[0];
    assert.equal(final.lang, "si");
    assert.deepEqual(final.steps.map((step) => step.key), ["read", "tools", "connect", "answer"]);
    assert.ok(final.steps.every((step) => step.status === "done"), "Everything is done at the end");
  }

  // 5c. Non-streaming results (JSON errors) keep their status and body.
  {
    const result = await withLiveProgress(liveRequest(), async (tracker) => {
      tracker.start("read");
      tracker.done("read");
      return Response.json({ error: "rate_limited", message: "Slow down </kyvorix-http> please" }, { status: 429 });
    });
    const live: ProgressSnapshot[] = [];
    const resolved = await resolveLiveProgressResponse(result as Response, { onProgress: (snapshot) => live.push(snapshot) });
    assert.equal(resolved.status, 429);
    assert.equal(resolved.ok, false);
    const json = await resolved.json();
    assert.equal(json.error, "rate_limited");
    assert.equal(json.message, "Slow down </kyvorix-http> please", "A body containing the closing tag must survive");
  }

  // 5d. Handler failure becomes a 500 JSON response; running steps are marked failed.
  {
    const result = await withLiveProgress(liveRequest(), async (tracker) => {
      tracker.start("connect");
      throw new Error("boom");
    });
    const live: ProgressSnapshot[] = [];
    const resolved = await resolveLiveProgressResponse(result as Response, { onProgress: (snapshot) => live.push(snapshot) });
    assert.equal(resolved.status, 500);
    assert.equal((await resolved.json()).error, "Internal error");
    assert.equal(live[live.length - 1].steps[0].status, "failed");
  }

  // 5e. A stream that dies before the envelope becomes a clean 502, never a hang.
  {
    const broken = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(createProgressMarker({ lang: "en", steps: [] })));
        controller.close();
      },
    }), { headers: { [CLIENT_RESPONSE_HEADER]: "1" } });
    const resolved = await resolveLiveProgressResponse(broken);
    assert.equal(resolved.status, 502);
    assert.equal((await resolved.json()).error, "upstream_error");
  }

  // 5f. The browser cancelling mid-stream stops the work without unhandled errors.
  {
    let cancelled = false;
    const result = await withLiveProgress(liveRequest(), async () => {
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          await sleep(5);
          controller.enqueue(encoder.encode("tick "));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    });
    const resolved = await resolveLiveProgressResponse(result as Response);
    const reader = resolved.body!.getReader();
    await reader.read();
    await reader.cancel();
    await sleep(40);
    assert.ok(cancelled, "Cancelling the browser stream must cancel the upstream answer stream");
  }

  // 5g. Hostile envelope values are normalized.
  {
    const hostile = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`${HTTP_ENVELOPE_OPEN}${JSON.stringify({ status: 99999, headers: { "X-Ok": "1", "X-Bad": 5 } })}${HTTP_ENVELOPE_CLOSE}tail`));
          controller.close();
        },
      }),
      { headers: { [CLIENT_RESPONSE_HEADER]: "1" } }
    );
    const resolved = await resolveLiveProgressResponse(hostile);
    assert.equal(resolved.status, 502, "An out-of-range status falls back to 502");
    assert.equal(resolved.headers.get("X-Ok"), "1");
    assert.equal(resolved.headers.get("X-Bad"), null);
    assert.equal(await resolved.text(), "tail");
  }

  // -------------------------------------------------------------------------
  // 6. Client state helpers.
  // -------------------------------------------------------------------------
  {
    const start = startProgress(undefined, "r0:", "en", 1000, true);
    assert.equal(start.steps.length, 1);
    assert.equal(start.steps[0].id, "r0:send");
    const first = applyProgressSnapshot(start, { lang: "en", steps: [{ id: "read", key: "read", label: "Reading your message", status: "done", startedAt: 1001, endedAt: 1002 }] }, "r0:");
    assert.deepEqual(first.steps.map((step) => step.id), ["r0:read"], "The server snapshot replaces the local send step");
    // A continuation request appends its own steps after the earlier ones.
    const continued = applyProgressSnapshot(first, { lang: "en", steps: [{ id: "answer", key: "answer", label: "Writing the answer", status: "running", startedAt: 2000 }] }, "r1:");
    assert.deepEqual(continued.steps.map((step) => step.id), ["r0:read", "r1:answer"]);
    // Updating the first request again leaves the continuation steps alone.
    const updated = applyProgressSnapshot(continued, { lang: "en", steps: [{ id: "read", key: "read", label: "Reading your message", status: "done", startedAt: 1001, endedAt: 1500 }] }, "r0:");
    assert.deepEqual(updated.steps.map((step) => step.id), ["r1:answer", "r0:read"].sort((a, b) => updated.steps.findIndex((s) => s.id === a) - updated.steps.findIndex((s) => s.id === b)));
    assert.equal(updated.steps.length, 2);

    // Browser-side steps (web research, tool preparation) are upserted by id.
    const research: ProgressStep = { id: "pre:research", key: "research", label: progressLabel("research", "en"), status: "running", startedAt: 5 };
    const withResearch = upsertProgressStep(undefined, "en", research);
    assert.deepEqual(withResearch.steps.map((step) => step.id), ["pre:research"]);
    const researchDone = upsertProgressStep(withResearch, "en", { ...research, status: "done", endedAt: 2500, detail: "5 pages" });
    assert.equal(researchDone.steps.length, 1, "Upserting the same id replaces the step");
    assert.equal(researchDone.steps[0].status, "done");
    const withTool = upsertProgressStep(researchDone, "en", { id: "pre:tool:a", key: "tool", label: progressLabel("tool", "en", "GitHub read file"), status: "running", startedAt: 3000 });
    assert.deepEqual(withTool.steps.map((step) => step.id), ["pre:research", "pre:tool:a"], "New steps append in order");
    // Server steps arrive later under their own prefix and never disturb the browser steps.
    const merged = applyProgressSnapshot(withTool, { lang: "en", steps: [{ id: "answer", key: "answer", label: "Writing the answer", status: "running", startedAt: 4000 }] }, "r0.0:");
    assert.deepEqual(merged.steps.map((step) => step.id), ["pre:research", "pre:tool:a", "r0.0:answer"]);
    assert.equal(removeProgressStep(withResearch, "pre:research"), undefined, "Removing the last step clears the summary");
    assert.equal(removeProgressStep(withTool, "pre:tool:a")?.steps.length, 1);
    assert.equal(progressStatusForPhase("queued"), null, "A merely planned tool call is not a step yet");
    assert.equal(progressStatusForPhase("running"), "running");
    assert.equal(progressStatusForPhase("verifying"), "running");
    assert.equal(progressStatusForPhase("succeeded"), "done");
    assert.equal(progressStatusForPhase("failed"), "failed");
    assert.equal(progressStatusForPhase("needs_connection"), "failed");
    assert.equal(progressStatusForPhase("cancelled"), "failed");
    assert.equal(progressStatusForPhase("needs_approval"), "done");

    // The tool name survives a round trip so labels can be rebuilt in any language.
    assert.equal(parseProgressSnapshot({ lang: "si", steps: [{ id: "b", key: "tool", label: progressLabel("tool", "si", "GitHub read file"), arg: "GitHub read file", status: "running", startedAt: 1 }] })?.steps[0].arg, "GitHub read file");
    const rebuilt: MessageProgress = { lang: "si", steps: [{ id: "b", key: "tool", label: progressLabel("tool", "si", "GitHub read file"), arg: "GitHub read file", status: "running", startedAt: 1 }] };
    assert.equal(summarizeProgress(rebuilt, true, "en").label, "Running GitHub read file");

    // Storing a Summary with a chat message.
    const stored = prepareProgressForStorage({ lang: "si", steps: rebuilt.steps.map((step) => ({ ...step, extra: "ignored" })), junk: true });
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored.steps[0]).sort(), ["arg", "id", "key", "label", "startedAt", "status"], "Unknown fields are never stored");
    assert.equal(prepareProgressForStorage({ lang: "en", steps: [] }), null, "An empty Summary is not stored");
    assert.equal(prepareProgressForStorage("nope"), null);
    assert.equal(prepareProgressForStorage(null), null);
    const many = Array.from({ length: 24 }, (_, index) => ({ id: `s${index}`, key: "tool", label: "x".repeat(200), detail: "d".repeat(160), arg: "a".repeat(80), status: "done", startedAt: index, endedAt: index + 1 }));
    const bounded = prepareProgressForStorage({ lang: "en", steps: many, headline: "h".repeat(140) });
    assert.ok(bounded && JSON.stringify(bounded).length <= 12_000, "An oversized Summary is trimmed to fit");
    assert.equal(bounded?.steps[bounded.steps.length - 1].id, "s23", "The newest steps are the ones kept");
    assert.equal(bounded?.headline?.length, 140, "The headline is kept when older steps are trimmed");

    // The model's one-sentence task summary: headline handling.
    assert.equal(cleanHeadline("  Searching the web \n for <b>fuel</b> prices  "), "Searching the web for bfuel/b prices", "Markup characters are removed and whitespace collapsed");
    assert.equal(cleanHeadline("x"), undefined, "A one-character summary is ignored");
    assert.equal(cleanHeadline(42), undefined);
    assert.equal(cleanHeadline("a".repeat(500))?.length, 140, "A long summary is capped");
    const withHeadline = setProgressHeadline(undefined, "en", "Reviewing the chat route");
    assert.equal(withHeadline.headline, "Reviewing the chat route");
    assert.equal(withHeadline.steps.length, 0);
    assert.equal(setProgressHeadline(withHeadline, "en", "   ").headline, "Reviewing the chat route", "An empty summary never erases the previous one");
    // Steps arriving later must not drop the headline.
    const stepAdded = upsertProgressStep(withHeadline, "en", { id: "pre:research", key: "research", label: "Researching the web", status: "running", startedAt: 1 });
    assert.equal(stepAdded.headline, "Reviewing the chat route");
    const merged2 = applyProgressSnapshot(stepAdded, { lang: "en", steps: [{ id: "answer", key: "answer", label: "Writing the answer", status: "running", startedAt: 2 }] }, "r0.0:");
    assert.equal(merged2.headline, "Reviewing the chat route");
    assert.equal(removeProgressStep(withHeadline, "x")?.headline, "Reviewing the chat route", "A headline keeps the Summary alive even without steps");
    assert.equal(withoutLocalSendStep(startProgress(withHeadline, "r0.0:", "en", 5, false))?.headline, "Reviewing the chat route");
    assert.equal(startProgress(withHeadline, "r0.0:", "en", 5, true).headline, undefined, "A new generation starts without the old headline");
    // The headline is the collapsed-line text, while running and when finished.
    assert.equal(summarizeProgress({ ...stepAdded }, true).label, "Reviewing the chat route");
    assert.equal(summarizeProgress({ ...stepAdded, steps: stepAdded.steps.map((step) => ({ ...step, status: "done" as const, endedAt: 3000 })) }, false).label, "Reviewing the chat route");
    // Stored form keeps the headline.
    const storedWithHeadline = prepareProgressForStorage({ lang: "si", steps: [], headline: "වෙබ් එකේ ඉන්ධන මිල සොයමින්" });
    assert.equal(storedWithHeadline?.headline, "වෙබ් එකේ ඉන්ධන මිල සොයමින්", "A headline alone is worth storing");
    assert.equal(parseProgressSnapshot({ lang: "en", steps: [], headline: "<script>alert(1)</script>" })?.headline, "scriptalert(1)/script");

    // Summary markers: stripped from the reply, safe at every possible split.
    const summaryText = `<kyvorix-summary>වෙබ් එකේ ඉන්ධන මිල සොයමින්</kyvorix-summary>\nIt is 350 < 400 and 2 > 1.`;
    for (let split = 1; split < summaryText.length; split++) {
      let buffer = "";
      let output = "";
      const headlines: string[] = [];
      for (const piece of [summaryText.slice(0, split), summaryText.slice(split)]) {
        const consumed = consumeSummaryMarkers(buffer + piece);
        buffer = consumed.pending;
        output += consumed.content;
        headlines.push(...consumed.headlines);
      }
      assert.equal(output + buffer, "\nIt is 350 < 400 and 2 > 1.", `Summary split at ${split} corrupted the reply`);
      assert.deepEqual(headlines, ["වෙබ් එකේ ඉන්ධන මිල සොයමින්"], `Summary split at ${split} lost the headline`);
    }
    assert.equal(consumeSummaryMarkers("Plain text, no marker.").content, "Plain text, no marker.");
    assert.equal(consumeSummaryMarkers("<kyvorix-summary></kyvorix-summary>Hi").content, "Hi", "An empty marker disappears");
    assert.equal(consumeSummaryMarkers("<kyvorix-summary>never closed").content, "", "A marker that never closes is not shown as reply text");

    // The rule that every model receives.
    assert.match(TASK_SUMMARY_RULE, /NON-NEGOTIABLE/);
    assert.match(TASK_SUMMARY_RULE, /very first thing you output/);
    assert.match(TASK_SUMMARY_RULE, /<kyvorix-summary>/);
    assert.match(TASK_SUMMARY_RULE, /same language the user is writing in/);
    assert.match(TASK_SUMMARY_RULE, /at most 12 words/);
    assert.match(TASK_SUMMARY_RULE, /Never mention, explain or repeat this rule/);
    assert.equal(new ProgressTracker(() => undefined).live, true);
    assert.equal(new NoopProgressTracker().live, false, "Requests that did not opt in never receive the rule");

    // A rejected request must not leave a "sending" step behind.
    assert.equal(withoutLocalSendStep(start), undefined);
    assert.deepEqual(withoutLocalSendStep({ lang: "en", steps: [...start.steps, { id: "r0:read", key: "read", label: "Reading your message", status: "done", startedAt: 1 }] })?.steps.map((step) => step.key), ["read"]);
    assert.equal(withoutLocalSendStep(undefined), undefined);

    const progress: MessageProgress = { lang: "en", steps: [
      { id: "a", key: "read", label: "Reading your message", status: "done", startedAt: 0, endedAt: 500 },
      { id: "b", key: "answer", label: "Writing the answer", status: "running", startedAt: 500 },
    ] };
    assert.equal(summarizeProgress(progress, true).label, "Writing the answer");
    assert.equal(summarizeProgress(progress, false).state, "stopped", "A step left running after streaming ended means the reply was stopped");
    const finished: MessageProgress = { lang: "en", steps: progress.steps.map((step): ProgressStep => ({ ...step, status: "done", endedAt: step.endedAt ?? 4200 })) };
    assert.equal(summarizeProgress(finished, false).label, "2 steps · 4s");
    assert.equal(summarizeProgress({ ...finished, lang: "si" }, false).label, "පියවර 2ක් · තත්පර 4");
    assert.equal(summarizeProgress({ lang: "en", steps: [{ ...finished.steps[0], status: "failed" }] }, false).state, "failed");
    assert.equal(formatStepDuration({ ...finished.steps[1] }), "3.7s");
    assert.equal(formatStepDuration({ ...finished.steps[0] }), null, "Sub-second steps show no duration");
  }

  // -------------------------------------------------------------------------
  // 7. Source wiring: the feature must be connected, and must stay safe.
  // -------------------------------------------------------------------------
  {
    const route = read("app/api/chat/route.ts");
    const page = read("app/page.tsx");
    const bubble = read("components/MessageBubble.tsx");
    const native = read("lib/nativeTools.server.ts");
    const types = read("lib/types.ts");

    assert.match(route, /withLiveProgress\(req, \(progress\) => handleChatRequest\(req, progress\)\)/, "POST must be wrapped by withLiveProgress");
    assert.match(route, /async function handleChatRequest\(req: NextRequest, progress: ProgressTrackerLike\)/);
    assert.match(route, /progress\.start\(isAutomaticContinuation \? "continue" : "read"\)/, "The route must report that it read the message (or is continuing)");
    for (const key of ["links", "images", "preview", "github", "context", "wikipedia", "news", "tools", "connect", "answer"]) {
      assert.ok(route.includes(`progress.start("${key}"`), `The route must report the "${key}" step`);
    }
    assert.match(route, /onActionEvent: \(event\) =>/, "The fallback tool loop must report each tool call as a step");
    assert.match(route, /if \(!nativeToolVerified\) progress\.start\("tools"/, "Tools run in the browser step must not be reported twice");
    assert.match(native, /onActionEvent\?: \(event: ActionEvent\) => void/);

    assert.match(page, /\[LIVE_PROGRESS_REQUEST_HEADER\]: "1"/, "The browser must opt in to live progress");
    assert.match(page, /resolveLiveProgressResponse\(/);
    assert.match(page, /consumeProgressMarkers\(/);
    assert.match(page, /applyProgressSnapshot\(/);
    assert.match(page, /withoutLocalSendStep\(previous\)/, "A refused request must clear the sending placeholder");
    assert.match(page, /progressSeededRef\.current = assistantId;/, "Send flows must keep their browser-side steps");
    assert.equal((page.match(/progressSeededRef\.current = assistantId;/g) ?? []).length, 2, "Both send flows must seed the summary");
    assert.match(page, /runWebResearch\(text, controller\.signal, assistantId\)/);
    assert.match(page, /progressStatusForPhase\(incoming\.phase\)/, "Tool events from /api/native-tools must become steps");
    assert.match(page, /clearTimeout\(umbrellaTimer\)/, "The tool-preparation timer must never leak");
    assert.match(bubble, /<ProgressSummary/);
    assert.match(types, /progress\?: MessageProgress/);

    // Persistence: the Summary is saved with the reply and survives a reload, and
    // the app keeps working when the optional column has not been created yet.
    const messagesRoute = read("app/api/chats/[id]/messages/route.ts");
    assert.match(messagesRoute, /prepareProgressForStorage\(body\.progress\)/, "Only a validated Summary is stored");
    assert.match(messagesRoute, /role === "assistant" \? prepareProgressForStorage/, "Only assistant replies carry a Summary");
    assert.match(messagesRoute, /isMissingProgressColumn\(error\)/, "Loading must fall back when the column is missing");
    assert.match(messagesRoute, /storedProgress && isMissingProgressColumn\(error\)/, "Saving must fall back when the column is missing");
    assert.match(page, /parseProgressSnapshot\(m\.progress\)/, "A stored Summary is re-validated when a chat is loaded");
    assert.match(page, /progressByMessageRef\.current\.get\(assistantId\)/, "The finished reply is saved together with its Summary");
    const migration = read("supabase/migrations/20261125_messages_progress_summary.sql");
    assert.match(migration, /add column if not exists progress jsonb/i, "The migration must be safe to run twice");
    assert.match(migration, /messages_progress_size_check/);
    assert.doesNotMatch(migration, /drop |delete |truncate /i, "The migration must not remove data");

    // The unbreakable task-summary rule reaches every model, but only opted-in browsers.
    assert.match(route, /if \(progress\.live && !isAutomaticContinuation\) \{\s*systemPrompt \+= TASK_SUMMARY_RULE;/, "Every model must receive the task-summary rule when the browser understands it");
    assert.ok(route.indexOf("systemPrompt += TASK_SUMMARY_RULE") > route.indexOf("NATIVE TOOL RESULT RULE"), "The rule is appended last so it is the most recent instruction");
    assert.match(page, /consumeSummaryMarkers\(summaryMarkerBuffer \+ progressMarker\.content\)/, "The headline must be stripped from the reply");
    assert.match(page, /taskSummary=\{currentTaskSummary\}/, "The dashboard must show the task summary");
    assert.equal((page.match(/taskSummary=\{currentTaskSummary\}/g) ?? []).length, 2, "Both dashboard components must receive it");
    assert.match(bubble, /<WebSearchCard research=\{message\.webResearch\}/, "The web search card must appear inside the reply");
    assert.match(page, /showResearchCard\("running"/, "The web search card must update live");
    assert.match(page, /showResearchCard\(signedToken \? "done" : "failed"\)/, "The web search card must reach a final state");
    // Letter-spaced capitals break Sinhala/Latin text in tool cards.
    const toolCardLine = bubble.split("\n").find((line) => line.includes("getToolCallLabel(event.operation)")) ?? "";
    assert.ok(toolCardLine.length > 0 && !/uppercase|tracking-(wide|wider|widest|\[)/.test(toolCardLine), "Tool call labels must not use forced capitals or wide letter spacing");
    const statusLine = bubble.split("\n").find((line) => line.includes("getActionStatusLabel(event.phase)")) ?? "";
    assert.ok(statusLine.length > 0 && !/uppercase|tracking-(wide|wider|widest|\[)/.test(statusLine), "Tool status labels must not use forced capitals or wide letter spacing");
    for (const file of ["components/WebSearchCard.tsx", "components/ProgressSummary.tsx"]) {
      assert.doesNotMatch(read(file), /uppercase|tracking-(wide|wider|widest|\[)/, `${file} must keep normal letter spacing`);
    }

    // Step text must come from the application, never from model output.
    const component = read("components/ProgressSummary.tsx");
    assert.doesNotMatch(component, /dangerouslySetInnerHTML/, "Step text must be rendered as text");
    assert.match(component, /role="dialog"/);
    assert.match(component, /aria-modal="true"/);
    assert.match(component, /Escape/);
  }

  console.log("Live progress checks passed: protocol, tracker, server wrapper, browser resolver, state helpers, and wiring.");
}

main().then(
  () => {
    // Lazy step timers are unref'd, but exit explicitly so a regression cannot hang CI.
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
