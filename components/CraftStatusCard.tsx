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
  Check,
} from "lucide-react";
import type { FileAction, FileActionType } from "@/lib/craftParser";

const STYLE_MAP: Record<
  FileActionType,
  {
    icon: typeof Search;
    label: string;
    activeLabel: string;
    chipBg: string;
    chipText: string;
    dot: string;
  }
> = {
  reading: {
    icon: Search,
    label: "Read",
    activeLabel: "Reading",
    chipBg: "bg-blue-500/10",
    chipText: "text-blue-400",
    dot: "bg-blue-400",
  },
  editing: {
    icon: Pencil,
    label: "Edited",
    activeLabel: "Editing",
    chipBg: "bg-amber-500/10",
    chipText: "text-amber-400",
    dot: "bg-amber-400",
  },
  creating: {
    icon: Sparkles,
    label: "Created",
    activeLabel: "Creating",
    chipBg: "bg-green-500/10",
    chipText: "text-green-400",
    dot: "bg-green-400",
  },
  deleting: {
    icon: Trash2,
    label: "Deleted",
    activeLabel: "Deleting",
    chipBg: "bg-red-500/10",
    chipText: "text-red-400",
    dot: "bg-red-400",
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

// Manus-style compact task pill: a small capsule badge rendered INLINE in the
// message flow (not a big card). Running → spinner pill; completed → collapsed
// check-pill; details (diff) expand on demand.
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
  const hasChanges = added > 0 || removed > 0;
  const expandable = Boolean(action.diffRaw && hasChanges);

  return (
    <div className="my-2">
      <div
        className={`inline-flex max-w-full items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs shadow-sm transition-all`}
      >
        {/* 1. Tool icon chip (GitHub logo-style) */}
        <div
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${style.chipBg}`}
        >
          {streaming ? (
            <Loader2 className={`h-3 w-3 animate-spin ${style.chipText}`} />
          ) : (
            <Icon className={`h-3 w-3 ${style.chipText}`} />
          )}
        </div>

        {/* 2. Status dot: pinging while running, solid check when done */}
        {streaming ? (
          <span className={`h-2 w-2 animate-ping rounded-full ${style.dot}`} />
        ) : (
          <Check className={`h-3 w-3 flex-shrink-0 text-green-400`} />
        )}

        {/* 3. Action description — only the path + state, never the content */}
        <span className="min-w-0 truncate text-ink">
          <span className={`font-semibold ${style.chipText}`}>
            {streaming ? `${style.activeLabel}` : style.label}
          </span>{" "}
          <span className="truncate font-mono" title={action.filePath}>
            {action.filePath}
          </span>
        </span>

        {/* 4. GitHub repo mark */}
        {repoFullName && (
          <Github
            className="h-3 w-3 flex-shrink-0 text-ink-faint"
            aria-label={`from ${repoFullName}`}
          />
        )}

        {/* 5. Change counts / collapsible details */}
        {hasChanges && (
          <span className="flex-shrink-0 font-mono text-[10px]">
            <span className="text-green-400">+{added}</span>{" "}
            <span className="text-red-400">-{removed}</span>
          </span>
        )}

        {expandable && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-shrink-0 text-[10px] text-ink-faint transition hover:text-ink"
            aria-label={open ? "Hide changes" : "Show changes"}
          >
            {open ? "hide" : "details"}
            <ChevronDown
              className={`ml-0.5 inline h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
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
