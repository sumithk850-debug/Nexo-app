"use client";

import { AlertCircle, CheckCircle2, FolderKanban, Loader2, Rocket } from "lucide-react";
import type { VercelReadCardData } from "@/lib/vercelReadParser";

function displayDate(timestamp: number | null) {
  if (!timestamp) return "date unavailable";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleString();
}

export function VercelReadCard({ card }: { card: VercelReadCardData }) {
  const isLoading = card.state === "loading";
  const isSuccess = card.state === "success";
  const needsConnection = card.state === "needs_connection";
  const Icon = isLoading ? Loader2 : isSuccess ? CheckCircle2 : needsConnection ? Rocket : AlertCircle;
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
              {isLoading ? "Reading live data" : isSuccess ? "Verified result" : needsConnection ? "Action needed" : "Connection error"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{card.message}</p>
          {card.projectId && <p className="mt-2 font-mono text-[10px] text-ink-faint">Project: {card.projectId}</p>}
        </div>
      </div>

      {isSuccess && card.kind === "projects" && card.projects && (
        <div className="border-t border-current/15 bg-void/25 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <FolderKanban className="h-3.5 w-3.5" /> Projects found ({card.projects.length})
          </div>
          {card.projects.length > 0 ? (
            <div className="space-y-1.5">
              {card.projects.map((project) => (
                <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink" title={project.name}>{project.name}</p>
                    <p className="font-mono text-[10px] text-ink-faint">
                      {project.framework ?? "framework unavailable"}{project.scopeLabel ? ` · ${project.scopeLabel}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-ink-faint">{project.productionUrl ?? "no production URL"}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-muted">No projects were returned for this connection.</p>}
        </div>
      )}

      {isSuccess && card.kind === "deployments" && card.deployments && (
        <div className="border-t border-current/15 bg-void/25 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <Rocket className="h-3.5 w-3.5" /> Deployments found ({card.deployments.length})
          </div>
          {card.deployments.length > 0 ? (
            <div className="space-y-1.5">
              {card.deployments.slice(0, 8).map((deployment) => (
                <div key={deployment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-ink">{deployment.url ?? deployment.id}</p>
                    <p className="text-[10px] text-ink-faint">{displayDate(deployment.createdAt)}</p>
                  </div>
                  <span className="rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                    {deployment.isProduction ? "production · " : ""}{deployment.readyState ?? "unknown"}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-muted">No deployments were returned for this project.</p>}
        </div>
      )}
    </section>
  );
}
