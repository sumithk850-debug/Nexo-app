"use client";

import { AlertCircle, CheckCircle2, Database, Loader2, Table2 } from "lucide-react";
import type { SupabaseReadCardData } from "@/lib/supabaseReadParser";

export function SupabaseReadCard({ card }: { card: SupabaseReadCardData }) {
  const isLoading = card.state === "loading";
  const isSuccess = card.state === "success";
  const isNeedsProject = card.state === "needs_project";
  const Icon = isLoading ? Loader2 : isSuccess ? CheckCircle2 : isNeedsProject ? Database : AlertCircle;
  const accent = isLoading
    ? "border-cyan/35 bg-cyan/5 text-cyan"
    : isSuccess
      ? "border-emerald-400/35 bg-emerald-400/5 text-emerald-400"
      : "border-amber-400/35 bg-amber-400/5 text-amber-300";

  return (
    <section className={`my-3 overflow-hidden rounded-2xl border shadow-sm ${accent}`} aria-live="polite">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-void/45">
          <Icon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{card.title}</p>
            <span className="rounded-full border border-current/25 bg-void/35 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {isLoading ? "Reading live data" : isSuccess ? "Verified result" : isNeedsProject ? "Action needed" : "Connection error"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{card.message}</p>
          {card.projectId && <p className="mt-2 font-mono text-[10px] text-ink-faint">Project: {card.projectId}</p>}
        </div>
      </div>

      {isSuccess && card.tableNames && (
        <div className="border-t border-current/15 bg-void/25 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Table2 className="h-3.5 w-3.5" /> Tables found ({card.tableNames.length})
          </div>
          {card.tableNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {card.tableNames.map((table) => <span key={table} className="rounded-md border border-edge bg-panel px-2 py-1 font-mono text-[11px] text-ink">{table}</span>)}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">No public tables were returned for this project.</p>
          )}
          {typeof card.policyCount === "number" && <p className="mt-2 text-[11px] text-ink-faint">RLS policies returned: {card.policyCount}</p>}
        </div>
      )}
      {isSuccess && card.kind === "projects" && card.projects && (
        <div className="border-t border-current/15 bg-void/25 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Database className="h-3.5 w-3.5" /> Connected projects ({card.projects.length})
          </div>
          {card.projects.length > 0 ? (
            <div className="space-y-1.5">
              {card.projects.map((project) => (
                <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-2.5 py-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-ink" title={project.name}>{project.name}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{project.region ?? "region unavailable"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">No connected Supabase projects were returned.</p>
          )}
        </div>
      )}
    </section>
  );
}
