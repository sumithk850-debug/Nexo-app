"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";

export type WikipediaSource = { title: string; url: string };

export function WikipediaSourcesDrawer({ sources }: { sources: WikipediaSource[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-400/15"
        aria-label={`Open ${sources.length} Wikipedia sources`}
      >
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        Sources · {sources.length}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Wikipedia sources">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close sources" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-edge bg-panel shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-ink">Sources</h2>
                  <p className="text-[10px] text-ink-faint">Wikipedia references used for this answer</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-muted transition hover:bg-void/50 hover:text-ink" aria-label="Close sources">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {sources.map((source, index) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-3 rounded-2xl border border-edge bg-void/35 p-3.5 transition hover:border-sky-400/30 hover:bg-sky-400/5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 font-mono text-[10px] font-bold text-sky-300">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-5 text-ink">{source.title}</span>
                      <span className="mt-1 block truncate text-[10px] text-ink-faint">{source.url}</span>
                    </span>
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-faint transition group-hover:text-sky-300" />
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
