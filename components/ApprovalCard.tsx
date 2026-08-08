"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, Eye, EyeOff, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { FileAction, FileActionType } from "@/lib/craftParser";

const TYPE_ICON: Record<FileActionType, typeof Pencil> = {
  reading: Eye,
  editing: Pencil,
  creating: Sparkles,
  deleting: Trash2,
};

const TYPE_LABEL: Record<FileActionType, string> = {
  reading: "Read",
  editing: "Edit",
  creating: "Create",
  deleting: "Delete",
};

const TYPE_COLOR: Record<FileActionType, string> = {
  reading: "text-blue-400",
  editing: "text-amber-400",
  creating: "text-green-400",
  deleting: "text-red-400",
};

export function ApprovalCard({
  actions,
  commitMessage,
  repoFullName,
  onApprove,
  onReject,
  status,
}: {
  actions: FileAction[];
  commitMessage: string;
  repoFullName: string | null;
  onApprove: () => void;
  onReject: () => void;
  status: "pending" | "approving" | "approved" | "rejected" | "error";
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  // Skip reading-only actions and any action with empty content — empty blocks
  // are a model failure mode and must never produce a visible approval card.
  const proposalActions = actions.filter(
    (a) => a.type !== "reading" && !!a.newContent?.trim()
  );

  if (proposalActions.length === 0) return null;

  return (
    <div className="my-4 mx-4 overflow-hidden rounded-2xl border border-cyan/30 bg-panel shadow-lg">
      <div className="flex items-center gap-2 border-b border-edge bg-cyan/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-cyan" />
        <div>
          <p className="font-display text-sm font-bold text-ink">
            NEXO Craft V3: Action Required
          </p>
          <p className="text-[11px] text-ink-muted">
            The agent wants to make changes to your repository.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {repoFullName && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-faint">Repository:</span>
            <span className="font-mono text-ink">{repoFullName}</span>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">Proposed changes:</p>
          <div className="space-y-1">
            {proposalActions.map((action, i) => {
              const Icon = TYPE_ICON[action.type];
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${TYPE_COLOR[action.type]}`} />
                  <span className={`font-medium ${TYPE_COLOR[action.type]}`}>
                    {TYPE_LABEL[action.type]}:
                  </span>
                  <span className="truncate font-mono text-ink">{action.filePath}</span>
                  {action.linesChanged !== undefined && (
                    <span className="flex-shrink-0 text-ink-faint">
                      ({action.linesChanged} lines)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {commitMessage && (
          <div className="rounded-lg border border-edge bg-void p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Commit message
            </p>
            <p className="font-mono text-xs text-ink">&quot;{commitMessage}&quot;</p>
          </div>
        )}

        <button
          onClick={() => setDiffOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge py-2 text-xs font-medium text-ink-muted transition hover:border-cyan/40 hover:text-ink"
        >
          {diffOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {diffOpen ? "Hide code" : "View code"}
        </button>

        {diffOpen && (
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-edge bg-void p-3">
            {proposalActions.map((action, i) => (
              <div key={i}>
                <p className="mb-1 font-mono text-[10px] text-cyan">{action.filePath}</p>
                <pre className="overflow-x-auto rounded bg-panel p-2 text-[11px] text-ink">
                  <code>{action.newContent ?? "(no preview available)"}</code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {status === "pending" && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onApprove}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              <Check className="h-4 w-4" />
              Approve & Commit
            </button>
            <button
              onClick={onReject}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/40 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}

        {status === "approving" && (
          <div className="rounded-lg bg-cyan/10 py-2.5 text-center text-sm font-medium text-cyan">
            Committing to {repoFullName}…
          </div>
        )}
        {status === "approved" && (
          <div className="rounded-lg bg-green-500/10 py-2.5 text-center text-sm font-medium text-green-400">
            ✅ Changes committed successfully
          </div>
        )}
        {status === "rejected" && (
          <div className="rounded-lg bg-edge py-2.5 text-center text-sm font-medium text-ink-muted">
            Changes rejected
          </div>
        )}
        {status === "error" && (
          <div className="rounded-lg bg-red-500/10 py-2.5 text-center text-sm font-medium text-red-400">
            ❌ Commit failed — please try again
          </div>
        )}
      </div>
    </div>
  );
}
