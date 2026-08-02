"use client";

import { Search, Pencil, Sparkles, Trash2, FileCode } from "lucide-react";
import type { FileAction, FileActionType } from "@/lib/craftParser";

const STYLE_MAP: Record<
  FileActionType,
  { icon: typeof Search; border: string; bg: string; text: string; label: string }
> = {
  reading: {
    icon: Search,
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    label: "READING FILE",
  },
  editing: {
    icon: Pencil,
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    label: "EDITING FILE",
  },
  creating: {
    icon: Sparkles,
    border: "border-green-500/40",
    bg: "bg-green-500/10",
    text: "text-green-400",
    label: "CREATING FILE",
  },
  deleting: {
    icon: Trash2,
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "DELETING FILE",
  },
};

export function CraftStatusCard({ action }: { action: FileAction }) {
  const style = STYLE_MAP[action.type];
  const Icon = style.icon;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3 transition`}
    >
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
        <Icon className={`h-4 w-4 ${style.text} ${action.type === "reading" ? "animate-pulse" : ""}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`font-mono text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
          {style.label}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <FileCode className="h-3 w-3 flex-shrink-0 text-ink-faint" />
          <span className="truncate font-mono text-xs text-ink">{action.filePath}</span>
        </div>
      </div>

      {action.linesChanged !== undefined && (
        <span className="flex-shrink-0 rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] text-ink-muted">
          {action.linesChanged} lines
        </span>
      )}
    </div>
  );
}

export function CraftStatusCardList({ actions }: { actions: FileAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="my-3 space-y-2 px-4">
      {actions.map((action, i) => (
        <CraftStatusCard key={`${action.filePath}-${i}`} action={action} />
      ))}
    </div>
  );
}
