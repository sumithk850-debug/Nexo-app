"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  FileCode2,
  FilePlus2,
  Github,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { FileActivityArtifact } from "@/lib/types";

const ACTION_STYLE = {
  reading: { label: "Read", active: "Reading", color: "text-blue-400", background: "bg-blue-400/10", icon: Eye },
  editing: { label: "Edit", active: "Editing", color: "text-amber-400", background: "bg-amber-400/10", icon: Pencil },
  creating: { label: "Create", active: "Creating", color: "text-green-400", background: "bg-green-400/10", icon: FilePlus2 },
  deleting: { label: "Delete", active: "Deleting", color: "text-rose-400", background: "bg-rose-400/10", icon: Trash2 },
} as const;

function labelForState(artifact: FileActivityArtifact) {
  const style = ACTION_STYLE[artifact.action];
  if (artifact.state === "loading") return style.active;
  if (artifact.state === "error") return "Could not read";
  if (artifact.state === "proposed") return `Proposed ${style.label.toLowerCase()}`;
  return artifact.action === "reading" ? "Read" : `${style.label} verified`;
}

export function FileActivityPreview({ artifact }: { artifact: FileActivityArtifact }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"content" | "diff">(artifact.diff ? "diff" : "content");
  const [copied, setCopied] = useState(false);
  const style = ACTION_STYLE[artifact.action];
  const Icon = style.icon;
  const busy = artifact.state === "loading";
  const failed = artifact.state === "error";
  const hasContent = typeof artifact.content === "string";
  const hasDiff = Boolean(artifact.diff);
  const source = tab === "diff" ? artifact.diff ?? "" : artifact.content ?? "";

  async function copySource() {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      // Clipboard access can be unavailable in embedded browsers.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/file-preview my-2 flex w-full max-w-md items-center gap-3 rounded-2xl border border-edge bg-panel/90 p-2.5 text-left shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan/45 hover:bg-panel focus:outline-none focus:ring-2 focus:ring-cyan/60 active:scale-[0.98]"
        aria-label={`Open ${artifact.filePath} ${artifact.action} details`}
      >
        <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-edge ${style.background}`}>
          <FileCode2 className={`h-6 w-6 ${style.color}`} />
          {busy && <Loader2 className="absolute bottom-1 right-1 h-3.5 w-3.5 animate-spin text-cyan" />}
          {!busy && !failed && <Check className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-panel p-0.5 text-green-400" />}
          {failed && <AlertTriangle className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-panel p-0.5 text-rose-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${style.color}`} />
            <span className={`text-xs font-semibold ${style.color}`}>{labelForState(artifact)}</span>
            {artifact.state === "success" && <span className="text-[10px] text-ink-faint">Verified</span>}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-ink" title={artifact.filePath}>{artifact.filePath}</p>
          <p className="mt-0.5 truncate text-[10px] text-ink-faint">
            {artifact.lineCount !== undefined ? `${artifact.lineCount.toLocaleString()} lines` : artifact.message ?? "Tap to inspect"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-ink-faint">
          <Github className="h-3.5 w-3.5" />
          <span className="opacity-0 transition group-hover/file-preview:opacity-100">Open</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end bg-void/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={`File details for ${artifact.filePath}`}>
          <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-edge bg-panel shadow-2xl sm:max-h-[82vh] sm:max-w-4xl sm:rounded-3xl">
            <div className="flex items-start gap-3 border-b border-edge px-4 py-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.background}`}><FileCode2 className={`h-5 w-5 ${style.color}`} /></div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${style.color}`}>{labelForState(artifact)}</p>
                <p className="truncate font-mono text-sm text-ink" title={artifact.filePath}>{artifact.filePath}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">{artifact.state === "proposed" ? "Review this proposed source before approval. It is not committed." : artifact.message ?? "Verified file activity"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-muted transition hover:bg-void hover:text-ink" aria-label="Close file viewer"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-edge bg-void/30 px-4 py-2">
              <div className="flex min-w-0 items-center gap-1 rounded-lg bg-void/60 p-1">
                <button type="button" onClick={() => setTab("content")} disabled={!hasContent} className={`rounded-md px-2.5 py-1 text-xs transition ${tab === "content" ? "bg-panel text-cyan shadow-sm" : "text-ink-muted hover:text-ink"} disabled:cursor-not-allowed disabled:opacity-40`}>Full file</button>
                <button type="button" onClick={() => setTab("diff")} disabled={!hasDiff} className={`rounded-md px-2.5 py-1 text-xs transition ${tab === "diff" ? "bg-panel text-cyan shadow-sm" : "text-ink-muted hover:text-ink"} disabled:cursor-not-allowed disabled:opacity-40`}>Diff</button>
              </div>
              <button type="button" onClick={copySource} disabled={!source} className="inline-flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-void/65 p-3 sm:p-4">
              {busy ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-ink-muted"><Loader2 className="h-6 w-6 animate-spin text-cyan" /><span>Reading the verified file…</span></div>
              ) : failed ? (
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{artifact.message ?? "Nexo could not retrieve this file. No source is being shown."}</div>
              ) : source ? (
                <pre className="m-0 min-h-full whitespace-pre overflow-visible rounded-xl border border-edge bg-black/20 p-3 font-mono text-[11px] leading-5 text-ink sm:text-xs">{source}</pre>
              ) : (
                <div className="rounded-xl border border-edge bg-void/40 p-4 text-sm text-ink-muted">No source body is available for this action yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
