"use client";

import { useState } from "react";
import { CheckCircle2, FileCode2, FilePlus2, FileText, GitBranch, ShieldCheck, Trash2 } from "lucide-react";
import type { FileAction } from "@/lib/craftParser";

type WorkspaceStatus = "pending" | "approving" | "approved" | "rejected" | "error";

function actionLabel(action: FileAction) {
  if (action.type === "creating") return "Create";
  if (action.type === "deleting") return "Delete";
  return "Edit";
}

function actionTone(action: FileAction) {
  if (action.type === "creating") return "text-emerald-300 border-emerald-400/25 bg-emerald-400/10";
  if (action.type === "deleting") return "text-rose-300 border-rose-400/25 bg-rose-400/10";
  return "text-amber-200 border-amber-300/25 bg-amber-300/10";
}

export function ProjectFilesWorkspace({ actions, status }: { actions: FileAction[]; status: WorkspaceStatus }) {
  const files = actions.filter((action) => action.type !== "reading");
  const [selectedPath, setSelectedPath] = useState(files[0]?.filePath ?? "");
  const selected = files.find((action) => action.filePath === selectedPath) ?? files[0];
  const fileCount = files.length;
  const statusText = status === "approved"
    ? "Push completed"
    : status === "approving"
      ? "Pushing approved changes…"
      : status === "rejected"
        ? "Proposal rejected"
        : status === "error"
          ? "Push needs attention"
          : "Awaiting your review";

  if (fileCount === 0) return null;

  return (
    <section className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel/90 shadow-2xl ring-1 ring-cyan/15" aria-label="Multi-file project workspace">
      <header className="border-b border-edge bg-panel-raised/70 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan"><FileCode2 className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Project workspace</h2>
            <p className="text-[11px] text-ink-muted">{fileCount} file{fileCount === 1 ? "" : "s"} in this proposal</p>
          </div>
          <span className={`inline-flex max-w-[45%] items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold sm:text-[10px] ${status === "approved" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : status === "error" ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : "border-cyan/20 bg-cyan/5 text-cyan"}`}>
            {status === "approved" ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : status === "error" ? <ShieldCheck className="h-3 w-3 shrink-0" /> : <GitBranch className="h-3 w-3 shrink-0" />}
            <span className="truncate">{statusText}</span>
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(145px,0.34fr)_minmax(0,1fr)]">
        <nav className="flex max-h-28 gap-1 overflow-x-auto border-b border-edge bg-void/30 p-2 md:max-h-none md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r" aria-label="Changed files">
          {files.map((action) => {
            const active = action.filePath === selected?.filePath;
            const Icon = action.type === "deleting" ? Trash2 : action.type === "creating" ? FilePlus2 : FileText;
            return (
              <button
                key={action.filePath}
                onClick={() => setSelectedPath(action.filePath)}
                aria-pressed={active}
                title={action.filePath}
                className={`flex min-w-[160px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition md:min-w-0 ${active ? "border-cyan/30 bg-cyan/10 text-ink" : "border-transparent text-ink-muted hover:border-edge hover:bg-panel/60 hover:text-ink"}`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${action.type === "deleting" ? "text-rose-300" : action.type === "creating" ? "text-emerald-300" : "text-cyan"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[10px]">{action.filePath.split("/").pop()}</span>
                  <span className="block truncate text-[9px] text-ink-faint">{actionLabel(action)} · {action.filePath.includes("/") ? action.filePath.slice(0, action.filePath.lastIndexOf("/")) : "root"}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 overflow-auto bg-void/35 p-3 sm:p-4">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-edge pb-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs text-cyan">{selected.filePath}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{actionLabel(selected)} file · read-only review</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${actionTone(selected)}`}>{actionLabel(selected)}</span>
              </div>
              {selected.type === "deleting" ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
                  <Trash2 className="h-5 w-5 text-rose-300" />
                  <p className="mt-2 text-sm font-semibold text-ink">This file will be deleted</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">Review the deletion in the approval card before pushing. The repository is unchanged until you approve.</p>
                </div>
              ) : selected.diffRaw ? (
                <pre className="overflow-auto rounded-xl border border-edge bg-void p-3 font-mono text-[11px] leading-5 text-ink"><code>{selected.diffRaw}</code></pre>
              ) : selected.newContent ? (
                <pre className="overflow-auto rounded-xl border border-edge bg-void p-3 font-mono text-[11px] leading-5 text-ink"><code>{selected.newContent}</code></pre>
              ) : (
                <div className="rounded-xl border border-dashed border-edge p-4 text-xs leading-relaxed text-ink-muted">No file content is attached to this action. Open the approval card for the available details. Do not push until the intended change is clear.</div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-edge bg-panel-raised/40 px-3 py-2.5 text-[10px] text-ink-faint sm:px-4">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Review-only workspace</span>
        <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-cyan" /> Push is controlled from the approval card</span>
      </footer>
    </section>
  );
}
