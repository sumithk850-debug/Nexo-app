"use client";

import { AlertCircle, CheckCircle2, Cloud, Github, Loader2, PlugZap } from "lucide-react";
import type { IntegrationReadCardData } from "@/lib/integrationReadParser";

export function IntegrationReadCard({ card }: { card: IntegrationReadCardData }) {
  const isLoading = card.state === "loading";
  const isSuccess = card.state === "success";
  const isNeedsConnection = card.state === "needs_connection";
  const ServiceIcon = card.service === "vercel" ? Cloud : Github;
  const StateIcon = isLoading ? Loader2 : isSuccess ? CheckCircle2 : isNeedsConnection ? PlugZap : AlertCircle;
  const accent = isLoading
    ? "border-cyan/35 bg-cyan/5 text-cyan"
    : isSuccess
      ? "border-emerald-400/35 bg-emerald-400/5 text-emerald-400"
      : "border-amber-400/35 bg-amber-400/5 text-amber-300";
  const label = isLoading ? "Reading live data" : isSuccess ? "Verified result" : isNeedsConnection ? "Action needed" : "Connection error";

  return (
    <section className={`my-3 overflow-hidden rounded-2xl border shadow-sm ${accent}`} aria-live="polite">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-void/45">
          {isLoading ? <StateIcon className="h-5 w-5 animate-spin" /> : <ServiceIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{card.title}</p>
            <span className="rounded-full border border-current/25 bg-void/35 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">{label}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{card.message}</p>
        </div>
      </div>
      {isSuccess && card.items && (
        <div className="border-t border-current/15 bg-void/25 px-4 py-3">
          <div className="space-y-1.5">
            {card.items.length > 0 ? card.items.map((item, index) => (
              <div key={`${item.primary}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-2.5 py-2">
                <span className="min-w-0 truncate text-xs font-semibold text-ink" title={item.primary}>{item.primary}</span>
                {item.secondary && <span className="font-mono text-[10px] text-ink-faint">{item.secondary}</span>}
              </div>
            )) : <p className="text-xs text-ink-muted">The connected account returned no matching items.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
