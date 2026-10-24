"use client";

import { AlertCircle, CheckCircle2, ExternalLink, FileSearch, FolderTree, Github } from "lucide-react";
import type { GitHubActionActivity } from "@/lib/githubActionParser";

export function GitHubActionCard({ activity }: { activity: GitHubActionActivity }) {
  const isSuccess = activity.state === "success";
  const isNeedsConnection = activity.state === "needs_connection";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const accent = isSuccess
    ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300"
    : isNeedsConnection
      ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-200"
      : "border-rose-400/30 bg-rose-400/[0.06] text-rose-200";
  const title = activity.operation === "read_file" ? "File read" : "Repository files checked";

  return (
    <section className={`my-2 overflow-hidden rounded-2xl border shadow-[0_12px_30px_rgba(0,0,0,0.14)] ${accent}`} aria-live="polite">
      <div className="flex items-start gap-3 px-3.5 py-3 sm:px-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-void/40">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-current">
              <Github className="h-3.5 w-3.5" /> GitHub
            </div>
            <span className="rounded-full border border-current/25 bg-void/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              {isSuccess ? "Verified" : isNeedsConnection ? "Action needed" : "Not completed"}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 break-words text-xs leading-5 text-ink-muted">{activity.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-ink-faint">
            {activity.repository && <span className="max-w-full truncate font-mono" title={activity.repository}>{activity.repository}</span>}
            <span className="rounded-md border border-current/15 bg-void/30 px-2 py-1 font-mono" title={activity.target}>
              {activity.target}
            </span>
          </div>
          {activity.url && (
            <a href={activity.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-current underline-offset-4 hover:underline">
              {activity.operation === "read_file" ? <FileSearch className="h-3.5 w-3.5" /> : <FolderTree className="h-3.5 w-3.5" />}
              Open in GitHub <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
