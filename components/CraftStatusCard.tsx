"use client";

import { useState } from "react";
import {
  Search,
  Pencil,
  Sparkles,
  Trash2,
  Github,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { FileAction, FileActionType } from "@/lib/craftParser";

const STYLE_MAP: Record<
  FileActionType,
  {
    icon: typeof Search;
    border: string;
    bg: string;
    text: string;
    label: string;
    activeLabel: string;
  }
> = {
  reading: {
    icon: Search,
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    label: "Read",
    activeLabel: "Reading",
  },
  editing: {
    icon: Pencil,
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    label: "Edited",
    activeLabel: "Editing",
  },
  creating: {
    icon: Sparkles,
    border: "border-green-500/40",
    bg: "bg-green-500/10",
    text: "text-green-400",
    label: "Created",
    activeLabel: "Creating",
  },
  deleting: {
    icon: Trash2,
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "Deleted",
    activeLabel: "Deleting",
  },
};

function DiffPreview({ raw }: { raw: string }) {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return (
    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-edge bg-void/60 p-3 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        const added = line.startsWith("+");
        const removed = line.startsWith("-");
        return (
          <div
            key={i}
            className={
              added
                ? "text-green-400"
                : removed
                  ? "text-red-400"
                  : "text-ink-faint"
            }
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
}

export function CraftStatusCard({
  action,
  streaming = false,
  repoFullName,
}: {
  action: FileAction;
  streaming?: boolean;
  repoFullName?: string | null;
}) {
  const style = STYLE_MAP[action.type];
  const Icon = style.icon;
  const [open, setOpen] = useState(false);

  const added = action.diffHunk?.add.length ?? 0;
  const removed = action.diffHunk?.remove.length ?? 0;
  const expandable = Boolean(action.diffRaw && (added || removed));

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} px-3 py-2.5`}>
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${style.bg}`}
        >
          {streaming ? (
            <Loader2 className={`h-3.5 w-3.5 animate-spin ${style.text}`} />
          ) : (
            <Icon className={`h-3.5 w-3.5 ${style.text}`} />
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={`flex-shrink-0 text-xs font-semibold ${style.text}`}>
            {streaming ? `${style.activeLabel}…` : style.label}
          </span>
          {/* Files that come from the connected repository are badged with the
              GitHub mark so the user can tell repo reads from local context. */}
          {repoFullName && (
            <Github
              className="h-3 w-3 flex-shrink-0 text-ink-faint"
              aria-label={`from ${repoFullName}`}
            />
          )}
          <span className="truncate font-mono text-xs text-ink" title={action.filePath}>
            {action.filePath}
          </span>
        </div>

        {(added > 0 || removed > 0) && (
          <span className="flex-shrink-0 font-mono text-[10px]">
            <span className="text-green-400">+{added}</span>{" "}
            <span className="text-red-400">-{removed}</span>
          </span>
        )}

        {!action.isDiff && action.linesChanged ? (
          <span className="flex-shrink-0 rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] text-ink-muted">
            {action.linesChanged} lines
          </span>
        ) : null}

        {expandable && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-shrink-0 rounded-md p-1 text-ink-faint transition hover:text-ink"
            aria-label={open ? "Hide changes" : "Show changes"}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {expandable && open && <DiffPreview raw={action.diffRaw!} />}
    </div>
  );
}

export function CraftStatusCardList({
  actions,
  repoFullName,
}: {
  actions: FileAction[];
  repoFullName?: string | null;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="my-3 space-y-2 px-4">
      {actions.map((action, i) => (
        <CraftStatusCard
          key={`${action.filePath}-${i}`}
          action={action}
          repoFullName={repoFullName}
        />
      ))}
    </div>
  );
}
