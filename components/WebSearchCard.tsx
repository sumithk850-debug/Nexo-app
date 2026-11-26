"use client";

import { AlertTriangle, CheckCircle2, Globe2, Loader2 } from "lucide-react";

import type { ProgressLanguage } from "@/lib/progressSteps";
import type { WebResearchCardState } from "@/lib/types";

const TEXT: Record<ProgressLanguage, { running: string; done: string; failed: string; pages: (done: number, total: number) => string }> = {
  en: {
    running: "Searching the web",
    done: "Web search complete",
    failed: "Web search could not finish",
    pages: (done, total) => `${done} of ${total} pages read`,
  },
  si: {
    running: "වෙබ් එකේ සොයමින්",
    done: "වෙබ් සෙවීම අවසන්",
    failed: "වෙබ් සෙවීම අවසන් කළ නොහැකි විය",
    pages: (done, total) => `පිටු ${total}න් ${done}ක් කියවා ඇත`,
  },
};

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Card shown inside the assistant reply while web research runs. All text is
 * rendered as plain text with normal letter spacing so Sinhala and Latin script
 * stay intact.
 */
export function WebSearchCard({ research }: { research: WebResearchCardState }) {
  const text = TEXT[research.lang];
  const host = hostOf(research.url);
  const total = research.totalPages ?? 0;
  const done = research.completedPages ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;

  const tone =
    research.status === "failed"
      ? "border-rose-400/25 bg-rose-400/5 text-rose-200"
      : research.status === "done"
        ? "border-emerald-400/25 bg-emerald-400/5 text-emerald-200"
        : "border-sky-400/25 bg-sky-400/5 text-sky-200";
  const title = research.status === "failed" ? text.failed : research.status === "done" ? text.done : text.running;

  return (
    <section role="status" aria-live="polite" className={`mb-3 rounded-xl border px-3 py-2.5 ${tone}`}>
      <div className="flex items-center gap-2">
        {research.status === "running" ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : research.status === "failed" ? (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <Globe2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="min-w-0 break-words text-sm font-semibold">{title}</span>
      </div>
      {research.message && research.status !== "done" && (
        <p className="mt-1 break-words text-xs text-ink">{research.message}</p>
      )}
      {(host || percent !== null) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
          {host && <span className="break-all">{host}</span>}
          {total > 0 && <span>{text.pages(done, total)}</span>}
        </div>
      )}
      {percent !== null && research.status === "running" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-edge/70" aria-hidden="true">
          <div className="h-full rounded-full bg-sky-300 transition-all duration-300" style={{ width: `${Math.max(percent, 6)}%` }} />
        </div>
      )}
    </section>
  );
}
