"use client";

import { Activity, AlertCircle, CheckCircle2, Clock3, FileSearch, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { FileAction, SearchingAction } from "@/lib/craftParser";

type ApprovalState = "pending" | "approving" | "approved" | "rejected" | "error";
type AttachmentState = "preparing" | "error" | null;

export function MissionControlHeader({
  streaming,
  actions,
  searching,
  attachmentState,
  approvalState,
  selectedModel,
  isCoderMode,
}: {
  streaming: boolean;
  actions: FileAction[];
  searching?: SearchingAction | null;
  attachmentState?: AttachmentState;
  approvalState?: ApprovalState | null;
  selectedModel: string;
  isCoderMode: boolean;
}) {
  const latestAction = actions[actions.length - 1];
  const needsAttention = attachmentState === "error" || approvalState === "error";
  const waitingForApproval = approvalState === "pending";
  const applyingApprovedChange = approvalState === "approving";

  let status = "Ready for your next task";
  let detail = "Send a request to begin. Progress appears only when the app reports real activity.";
  let StatusIcon = CheckCircle2;
  let statusTone = "text-emerald-300";
  let statusDot = "bg-emerald-400";

  if (needsAttention) {
    status = "Needs attention";
    detail = attachmentState === "error" ? "Attachment preparation reported an error." : "An approved repository action reported an error.";
    StatusIcon = AlertCircle;
    statusTone = "text-rose-300";
    statusDot = "bg-rose-400";
  } else if (waitingForApproval) {
    status = "Awaiting your approval";
    detail = "No proposed repository change is applied until you approve it.";
    StatusIcon = ShieldCheck;
    statusTone = "text-amber-200";
    statusDot = "bg-amber-300";
  } else if (applyingApprovedChange) {
    status = "Applying approved change";
    detail = "The approved repository action is in progress.";
    StatusIcon = LoaderCircle;
    statusTone = "text-cyan";
    statusDot = "bg-cyan";
  } else if (attachmentState === "preparing") {
    status = "Preparing attachments";
    detail = "The app is preparing the files attached to this request.";
    StatusIcon = LoaderCircle;
    statusTone = "text-cyan";
    statusDot = "bg-cyan";
  } else if (streaming && searching) {
    status = "Research in progress";
    detail = searching.queries.slice(0, 2).join(" · ") || "Search activity reported by the app.";
    StatusIcon = Search;
    statusTone = "text-cyan";
    statusDot = "bg-cyan";
  } else if (streaming && latestAction?.type === "reading") {
    status = "Repository activity reported";
    detail = latestAction.filePath;
    StatusIcon = FileSearch;
    statusTone = "text-cyan";
    statusDot = "bg-cyan";
  } else if (streaming) {
    status = "Generating response";
    detail = "The assistant response is still being generated.";
    StatusIcon = LoaderCircle;
    statusTone = "text-cyan";
    statusDot = "bg-cyan";
  } else if (approvalState === "approved") {
    status = "Approved action completed";
    detail = "The approval flow reports that the action completed.";
    StatusIcon = CheckCircle2;
    statusTone = "text-emerald-300";
    statusDot = "bg-emerald-400";
  } else if (approvalState === "rejected") {
    status = "Approval declined";
    detail = "No repository change was applied through this approval.";
    StatusIcon = ShieldCheck;
    statusTone = "text-ink-muted";
    statusDot = "bg-ink-faint";
  } else if (actions.length > 0 || searching) {
    status = "Latest response received";
    detail = "Activity details are available below in the task timeline.";
    StatusIcon = CheckCircle2;
    statusTone = "text-emerald-300";
    statusDot = "bg-emerald-400";
  }

  const activeSignals = Number(Boolean(searching)) + actions.length + Number(Boolean(attachmentState));
  const Icon = StatusIcon;

  return (
    <section aria-label="KYVORIX AI Mission Control" className="relative mx-3 mt-3 overflow-hidden rounded-2xl border border-cyan/20 bg-panel shadow-[0_0_28px_rgba(0,229,255,0.045)] sm:mx-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,229,255,0.07),transparent_52%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-edge/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan shadow-[0_0_18px_rgba(0,229,255,0.08)]">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-sm font-bold tracking-[0.16em] text-ink sm:text-base">KYVORIX AI</h1>
              <span className="rounded-full border border-cyan/20 bg-cyan/[0.07] px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-cyan">MISSION CONTROL</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">Task activity · execution status · results</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-edge bg-void/60 px-3 py-1.5">
          <span className={"h-1.5 w-1.5 rounded-full " + statusDot + (streaming || attachmentState === "preparing" || applyingApprovedChange ? " animate-pulse" : "")} />
          <span className="text-[10px] font-semibold text-ink-muted">{streaming ? "WORKING" : needsAttention ? "ATTENTION" : waitingForApproval ? "APPROVAL" : "STANDBY"}</span>
        </div>
      </div>

      <div className="relative grid gap-3 p-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.65fr)] sm:p-4">
        <div className="min-w-0 rounded-xl border border-edge/80 bg-void/55 p-3 sm:p-3.5">
          <div className="flex items-start gap-2.5">
            <div className={"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-raised " + statusTone}>
              <Icon className={"h-4 w-4" + (streaming || attachmentState === "preparing" || applyingApprovedChange ? " animate-spin" : "")} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-faint">Current task status</p>
              <p className={"mt-1 text-sm font-semibold " + statusTone}>{status}</p>
              <p className="mt-1 break-words text-[11px] leading-5 text-ink-muted">{detail}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-edge/80 bg-void/55 p-3">
            <div className="flex items-center gap-1.5 text-ink-faint">
              <Sparkles className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Active mode</span>
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-ink" title={isCoderMode ? "KYVORIX Coder" : selectedModel}>{isCoderMode ? "Coder Agent" : selectedModel}</p>
            <p className="mt-1 text-[10px] text-ink-muted">{isCoderMode ? "Code workspace" : "Chat model"}</p>
          </div>
          <div className="rounded-xl border border-edge/80 bg-void/55 p-3">
            <div className="flex items-center gap-1.5 text-ink-faint">
              <Clock3 className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Activity signals</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink">{activeSignals}</p>
            <p className="mt-1 text-[10px] text-ink-muted">Reported this turn</p>
          </div>
        </div>
      </div>
    </section>
  );
}
