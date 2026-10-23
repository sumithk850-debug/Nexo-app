"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Globe2, Loader2, ShieldCheck, Unplug, BookOpen, X } from "lucide-react";

export type BrowserConnectionState = "unknown" | "connected" | "not-connected" | "connecting" | "error";

export function BrowserConnectionCard({
  state,
  activeTab,
  error,
  onConnect,
  onRead,
  onDisconnect,
  onDismiss,
}: {
  state: BrowserConnectionState;
  activeTab?: { title?: string; url?: string } | null;
  error?: string | null;
  onConnect: () => void;
  onRead: () => void;
  onDisconnect: () => void;
  onDismiss?: () => void;
}) {
  const [busyAction, setBusyAction] = useState<"connect" | "read" | null>(null);
  const connected = state === "connected";
  const busy = state === "connecting" || busyAction !== null;

  const run = (action: "connect" | "read", callback: () => void) => {
    setBusyAction(action);
    callback();
    window.setTimeout(() => setBusyAction(null), 1_500);
  };

  return (
    <section className="my-4 mx-4 overflow-hidden rounded-[1.35rem] border border-cyan/25 bg-panel/95 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-xl" aria-label="Browser connection">
      <div className="flex items-start gap-3 border-b border-edge/70 bg-gradient-to-br from-cyan/[0.12] via-panel to-indigo/[0.08] px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan"><Globe2 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><p className="font-display text-sm font-bold text-ink">Browser connection</p><span className="rounded-full border border-cyan/25 bg-cyan/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan">local</span></div>
            {onDismiss && <button type="button" onClick={onDismiss} className="rounded-lg p-1 text-ink-faint hover:bg-void hover:text-ink" aria-label="Dismiss browser card"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">Use your own browser tab. NEXO never receives cookies, passwords, or hidden fields.</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-edge bg-void/60 p-3"><ShieldCheck className="h-4 w-4 text-cyan" /><p className="mt-2 text-[10px] font-semibold text-ink">User controlled</p><p className="mt-1 text-[10px] leading-relaxed text-ink-faint">Every browser action stays under your approval.</p></div>
          <div className="rounded-xl border border-edge bg-void/60 p-3"><Globe2 className="h-4 w-4 text-cyan" /><p className="mt-2 text-[10px] font-semibold text-ink">Local tab</p><p className="mt-1 text-[10px] leading-relaxed text-ink-faint">Works with the tab you choose in Chrome or Edge.</p></div>
          <div className="rounded-xl border border-edge bg-void/60 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><p className="mt-2 text-[10px] font-semibold text-ink">No hosted browser</p><p className="mt-1 text-[10px] leading-relaxed text-ink-faint">No separate cloud browser or account is created.</p></div>
        </div>

        {connected ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Browser connected</div>
            <p className="mt-1 truncate font-mono text-[10px] text-ink-faint" title={activeTab?.url}>{activeTab?.title || "Active browser tab available"}{activeTab?.url ? ` · ${activeTab.url}` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => run("read", onRead)} className="inline-flex items-center gap-2 rounded-full bg-cyan px-3 py-2 text-xs font-semibold text-void disabled:opacity-50"><BookOpen className="h-3.5 w-3.5" /> Read current page</button>
              <button type="button" onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-full border border-edge px-3 py-2 text-xs font-semibold text-ink-muted hover:border-red-400/40 hover:text-red-300"><Unplug className="h-3.5 w-3.5" /> Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-3">
            <p className="text-xs font-semibold text-ink">Connect once from Integrations</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">Open Integrations → Browser Automation and complete the one-time local browser connection. After that, browser requests can start here.</p>
            <button type="button" disabled={busy} onClick={() => run("connect", onConnect)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-cyan px-3 py-2 text-xs font-semibold text-void disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} {busy ? "Checking connection…" : "Check browser connection"}
            </button>
          </div>
        )}
        {error && <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</p>}
      </div>
    </section>
  );
}
