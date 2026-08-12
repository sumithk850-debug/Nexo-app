"use client";

import {
  FileSearch,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  Loader2,
  FileCheck,
} from "lucide-react";
import type { TaskSummary } from "@/lib/craftParser";

const STATUS_STYLE: Record<
  TaskSummary["status"],
  {
    icon: typeof CheckCircle2;
    label: string;
    chipBg: string;
    chipText: string;
  }
> = {
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    chipBg: "bg-green-500/10",
    chipText: "text-green-400",
  },
  partial: {
    icon: AlertTriangle,
    label: "Partial",
    chipBg: "bg-amber-500/10",
    chipText: "text-amber-400",
  },
  blocked: {
    icon: CircleDashed,
    label: "Blocked",
    chipBg: "bg-red-500/10",
    chipText: "text-red-400",
  },
};

// Manus-style task completion report card: rendered at the END of a coder
// message, summarizing exactly what Nexo did during the task (files read,
// changed, deleted) and its outcome — instead of a wall of prose.
export function SummaryCard({
  summary,
  streaming = false,
}: {
  summary: TaskSummary;
  streaming?: boolean;
}) {
  const statusStyle = STATUS_STYLE[summary.status];
  const StatusIcon = statusStyle.icon;

  if (streaming) {
    return (
      <div className="my-2 inline-flex max-w-full items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs shadow-sm">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/10">
          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
        </div>
        <span className="text-ink-faint">Generating task report…</span>
      </div>
    );
  }

  const hasSections =
    summary.filesRead.length > 0 ||
    summary.filesChanged.length > 0 ||
    summary.filesDeleted.length > 0;

  return (
    <div className="my-2 w-full max-w-full overflow-hidden rounded-xl border border-edge bg-panel shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/10">
          <FileCheck className="h-3 w-3 text-cyan-400" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          Task Report
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.chipBg} ${statusStyle.chipText}`}
        >
          <StatusIcon className="h-3 w-3" />
          {statusStyle.label}
        </span>
      </div>

      {/* Sections */}
      {hasSections && (
        <div className="space-y-1.5 px-3 py-2 text-xs">
          {summary.filesRead.length > 0 && (
            <div className="flex items-start gap-2">
              <FileSearch className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-400" />
              <span className="min-w-0 text-ink">
                <span className="text-ink-faint">Read </span>
                <span className="font-mono text-[11px]">
                  {summary.filesRead.join(", ")}
                </span>
              </span>
            </div>
          )}

          {summary.filesChanged.length > 0 && (
            <div className="flex items-start gap-2">
              <Pencil className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
              <div className="min-w-0">
                {summary.filesChanged.map((entry, i) => (
                  <span key={i} className="mr-2 inline-block">
                    <span
                      className={`font-semibold ${
                        entry.created ? "text-green-400" : "text-amber-400"
                      }`}
                    >
                      {entry.created ? "Created" : "Changed"}{" "}
                    </span>
                    <span className="font-mono text-[11px] text-ink">
                      {entry.path}
                    </span>
                    {(entry.additions || 0) + (entry.deletions || 0) > 0 && (
                      <span className="ml-1 font-mono text-[10px]">
                        <span className="text-green-400">
                          +{entry.additions ?? 0}
                        </span>{" "}
                        <span className="text-red-400">
                          -{entry.deletions ?? 0}
                        </span>
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary.filesDeleted.length > 0 && (
            <div className="flex items-start gap-2">
              <Trash2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-400" />
              <span className="min-w-0 text-ink">
                <span className="text-ink-faint">Deleted </span>
                <span className="line-through decoration-red-400/60 font-mono text-[11px]">
                  {summary.filesDeleted.join(", ")}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Details line */}
      {summary.details && (
        <p className="border-t border-edge px-3 py-2 text-[11px] italic text-ink-faint">
          {summary.details}
        </p>
      )}
    </div>
  );
}
