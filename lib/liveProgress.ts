// KYVORIX AI — browser side of live progress.
//
// When the browser opts in with `X-Kyvorix-Live-Progress: 1`, /api/chat answers
// immediately with a stream that carries progress markers while the server is
// still working, followed by a `<kyvorix-http>` envelope holding the real status
// and headers (and the body, for non-streaming results). `resolveLiveProgress
// Response` reads that early part, reports progress as it arrives, and returns a
// normal Response built from the envelope. Everything downstream — `res.ok`,
// `res.headers`, `res.json()`, `res.body.getReader()` — therefore keeps working
// exactly as it did before live progress existed.

import { consumeProgressMarkers, type ProgressSnapshot } from "./progressSteps";

export const LIVE_PROGRESS_REQUEST_HEADER = "X-Kyvorix-Live-Progress";
export const LIVE_PROGRESS_RESPONSE_HEADER = "X-Kyvorix-Live";
const ENVELOPE_OPEN = "<kyvorix-http>";
const ENVELOPE_CLOSE = "</kyvorix-http>";

interface Envelope {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

function parseEnvelope(raw: string): Envelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as { status?: unknown; headers?: unknown; body?: unknown };
    const status = typeof candidate.status === "number" && candidate.status >= 200 && candidate.status <= 599 ? Math.trunc(candidate.status) : 502;
    const headers: Record<string, string> = {};
    if (candidate.headers && typeof candidate.headers === "object") {
      for (const [name, value] of Object.entries(candidate.headers as Record<string, unknown>)) {
        if (typeof value === "string") headers[name] = value;
      }
    }
    return { status, headers, ...(typeof candidate.body === "string" ? { body: candidate.body } : {}) };
  } catch {
    return null;
  }
}

function interruptedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "upstream_error", message: "The connection was interrupted before KYVORIX could reply. Please try again." }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}

/** Rebuilds the handler's original Response from a live-progress stream. */
export async function resolveLiveProgressResponse(
  response: Response,
  handlers: { onProgress?: (snapshot: ProgressSnapshot) => void } = {}
): Promise<Response> {
  if (response.headers.get(LIVE_PROGRESS_RESPONSE_HEADER) !== "1" || !response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return interruptedResponse();

    const consumed = consumeProgressMarkers(rest + decoder.decode(value, { stream: true }));
    for (const snapshot of consumed.snapshots) handlers.onProgress?.(snapshot);
    // Markers are gone from `content`; `pending` is a possible start of the next one.
    rest = consumed.content + consumed.pending;

    const open = rest.indexOf(ENVELOPE_OPEN);
    if (open < 0) continue;
    const close = rest.indexOf(ENVELOPE_CLOSE, open);
    if (close < 0) continue;

    const envelope = parseEnvelope(rest.slice(open + ENVELOPE_OPEN.length, close));
    if (!envelope) {
      await reader.cancel().catch(() => undefined);
      return interruptedResponse();
    }
    const leftover = rest.slice(close + ENVELOPE_CLOSE.length);
    const headers = new Headers(envelope.headers);

    if (envelope.body !== undefined) {
      await reader.cancel().catch(() => undefined);
      return new Response(envelope.body, { status: envelope.status, headers });
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (leftover) controller.enqueue(encoder.encode(leftover));
      },
      async pull(controller) {
        try {
          const next = await reader.read();
          if (next.done) {
            const tail = decoder.decode();
            if (tail) controller.enqueue(encoder.encode(tail));
            controller.close();
            return;
          }
          const text = decoder.decode(next.value, { stream: true });
          if (text) controller.enqueue(encoder.encode(text));
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    return new Response(body, { status: envelope.status, headers });
  }
}
