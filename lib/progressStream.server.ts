// KYVORIX AI — server-side live progress.
//
// `withLiveProgress` lets the chat route report what it is really doing while it
// works, without changing the route's own response logic:
//
//   * A request that does not send `X-Kyvorix-Live-Progress: 1` is handled
//     exactly as before (the wrapper returns the handler's own Response).
//   * A request that opts in gets a streaming response immediately. Progress
//     markers flow while the handler works, then one `<kyvorix-http>` envelope
//     carries the handler's real status and headers (and, for non-streaming
//     results such as JSON errors, the body). The streamed answer follows, and a
//     final progress snapshot closes the stream. The browser rebuilds the
//     original Response from the envelope (see lib/liveProgress.ts), so existing
//     status / header / body handling keeps working unchanged.
//
// This file deliberately avoids "server-only" and "@/" imports so the exact
// code that runs in production can also be exercised by the verification
// scripts under plain Node.

import {
  createProgressMarker,
  progressLabel,
  type ProgressLanguage,
  type ProgressSnapshot,
  type ProgressStep,
  type ProgressStepKey,
} from "./progressSteps";

export const LIVE_PROGRESS_REQUEST_HEADER = "x-kyvorix-live-progress";
export const LIVE_PROGRESS_RESPONSE_HEADER = "X-Kyvorix-Live";
export const HTTP_ENVELOPE_OPEN = "<kyvorix-http>";
export const HTTP_ENVELOPE_CLOSE = "</kyvorix-http>";

export interface StepOptions {
  /** Defaults to the step key. Use a distinct id for repeated steps such as tools. */
  id?: string;
  /** Tool display name for the "tool" key. */
  arg?: string;
  detail?: string;
  /**
   * A lazy step stays hidden unless it runs long enough to matter (or is
   * explicitly revealed). This keeps checks that usually finish instantly from
   * flashing in the timeline.
   */
  lazy?: boolean;
}

export interface ProgressTrackerLike {
  setLanguage(lang: ProgressLanguage): void;
  start(key: ProgressStepKey, options?: StepOptions): void;
  done(key: ProgressStepKey, options?: { id?: string; detail?: string; reveal?: boolean }): void;
  fail(key: ProgressStepKey, options?: { id?: string; detail?: string }): void;
  skip(key: ProgressStepKey, options?: { id?: string }): void;
}

export class NoopProgressTracker implements ProgressTrackerLike {
  setLanguage(): void {}
  start(): void {}
  done(): void {}
  fail(): void {}
  skip(): void {}
}

