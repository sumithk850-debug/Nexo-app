"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Pencil, Sparkles, Trash2, Loader2, Check, ChevronDown, Github, Gauge, Zap } from "lucide-react";
import { TypingSpeedBadge } from "./TypingSpeedIndicator";
import type { FileAction, FileActionType, SearchingAction } from "@/lib/craftParser";

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

function SearchingPill({ searching, streaming }: { searching: SearchingAction; streaming: boolean }) {
  const queries = searching.queries.join(", ");
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-edge bg-panel shadow-sm transition-all">
      <div className="flex w-full items-center gap-2 px-3 py-2 text-xs">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/10">
          {streaming ? (
            <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
          ) : (
            <Check className="h-3 w-3 text-violet-400" />
          )}
        </div>
        {streaming ? (
          <span className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
        ) : (
          <Check className="h-3 w-3 flex-shrink-0 text-green-400" />
        )}
        <span className="min-w-0 truncate text-ink">
          <span className={`font-semibold ${streaming ? "text-violet-400" : "text-ink-muted"}`}>
            {streaming ? "Searching" : "Searched"}
          </span>{" "}
          {queries && <span className="truncate text-ink-faint" title={queries}>{queries}</span>}
        </span>
      </div>
    </div>
  );
}

function GeneratingPill({ charsPerSecond, elapsedSeconds }: { charsPerSecond?: number; elapsedSeconds: number }) {
  const speed = charsPerSecond ?? 0;
  const tone = speed > 50 ? "text-green-400" : speed > 20 ? "text-cyan" : speed > 0 ? "text-amber-400" : "text-ink-muted";
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-edge bg-panel shadow-sm transition-all">
      <div className="flex w-full items-center gap-2 px-3 py-2 text-xs">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan/10">
          <Loader2 className="h-3 w-3 animate-spin text-cyan" />
        </div>
        <span className="h-2 w-2 animate-ping rounded-full bg-cyan" />
        <span className={`min-w-0 truncate font-semibold ${tone}`}>Generating response</span>
        <span className="ml-auto flex items-center gap-2">
          {speed > 0 && <TypingSpeedBadge charsPerSecond={speed} streaming />}
          {elapsedSeconds > 0 && <span className="font-mono text-[10px] text-ink-faint">{elapsedSeconds}s</span>}
        </span>
      </div>
    </div>
  );
}

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
  actions,
  streaming,
  repoFullName,
  searching,
  charsPerSecond,
}: {
  actions: FileAction[];
  streaming: boolean;
  repoFullName?: string | null;
  searching?: SearchingAction | null;
  charsPerSecond?: number;
}) {
  const [open, setOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const activeTaskRef = useRef<string | null>(null);

  const latestAction = actions.length > 0 ? actions[actions.length - 1] : null;
  const taskKey = latestAction ? `${latestAction.type}:${latestAction.filePath}` : searching ? `search:${searching.queries.join(",")}` : streaming ? "generating" : null;

  useEffect(() => {
    if (!streaming || !taskKey) {
      setElapsedSeconds(0);
      activeTaskRef.current = null;
      return;
    }
    if (activeTaskRef.current !== taskKey) {
      activeTaskRef.current = taskKey;
      setElapsedSeconds(0);
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [streaming, taskKey]);

  // A live (or just-finished) web search is the most recent activity and
  // should take the lead in the status bar when present.
  const showSearch = !!searching;
  const action = actions.length > 0 ? actions[actions.length - 1] : null;
  const showGenerating = streaming && !action && !showSearch;
  if (!action && !showSearch && !showGenerating) return null;

  if (showGenerating) return <GeneratingPill charsPerSecond={charsPerSecond} elapsedSeconds={elapsedSeconds} />;

  if (showSearch && searching) {
    return <SearchingPill searching={searching} streaming={streaming} />;
  }
  // At this point an action is guaranteed to exist (both empty cases bail above).
  if (!action) return null;
  const style = STYLE_MAP[action.type];
  const Icon = style.icon;

  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-edge bg-panel shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-void/30"
        aria-expanded={open}
        aria-label={open ? "Hide task activity" : "Show task activity"}
      >
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

        <span className="ml-auto flex-shrink-0 text-[10px] text-ink-faint">
          {actions.length} {actions.length === 1 ? "task" : "tasks"}
        </span>

        {/* Typing Speed Indicator */}
        {streaming && elapsedSeconds > 0 && (
          <span className="flex-shrink-0 font-mono text-[10px] text-ink-faint" title="Task elapsed time">
            {elapsedSeconds}s
          </span>
        )}

        {streaming && charsPerSecond !== undefined && charsPerSecond > 0 && (
          <TypingSpeedBadge charsPerSecond={charsPerSecond} streaming={streaming} />
        )}

        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="max-h-72 space-y-2 overflow-y-auto border-t border-edge px-3 py-2">
          {repoFullName && (
            <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
              <Github className="h-3 w-3" />
              <span className="truncate font-mono">{repoFullName}</span>
            </div>
          )}
          {actions.map((item, index) => {
            const itemStyle = STYLE_MAP[item.type];
            const ItemIcon = itemStyle.icon;
            const isActive = streaming && index === actions.length - 1;
            const preview = pickPreview(item);
            return (
              <div key={`${item.type}-${item.filePath}-${index}`} className="rounded-lg border border-edge bg-void/50 p-2">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  {isActive ? <Loader2 className={`h-3.5 w-3.5 animate-spin ${itemStyle.accent}`} /> : <Check className="h-3.5 w-3.5 text-green-400" />}
                  <ItemIcon className={`h-3.5 w-3.5 ${itemStyle.accent}`} />
                  <span className={`font-semibold ${itemStyle.accent}`}>{isActive ? itemStyle.activeLabel : itemStyle.label}</span>
                  <span className="min-w-0 truncate font-mono text-ink" title={item.filePath}>{item.filePath}</span>
                </div>
                {preview && <pre className="mt-2 max-h-48 overflow-auto rounded border border-edge bg-void p-2 font-mono text-[10px] leading-relaxed text-ink-muted">{preview}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
