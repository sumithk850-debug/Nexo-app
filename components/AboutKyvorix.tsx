"use client";

import { X, ShieldCheck, Eye, GitCommit, Sparkles } from "lucide-react";

export function AboutKyvorix({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="about-kyvorix-title">
      <button type="button" aria-label="Close About Kyvorix" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-cyan/25 bg-panel-raised shadow-2xl">
        <div className="flex items-start justify-between border-b border-edge px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">KYVORIX REALITY ENGINE</p>
            <h2 id="about-kyvorix-title" className="mt-1 font-display text-base font-bold text-ink">See what AI sees. Prove what AI does.</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-muted transition hover:bg-panel hover:text-ink" aria-label="Close About Kyvorix">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-ink-muted">
            Kyvorix makes repository work visible and reviewable. When a connected task reads files or prepares a change, the activity is shown before anything is applied.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-edge bg-void/50 p-2.5">
              <Eye className="h-4 w-4 text-cyan" />
              <p className="mt-1 text-[11px] font-semibold text-ink">Read</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint">See the file being inspected.</p>
            </div>
            <div className="rounded-xl border border-edge bg-void/50 p-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              <p className="mt-1 text-[11px] font-semibold text-ink">Review</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint">Check the exact proposed diff.</p>
            </div>
            <div className="rounded-xl border border-edge bg-void/50 p-2.5">
              <GitCommit className="h-4 w-4 text-emerald-300" />
              <p className="mt-1 text-[11px] font-semibold text-ink">Prove</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint">See the commit result after approval.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-cyan/15 bg-cyan/5 px-3 py-2.5 text-[10px] leading-relaxed text-ink-faint">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
            <span>Kyvorix never displays private credentials or secret values in this overview.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
