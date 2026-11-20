"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronUp,
  Circle,
  FilePlus2,
  FileSearch,
  Github,
  GripHorizontal,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { ActionEvent } from "@/lib/actionEngine";
import type { FileAction, SearchingAction } from "@/lib/craftParser";

type ApprovalState = "pending" | "approving" | "approved" | "rejected" | "error";
type AttachmentState = "preparing" | "error" | null;
type PhaseState = "waiting" | "active" | "complete" | "error";
type Phase = { id: string; label: string; detail: string; state: PhaseState };

function actionDescription(action: FileAction): string {
  if (action.type === "reading") return "Reading verified repository context";
  if (action.type === "editing") return "Preparing targeted edit";
  if (action.type === "creating") return "Preparing new file";
  return "Preparing file removal";
}

function phaseIcon(state: PhaseState) {
  if (state === "active") return Loader2;
  if (state === "error") return AlertTriangle;
  if (state === "complete") return CheckCircle2;
  return Circle;
}

function phaseClass(state: PhaseState): string {
  if (state === "active") return "border-cyan/40 bg-cyan/10 text-cyan";
  if (state === "error") return "border-rose-400/40 bg-rose-400/10 text-rose-300";
  if (state === "complete") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  return "border-amber-300/30 bg-amber-300/10 text-amber-300";
}

function phases({
  streaming,
  hasExecution,
  hasVerification,
  hasError,
}: {
  streaming: boolean;
  hasExecution: boolean;
  hasVerification: boolean;
  hasError: boolean;
}): Phase[] {
  return [
    { id: "understand", label: "Understand", detail: "Identify the goal and affected surface.", state: "complete" },
    { id: "plan", label: "Plan", detail: streaming && !hasExecution ? "Preparing the next safe step." : "Plan established for this response.", state: streaming && !hasExecution ? "active" : "complete" },
    { id: "work", label: "Work", detail: hasExecution ? "Following the live activity reported by Kyvorix." : "Preparing the response.", state: hasError ? "error" : hasExecution ? (streaming ? "active" : "complete") : streaming ? "waiting" : "complete" },
    { id: "verify", label: "Verify", detail: hasVerification ? "Provider or application evidence is available." : "Waiting for available evidence.", state: hasError ? "error" : !streaming ? "complete" : hasVerification ? "active" : "waiting" },
    { id: "deliver", label: "Deliver", detail: streaming ? "Keeping the response and live status synchronized." : "The current response is ready to review.", state: streaming ? "waiting" : "complete" },
  ];
}

