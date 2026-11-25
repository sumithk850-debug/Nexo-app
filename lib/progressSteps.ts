// KYVORIX AI — live progress steps ("Summary" timeline shown inside a chat reply).
//
// This module is shared by the server (which reports what it is really doing)
// and the browser (which renders it). It must stay free of server-only imports
// and of "@/" aliases so it can be compiled and tested standalone.
//
// Every step describes work the application actually performed. Nothing here is
// written by a model, so a step can never claim something that did not happen.

export type ProgressLanguage = "si" | "en";
export type ProgressStepStatus = "running" | "done" | "failed";
export type ProgressStepKey =
  | "send"
  | "read"
  | "continue"
  | "links"
  | "images"
  | "preview"
  | "github"
  | "context"
  | "wikipedia"
  | "news"
  | "tools"
  | "tool"
  | "connect"
  | "answer";

export interface ProgressStep {
  id: string;
  key: ProgressStepKey;
  /** Already localized for `lang`. */
  label: string;
  detail?: string;
  status: ProgressStepStatus;
  startedAt: number;
  endedAt?: number;
}

export interface ProgressSnapshot {
  lang: ProgressLanguage;
  /** The complete, ordered list of visible steps for one request. */
  steps: ProgressStep[];
}

/** Per-message progress held in browser state (steps from every request of the reply). */
export interface MessageProgress {
  lang: ProgressLanguage;
  steps: ProgressStep[];
}

const FIXED_LABELS: Record<Exclude<ProgressStepKey, "tool">, Record<ProgressLanguage, string>> = {
  send: { en: "Sending your request", si: "ඔබේ ඉල්ලීම යවමින්" },
  read: { en: "Reading your message", si: "ඔබේ පණිවිඩය කියවමින්" },
  continue: { en: "Continuing from where it stopped", si: "නතර වූ තැනින් දිගටම කරමින්" },
  links: { en: "Opening the links you shared", si: "ඔබ දුන් ලින්ක් විවෘත කරමින්" },
  images: { en: "Looking at your image", si: "ඔබේ රූපය විශ්ලේෂණය කරමින්" },
  preview: { en: "Capturing a preview of the page", si: "පිටුවේ පෙනුම ගනිමින්" },
  github: { en: "Reading your GitHub repository", si: "ඔබේ GitHub repository එක කියවමින්" },
  context: { en: "Loading your preferences and notes", si: "ඔබේ මතකය සහ සටහන් ගනිමින්" },
  wikipedia: { en: "Searching Wikipedia", si: "Wikipedia සොයමින්" },
  news: { en: "Preparing today's news", si: "අද පුවත් සූදානම් කරමින්" },
  tools: { en: "Checking which tools are needed", si: "අවශ්‍ය මෙවලම් පරීක්ෂා කරමින්" },
  connect: { en: "Connecting to the model", si: "මොඩල් එකට සම්බන්ධ වෙමින්" },
  answer: { en: "Writing the answer", si: "පිළිතුර ලියමින්" },
};

export function progressLabel(key: ProgressStepKey, lang: ProgressLanguage, arg?: string): string {
  if (key === "tool") {
    const name = (arg ?? "").trim() || "tool";
    return lang === "si" ? `${name} ක්‍රියාත්මක කරමින්` : `Running ${name}`;
  }
  return FIXED_LABELS[key][lang];
}

/** Language of the step labels: an explicit preference wins, otherwise the user's own script. */
export function detectProgressLanguage(text: string, preference?: string | null): ProgressLanguage {
  if (preference === "sinhala") return "si";
  if (preference === "english") return "en";
  return /[\u0D80-\u0DFF]/.test(text) ? "si" : "en";
}

export const PROGRESS_UI_TEXT: Record<
  ProgressLanguage,
  {
    title: string;
    close: string;
    working: string;
    stopped: string;
    failed: string;
    stepsDone: (count: number, seconds: number | null) => string;
    open: string;
  }