interface InternalStep {
  id: string;
  key: ProgressStepKey;
  arg?: string;
  detail?: string;
  status: ProgressStep["status"];
  startedAt: number;
  endedAt?: number;
  visible: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export class ProgressTracker implements ProgressTrackerLike {
  private steps: InternalStep[] = [];
  private language: ProgressLanguage = "en";
  private closed = false;

  constructor(
    private readonly emit: (snapshot: ProgressSnapshot) => void,
    private readonly revealAfterMs = 350
  ) {}

  setLanguage(lang: ProgressLanguage): void {
    if (lang === this.language) return;
    this.language = lang;
    this.flush();
  }

  start(key: ProgressStepKey, options: StepOptions = {}): void {
    if (this.closed) return;
    const id = options.id ?? key;
    const existing = this.steps.find((step) => step.id === id);
    if (existing && existing.status === "running") return;
    if (existing) this.removeStep(existing);

    const step: InternalStep = {
      id,
      key,
      arg: options.arg,
      detail: options.detail,
      status: "running",
      startedAt: Date.now(),
      visible: !options.lazy,
    };
    if (options.lazy) {
      step.timer = setTimeout(() => {
        step.timer = undefined;
        if (!this.closed && step.status === "running" && !step.visible) {
          step.visible = true;
          this.flush();
        }
      }, this.revealAfterMs);
      (step.timer as { unref?: () => void }).unref?.();
    }
    this.steps.push(step);
    if (step.visible) this.flush();
  }

  done(key: ProgressStepKey, options: { id?: string; detail?: string; reveal?: boolean } = {}): void {
    if (this.closed) return;
    const step = this.find(options.id ?? key);
    if (!step || step.status !== "running") return;
    this.clearTimer(step);
    step.status = "done";
    step.endedAt = Date.now();
    if (options.detail) step.detail = options.detail;
    if (options.reveal) step.visible = true;
    if (step.visible) this.flush();
  }

  fail(key: ProgressStepKey, options: { id?: string; detail?: string } = {}): void {
    if (this.closed) return;
    const step = this.find(options.id ?? key);
    if (!step || step.status !== "running") return;
    this.clearTimer(step);
    step.status = "failed";
    step.endedAt = Date.now();
    step.visible = true;
    if (options.detail) step.detail = options.detail;
    this.flush();
  }

  skip(key: ProgressStepKey, options: { id?: string } = {}): void {
    if (this.closed) return;
    const step = this.find(options.id ?? key);
    if (!step) return;
    const wasVisible = step.visible;
    this.removeStep(step);
    if (wasVisible) this.flush();
  }

  /** Ends the request's progress. Steps still running become done (or failed). */
  finish(outcome: "done" | "failed"): void {
    if (this.closed) return;
    const now = Date.now();
    for (const step of [...this.steps]) {
      this.clearTimer(step);
      if (step.status !== "running") continue;
      if (!step.visible) {
        // A lazy step that never became visible was not worth showing.
        this.removeStep(step);
        continue;
      }
      step.status = outcome;
      step.endedAt = now;
    }
    this.flush();
    this.closed = true;
  }

  dispose(): void {
    this.closed = true;
    for (const step of this.steps) this.clearTimer(step);
  }

  snapshot(): ProgressSnapshot {
    return {
      lang: this.language,
      steps: this.steps
        .filter((step) => step.visible)
        .map((step) => ({
          id: step.id,
          key: step.key,
          label: progressLabel(step.key, this.language, step.arg),
          status: step.status,
          startedAt: step.startedAt,
          ...(step.endedAt !== undefined ? { endedAt: step.endedAt } : {}),
          ...(step.detail ? { detail: step.detail } : {}),
        })),
    };
  }

  private find(id: string): InternalStep | undefined {
    return this.steps.find((step) => step.id === id);
  }

  private clearTimer(step: InternalStep): void {
    if (step.timer) {
      clearTimeout(step.timer);
      step.timer = undefined;
    }
  }

  private removeStep(step: InternalStep): void {
    this.clearTimer(step);
    this.steps = this.steps.filter((candidate) => candidate !== step);
  }

  private flush(): void {
    if (this.closed) return;
    this.emit(this.snapshot());
  }
}

const SKIPPED_HEADERS = new Set(["content-length", "transfer-encoding", "content-encoding", "connection", "keep-alive"]);

function createEnvelope(status: number, headers: Record<string, string>, body?: string): string {
  const payload: { status: number; headers: Record<string, string>; body?: string } = { status, headers };
  if (body !== undefined) payload.body = body;
  // "<" is escaped so a response body can never contain the closing tag.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `${HTTP_ENVELOPE_OPEN}${json}${HTTP_ENVELOPE_CLOSE}`;
}

export function withLiveProgress(
  req: Request,
  run: (tracker: ProgressTrackerLike) => Promise<Response>
): Promise<Response> | Response {
  if (req.headers.get(LIVE_PROGRESS_REQUEST_HEADER) !== "1") {
    return run(new NoopProgressTracker());
  }

  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const write = (text: string): void => {
    if (closed || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(text));
    } catch {
      closed = true;
    }
  };
  const closeStream = (): void => {
    if (closed) return;
    closed = true;
    try {
      controllerRef?.close();
    } catch {
      // Already closed by the client.
    }
  };

  const tracker = new ProgressTracker((snapshot) => write(createProgressMarker(snapshot)));

  async function pump(): Promise<void> {
    let inner: Response;
    try {
      inner = await run(tracker);
    } catch (error) {
      inner = new Response(JSON.stringify({ error: "Internal error", detail: String(error) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (closed) {
      // The browser went away while the handler was still working.
      tracker.dispose();
      try {
        await inner.body?.cancel();
      } catch {
        // Nothing to clean up.
      }
      return;
    }

    const headers: Record<string, string> = {};
    inner.headers.forEach((value, name) => {
      if (!SKIPPED_HEADERS.has(name.toLowerCase())) headers[name] = value;
    });

    const streamable = Boolean(inner.body) && inner.ok && /^text\/plain/i.test(inner.headers.get("content-type") ?? "");

    if (!streamable) {
      const text = inner.body ? await inner.text().catch(() => "") : "";
      tracker.finish(inner.ok ? "done" : "failed");
      write(createEnvelope(inner.status, headers, text));
      closeStream();
      return;
    }

    write(createEnvelope(inner.status, headers));
    upstreamReader = inner.body!.getReader();
    try {
      while (true) {
        const { done, value } = await upstreamReader.read();
        if (done) break;
        if (closed) {
          await upstreamReader.cancel().catch(() => undefined);
          tracker.dispose();
          return;
        }
        controllerRef?.enqueue(value);
      }
    } catch (error) {
      tracker.dispose();
      if (!closed) {
        closed = true;
        try {
          controllerRef?.error(error);
        } catch {
          // Already closed.
        }
      }
      return;
    }
    tracker.finish("done");
    closeStream();
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      // An empty snapshot flushes the response headers to the browser at once.
      write(createProgressMarker({ lang: "en", steps: [] }));
      void pump();
    },
    cancel() {
      closed = true;
      tracker.dispose();
      void upstreamReader?.cancel().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      [LIVE_PROGRESS_RESPONSE_HEADER]: "1",
    },
  });
}