export function RealityDrawer({
  streaming,
  actions,
  searching,
  attachmentState,
  approvalState,
  modelLabel,
  actionEvents,
  repoFullName,
  charsPerSecond,
}: {
  streaming: boolean;
  actions: FileAction[];
  searching?: SearchingAction | null;
  attachmentState?: AttachmentState;
  approvalState?: ApprovalState | null;
  modelLabel: string;
  actionEvents: ActionEvent[];
  repoFullName?: string | null;
  charsPerSecond?: number;
}) {
  const [open, setOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const hasExecution = Boolean(attachmentState || searching || actions.length > 0 || actionEvents.length > 0 || approvalState);

  const hasVerification = actionEvents.some((event) => event.verification !== "none" || event.phase === "succeeded") || approvalState === "approved";
  const hasError = attachmentState === "error" || approvalState === "error" || actionEvents.some((event) => event.phase === "failed" || event.phase === "cancelled");
  const track = phases({ streaming, hasExecution, hasVerification, hasError });
  const activeAction = actions[actions.length - 1];
  const currentLabel = approvalState === "pending"
    ? "Waiting for your approval"
    : approvalState === "approving"
      ? "Applying approved repository change"
      : searching
        ? (streaming ? "Gathering research context" : "Research context gathered")
        : attachmentState === "preparing"
          ? "Preparing attached context"
          : activeAction
            ? actionDescription(activeAction)
            : hasError
              ? "Action needs attention"
              : streaming
                ? "Preparing the next step"
                : "Execution complete";
  const statusLabel = hasError ? "needs attention" : streaming ? "working" : "ready";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!hasExecution && !streaming) return null;

  function closeFromSwipe(event: TouchEvent<HTMLDivElement>) {
    if (touchStartY.current === null) return;
    if (event.changedTouches[0].clientY - touchStartY.current > 70) setOpen(false);
    touchStartY.current = null;
  }

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="kyvorix-reality-drawer"
        className="mx-4 mb-2 flex min-h-11 w-[calc(100%-2rem)] items-center gap-2.5 rounded-xl border border-cyan/25 bg-panel px-3 py-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition active:scale-[.99]"
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${hasError ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : streaming ? "border-cyan/35 bg-cyan/10 text-cyan" : "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"}`}>
          {hasError ? <AlertTriangle className="h-3.5 w-3.5" /> : streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-bold text-ink">{modelLabel}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${hasError ? "bg-rose-400/10 text-rose-300" : streaming ? "bg-cyan/10 text-cyan" : "bg-emerald-400/10 text-emerald-300"}`}>{statusLabel}</span>
          </span>
          <span className="mt-0.5 block truncate text-[9px] text-ink-faint">{currentLabel}</span>
        </span>
        <ChevronUp className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] sm:hidden" role="presentation">
          <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Close Reality Drawer" onClick={() => setOpen(false)} />
          <div
            id="kyvorix-reality-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reality-drawer-title"
            className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[1.5rem] border-t border-cyan/30 bg-panel text-ink shadow-[0_-18px_60px_rgba(0,0,0,0.35)]"
            onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; }}
            onTouchEnd={closeFromSwipe}
          >
            <div className="flex justify-center pb-1 pt-2"><GripHorizontal className="h-5 w-5 text-ink-faint" aria-hidden="true" /></div>
            <div className="flex items-start justify-between gap-3 border-b border-edge/70 px-4 pb-3 pt-1">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan">Reality Engine</p>
                <h2 id="reality-drawer-title" className="mt-1 truncate text-base font-bold">{modelLabel} · {statusLabel}</h2>
                <p className="mt-1 truncate text-[10px] text-ink-muted">See what AI sees. Prove what AI does.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge text-ink-muted" aria-label="Close Reality Drawer"><X className="h-4 w-4" /></button>
            </div>

            <div className="max-h-[calc(82dvh-116px)] space-y-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <section aria-labelledby="reality-current-task">
                <div className="flex items-center justify-between gap-2"><h3 id="reality-current-task" className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Current task</h3>{charsPerSecond !== undefined && charsPerSecond > 0 && <span className="font-mono text-[9px] text-cyan">{Math.round(charsPerSecond)} chars/s</span>}</div>
                <div className="mt-2 rounded-xl border border-cyan/20 bg-cyan/[0.05] p-3"><p className="text-sm font-semibold text-ink">{currentLabel}</p>{activeAction?.filePath && <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{activeAction.filePath}</p>}{searching && <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{searching.queries.join(" · ")}</p>}</div>
              </section>

              <section aria-labelledby="reality-track-title"><h3 id="reality-track-title" className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Execution track</h3><ol className="mt-2 space-y-1.5">{track.map((phase, index) => { const Icon = phaseIcon(phase.state); return <li key={phase.id} className="flex items-start gap-2.5"><span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${phaseClass(phase.state)}`}>{phase.state === "active" ? <Icon className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{index < track.length - 1 && <span className="absolute left-1/2 top-7 h-3 w-px bg-edge" />}</span><span className="min-w-0 flex-1 pb-2"><span className="flex items-center gap-2"><span className="text-xs font-semibold text-ink">{phase.label}</span><span className="text-[9px] uppercase tracking-wider text-ink-faint">{phase.state}</span></span><span className="mt-0.5 block text-[10px] leading-4 text-ink-muted">{phase.detail}</span></span></li>; })}</ol></section>

              {actions.length > 0 && <section aria-labelledby="reality-activity-title"><h3 id="reality-activity-title" className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Live activity</h3><div className="mt-2 space-y-1.5">{actions.slice(-5).map((action, index) => { const Icon = action.type === "reading" ? FileSearch : action.type === "creating" ? FilePlus2 : action.type === "deleting" ? Trash2 : Pencil; const active = streaming && index === Math.min(actions.length, 5) - 1; return <div key={`${action.type}-${action.filePath}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-edge bg-void/30 px-2.5 py-2"><Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-cyan" : "text-ink-muted"}`} /><span className={`shrink-0 text-[10px] font-semibold ${active ? "text-cyan" : "text-ink-muted"}`}>{active ? "Active" : "Done"}</span><span className="min-w-0 truncate font-mono text-[10px] text-ink" title={action.filePath}>{action.filePath}</span></div>; })}</div></section>}

              {actionEvents.length > 0 && <section aria-labelledby="reality-verification-title"><h3 id="reality-verification-title" className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Verified activity</h3><div className="mt-2 space-y-1.5">{actionEvents.slice(-5).map((event) => <div key={event.id} className="flex min-w-0 items-start gap-2 rounded-lg border border-edge bg-void/30 px-2.5 py-2 text-[10px]"><ShieldCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${event.phase === "succeeded" ? "text-emerald-400" : event.phase === "failed" || event.phase === "cancelled" ? "text-rose-400" : "text-cyan"}`} /><span className="min-w-0"><span className="block font-semibold text-ink-muted">{event.provider} · {event.operation.replace(/_/g, " ")}</span><span className="mt-0.5 block truncate text-ink-faint">{event.summary}</span></span></div>)}</div></section>}

              {approvalState && <section aria-labelledby="reality-approval-title"><h3 id="reality-approval-title" className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Approval status</h3><div className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${approvalState === "error" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : approvalState === "approved" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}><ShieldCheck className="h-4 w-4 shrink-0" /><span>{approvalState === "pending" ? "Approval required — no repository change has been applied yet." : approvalState === "approving" ? "Applying the approved repository change." : approvalState === "approved" ? "Approved change completed." : approvalState === "rejected" ? "Approval declined — no change applied." : "Approved action needs attention."}</span></div></section>}

              {repoFullName && <div className="flex items-center gap-2 border-t border-edge/60 pt-3 text-[10px] text-ink-faint"><Github className="h-3.5 w-3.5" /><span className="truncate font-mono">{repoFullName}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