> = {
  en: {
    title: "Summary",
    close: "Close summary",
    working: "Working on it…",
    stopped: "Stopped",
    failed: "Something needs attention",
    stepsDone: (count, seconds) => `${count} ${count === 1 ? "step" : "steps"}${seconds !== null ? ` · ${seconds}s` : ""}`,
    open: "Show the steps",
  },
  si: {
    title: "සාරාංශය",
    close: "සාරාංශය වසන්න",
    working: "වැඩේ කරමින්…",
    stopped: "නතර කළා",
    failed: "අවධානය අවශ්‍ය දෙයක් තියෙනවා",
    stepsDone: (count, seconds) => `පියවර ${count}ක්${seconds !== null ? ` · තත්පර ${seconds}` : ""}`,
    open: "පියවර බලන්න",
  },
};

// ---------------------------------------------------------------------------
// Stream markers
// ---------------------------------------------------------------------------

export const PROGRESS_MARKER_OPEN = "<kyvorix-progress>";
export const PROGRESS_MARKER_CLOSE = "</kyvorix-progress>";

const MAX_STEPS = 24;
const STATUSES = new Set<string>(["running", "done", "failed"]);
const KEYS = new Set<string>([
  "send", "read", "continue", "links", "images", "preview", "github",
  "context", "wikipedia", "news", "tools", "tool", "connect", "answer",
]);

export function createProgressMarker(snapshot: ProgressSnapshot): string {
  // "<" is escaped so step text can never be mistaken for another marker.
  const json = JSON.stringify({ lang: snapshot.lang, steps: snapshot.steps.slice(0, MAX_STEPS) }).replace(/</g, "\\u003c");
  return `${PROGRESS_MARKER_OPEN}${json}${PROGRESS_MARKER_CLOSE}`;
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return cleaned || undefined;
}

export function parseProgressSnapshot(raw: unknown): ProgressSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { lang?: unknown; steps?: unknown };
  const lang: ProgressLanguage = candidate.lang === "si" ? "si" : "en";
  if (!Array.isArray(candidate.steps)) return null;
  const steps: ProgressStep[] = [];
  for (const item of candidate.steps.slice(0, MAX_STEPS)) {
    if (!item || typeof item !== "object") continue;
    const step = item as Record<string, unknown>;
    const id = cleanText(step.id, 80);
    const label = cleanText(step.label, 200);
    if (!id || !label) continue;
    if (typeof step.key !== "string" || !KEYS.has(step.key)) continue;
    if (typeof step.status !== "string" || !STATUSES.has(step.status)) continue;
    if (typeof step.startedAt !== "number" || !Number.isFinite(step.startedAt)) continue;
    const endedAt = typeof step.endedAt === "number" && Number.isFinite(step.endedAt) ? step.endedAt : undefined;
    const detail = cleanText(step.detail, 160);
    steps.push({
      id,
      key: step.key as ProgressStepKey,
      label,
      status: step.status as ProgressStepStatus,
      startedAt: step.startedAt,
      ...(endedAt !== undefined ? { endedAt } : {}),
      ...(detail ? { detail } : {}),
    });
  }
  return { lang, steps };
}

/** Length of a trailing fragment that could still turn into the opening tag. */
function partialOpenSuffixLength(text: string): number {
  const max = Math.min(PROGRESS_MARKER_OPEN.length - 1, text.length);
  for (let length = max; length > 0; length--) {
    if (PROGRESS_MARKER_OPEN.startsWith(text.slice(text.length - length))) return length;
  }
  return 0;
}

/**
 * Removes progress markers from streamed text. Anything that might be the
 * beginning of a marker at the end of the chunk is returned as `pending` so the
 * caller can prepend it to the next chunk. Malformed markers are dropped and
 * never become visible message content.
 */
