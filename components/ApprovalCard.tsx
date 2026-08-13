"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  X,
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
  Trash2,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  GitCommit,
} from "lucide-react";
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

const PROGRESS_STEPS = [
  "Validating files…",
  "Creating blobs…",
  "Building tree…",
  "Creating commit…",
  "Updating branch…",
];

export function ApprovalCard({
  actions,
  commitMessage,
  repoFullName,
  onApprove,
  onReject,
  status,
  errorDetail,
  progressStep,
  commitUrl,
  prUrl,
  onRetry,
}: {
  actions: FileAction[];
  commitMessage: string;
  repoFullName: string | null;
  onApprove: (mode: "direct" | "pr") => void;
  onReject: () => void;
  status: "pending" | "approving" | "approved" | "rejected" | "error";
  errorDetail?: string | null;
  progressStep?: number;
  commitUrl?: string | null;
  prUrl?: string | null;
  onRetry?: () => void;
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"direct" | "pr">("direct");
  const [showBranchInput, setShowBranchInput] = useState(false);
  const [branchName, setBranchName] = useState("");

  const proposalActions = actions.filter((a) => {
    if (a.type === "reading") return false;
    if (a.diffRaw) return true;
    if (a.newContent?.trim()) return true;
    if (a.type === "deleting" || a.type === "creating") return true;
    return false;
  });

  if (proposalActions.length === 0) return null;

  const handleApprove = () => {
    onApprove(selectedMode);
  };

  return (
    <div className="my-4 mx-4 overflow-hidden rounded-2xl border border-cyan/30 bg-panel shadow-lg">
      {/* Header */}
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
        {/* Repository */}
        {repoFullName && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-faint">Repository:</span>
            <span className="font-mono text-ink">{repoFullName}</span>
          </div>
        )}

        {/* Proposed changes */}
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
                  {action.type === "deleting" && (
                    <span className="flex-shrink-0 rounded-full border border-red-500/40 px-2 py-0.5 text-[10px] text-red-400">
                      will be removed from GitHub
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit message */}
        {commitMessage && (
          <div className="rounded-lg border border-edge bg-void p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Commit message
            </p>
            <p className="font-mono text-xs text-ink">&quot;{commitMessage}&quot;</p>
          </div>
        )}

        {/* Mode selector (only in pending state) */}
        {status === "pending" && (
          <div className="rounded-lg border border-edge bg-void p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Commit mode
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedMode("direct");
                  setShowBranchInput(false);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  selectedMode === "direct"
                    ? "border-cyan/60 bg-cyan/10 text-cyan"
                    : "border-edge text-ink-muted hover:border-cyan/30 hover:text-ink"
                }`}
              >
                <GitCommit className="h-3.5 w-3.5" />
                Commit to main
              </button>
              <button
                onClick={() => {
                  setSelectedMode("pr");
                  setShowBranchInput(true);
                  setBranchName(
                    `nexo-craft/${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`
                  );
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  selectedMode === "pr"
                    ? "border-cyan/60 bg-cyan/10 text-cyan"
                    : "border-edge text-ink-muted hover:border-cyan/30 hover:text-ink"
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                Open as PR
              </button>
            </div>
            {showBranchInput && selectedMode === "pr" && (
              <div className="mt-2 flex items-center gap-2">
                <GitBranch className="h-3 w-3 flex-shrink-0 text-ink-faint" />
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="branch-name"
                  className="w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-cyan/50"
                />
              </div>
            )}
          </div>
        )}

        {/* Diff viewer */}
        {!proposalActions.every((a) => a.type === "deleting") && (
          <button
            onClick={() => setDiffOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge py-2 text-xs font-medium text-ink-muted transition hover:border-cyan/40 hover:text-ink"
          >
            {diffOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {diffOpen ? "Hide code" : "View code"}
          </button>
        )}

        {diffOpen && (
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-edge bg-void p-3">
            {proposalActions.map((action, i) => (
              <div key={i}>
                <p className="mb-1 font-mono text-[10px] text-cyan">{action.filePath}</p>
                {action.diffRaw ? (
                  <pre className="overflow-x-auto rounded bg-panel p-2 text-[11px] leading-relaxed">
                    {action.diffRaw.split("\n").map((line, j) => {
                      const cls = line.startsWith("-")
                        ? "text-red-400"
                        : line.startsWith("+")
                          ? "text-green-400"
                          : "text-ink-faint";
                      return (
                        <div key={j} className={cls}>
                          {line || " "}
                        </div>
                      );
                    })}
                  </pre>
                ) : (
                  <pre className="overflow-x-auto rounded bg-panel p-2 text-[11px] text-ink">
                    <code>{action.newContent ?? "(no preview available)"}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {status === "pending" && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApprove}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              <Check className="h-4 w-4" />
              Approve & Commit
              {selectedMode === "pr" && <GitPullRequest className="h-3.5 w-3.5" />}
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

        {/* Progress state */}
        {status === "approving" && (
          <div className="rounded-lg bg-cyan/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Committing to {repoFullName}…</span>
            </div>
            <div className="mt-2 space-y-1">
              {PROGRESS_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 text-[10px] font-mono ${
                    i < (progressStep ?? 0)
                      ? "text-green-400"
                      : i === (progressStep ?? 0)
                        ? "text-cyan"
                        : "text-ink-faint"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {step}
                  {i < (progressStep ?? 0) && " ✓"}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved state with links */}
        {status === "approved" && (
          <div className="space-y-2">
            <div className="rounded-lg bg-green-500/10 py-2.5 text-center text-sm font-medium text-green-400">
              ✅ Changes committed successfully
            </div>
            <div className="space-y-1">
              {commitUrl && (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-300 transition hover:bg-green-500/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View commit on GitHub
                </a>
              )}
              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs text-purple-300 transition hover:bg-purple-500/10"
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  View Pull Request on GitHub
                </a>
              )}
            </div>
          </div>
        )}

        {/* Rejected state */}
        {status === "rejected" && (
          <div className="rounded-lg bg-edge py-2.5 text-center text-sm font-medium text-ink-muted">
            Changes rejected
          </div>
        )}

        {/* Error state with retry */}
        {status === "error" && (
          <div className="space-y-2">
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <p className="text-sm font-medium text-red-400">
                ❌ Commit failed
              </p>
              {errorDetail && (
                <p className="mt-1 max-h-24 overflow-auto break-words border-t border-red-500/20 pt-1.5 font-mono text-[10px] leading-relaxed text-red-300/80">
                  {errorDetail}
                </p>
              )}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan/40 py-2 text-xs font-medium text-cyan transition hover:bg-cyan/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
