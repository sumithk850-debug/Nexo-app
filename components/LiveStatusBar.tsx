"use client";

import { Search, Pencil, Sparkles, Trash2, Loader2, Check } from "lucide-react";
import type { FileAction, FileActionType } from "@/lib/craftParser";

// A Manus-style compact status bar rendered ABOVE the chat input while Craft
// V3 is actively working on a file. It shows the live (latest) operation with
// a pulsing icon while streaming and collapses to a quiet check-pill once the
// whole response finishes. Content preview (first ~20 lines) expands inline.

const STYLE_MAP: Record<
  FileActionType,
  {
    icon: typeof Search;
    label: string;
    activeLabel: string;
    accent: string;
    chipBg: string;
  }
> = {
  reading: {
    icon: Search,
    label: "Read",
    activeLabel: "Reading",
    accent: "text-blue-400",
    chipBg: "bg-blue-500/10",
  },
  editing: {
    icon: Pencil,
    label: "Edited",
    activeLabel: "Editing",
    accent: "text-amber-400",
    chipBg: "bg-amber-500/10",
  },
  creating: {
    icon: Sparkles,
    label: "Created",
    activeLabel: "Creating",
    accent: "text-green-400",
    chipBg: "bg-green-500/10",
  },
  deleting: {
    icon: Trash2,
    label: "Deleted",
    activeLabel: "Deleting",
    accent: "text-red-400",
    chipBg: "bg-red-500/10",
  },
};

function pickPreview(action: FileAction): string | null {
  // First ~20 lines of whatever content we have: diff block or full content.
  if (action.diffRaw) {
    const lines = action.diffRaw.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(0, 20).join("\n");
  }
  if (action.newContent) {
    return action.newContent.split("\n").slice(0, 20).join("\n");
  }
  return null;
}

export function LiveStatusBar({
  action,
  streaming,
  repoFullName,
}: {
  action: FileAction | null;
  streaming: boolean;
  repoFullName?: string | null;
}) {
  if (!action) return null;

  const style = STYLE_MAP[action.type];
  const Icon = style.icon;
  const preview = pickPreview(action);

  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-edge bg-panel shadow-sm transition-all">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        {/* Icon chip */}
        <div
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${style.chipBg}`}
        >
          {streaming ? (
            <Loader2 className={`h-3 w-3 animate-spin ${style.accent}`} />
          ) : (
            <Icon className={`h-3 w-3 ${style.accent}`} />
          )}
        </div>

        {/* Status dot + description */}
        {streaming ? (
          <span className={`h-2 w-2 animate-ping rounded-full ${style.accent.replace("text-", "bg-")}`} />
        ) : (
          <Check className={`h-3 w-3 flex-shrink-0 text-green-400`} />
        )}

        <span className="min-w-0 truncate text-ink">
          <span className={`font-semibold ${style.accent}`}>
            {streaming ? style.activeLabel : style.label}
          </span>{" "}
          <span className="truncate font-mono" title={action.filePath}>
            {action.filePath}
          </span>
        </span>

        {/* Change counts */}
        {action.diffHunk && (
          <span className="flex-shrink-0 font-mono text-[10px]">
            <span className="text-green-400">+{action.diffHunk.add.length}</span>{" "}
            <span className="text-red-400">-{action.diffHunk.remove.length}</span>
          </span>
        )}

        {repoFullName && (
          <span className="flex-shrink-0 text-[10px] text-ink-faint">{repoFullName}</span>
        )}
      </div>

      {/* Optional content preview (first ~20 lines) */}
      {preview && (
        <pre className="mx-3 mb-2 max-h-56 overflow-auto rounded-lg border border-edge bg-void/70 p-2 font-mono text-[10.5px] leading-relaxed text-ink-muted">
          {preview}
        </pre>
      )}
    </div>
  );
}