export function consumeProgressMarkers(text: string): {
  content: string;
  snapshots: ProgressSnapshot[];
  pending: string;
} {
  const snapshots: ProgressSnapshot[] = [];
  let working = text;
  let pending = "";

  const openIndex = working.lastIndexOf(PROGRESS_MARKER_OPEN);
  if (openIndex >= 0 && working.indexOf(PROGRESS_MARKER_CLOSE, openIndex) < 0) {
    pending = working.slice(openIndex);
    working = working.slice(0, openIndex);
  } else {
    const partial = partialOpenSuffixLength(working);
    if (partial > 0) {
      pending = working.slice(working.length - partial);
      working = working.slice(0, working.length - partial);
    }
  }

  const content = working.replace(/<kyvorix-progress>([\s\S]*?)<\/kyvorix-progress>/g, (_match, raw: string) => {
    try {
      const snapshot = parseProgressSnapshot(JSON.parse(raw));
      if (snapshot) snapshots.push(snapshot);
    } catch {
      // Malformed markers are removed and never become assistant-visible content.
    }
    return "";
  });
  return { content, snapshots, pending };
}

// ---------------------------------------------------------------------------
// Browser-side state helpers
// ---------------------------------------------------------------------------

/**
 * Replaces the steps that belong to one request (identified by `prefix`) with
 * the latest snapshot. Steps from other requests of the same reply (automatic
 * continuations) are kept in order.
 */
export function applyProgressSnapshot(
  previous: MessageProgress | undefined,
  snapshot: ProgressSnapshot,
  prefix: string
): MessageProgress {
  const kept = (previous?.steps ?? []).filter((step) => !step.id.startsWith(prefix));
  const incoming = snapshot.steps.map((step) => ({ ...step, id: `${prefix}${step.id}` }));
  return { lang: snapshot.lang, steps: [...kept, ...incoming] };
}

/** The first step shown before the server has said anything. */
export function createLocalSendStep(prefix: string, lang: ProgressLanguage, now: number): ProgressStep {
  return { id: `${prefix}send`, key: "send", label: progressLabel("send", lang), status: "running", startedAt: now };
}

export function startProgress(previous: MessageProgress | undefined, prefix: string, lang: ProgressLanguage, now: number, reset: boolean): MessageProgress {
  const base = reset ? [] : (previous?.steps ?? []).filter((step) => !step.id.startsWith(prefix));
  return { lang, steps: [...base, createLocalSendStep(prefix, lang, now)] };
}

/**
 * Removes the local "sending" placeholder. Used when the request was rejected
 * before the server reported any real work (rate limit, invalid session, ...),
 * so a failed reply never claims it was "stopped" mid-way.
 */
export function withoutLocalSendStep(progress: MessageProgress | undefined): MessageProgress | undefined {
  if (!progress) return undefined;
  const steps = progress.steps.filter((step) => step.key !== "send");
  return steps.length > 0 ? { ...progress, steps } : undefined;
}

export interface ProgressSummary {
  /** Text for the collapsed one-line view. */
  label: string;
  state: "running" | "done" | "failed" | "stopped";
  count: number;
}

/** Collapsed-line summary. A step still "running" after streaming ended counts as stopped/done. */
export function summarizeProgress(progress: MessageProgress, streaming: boolean): ProgressSummary {
  const steps = progress.steps;
  const ui = PROGRESS_UI_TEXT[progress.lang];
  const failed = steps.some((step) => step.status === "failed");
  if (streaming) {
    const running = [...steps].reverse().find((step) => step.status === "running") ?? steps[steps.length - 1];
    return { label: running?.label ?? ui.working, state: "running", count: steps.length };
  }
  const startedAt = steps.length ? Math.min(...steps.map((step) => step.startedAt)) : 0;
  const endedAt = steps.length ? Math.max(...steps.map((step) => step.endedAt ?? step.startedAt)) : 0;
  const seconds = steps.length && endedAt > startedAt ? Math.max(1, Math.round((endedAt - startedAt) / 1000)) : null;
  if (failed) return { label: ui.failed, state: "failed", count: steps.length };
  const stoppedMidway = steps.some((step) => step.status === "running");
  if (stoppedMidway) return { label: ui.stopped, state: "stopped", count: steps.length };
  return { label: ui.stepsDone(steps.length, seconds), state: "done", count: steps.length };
}

export function formatStepDuration(step: ProgressStep): string | null {
  if (step.endedAt === undefined) return null;
  const ms = step.endedAt - step.startedAt;
  if (ms < 1000) return null;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}
