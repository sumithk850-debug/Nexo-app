"use client";

import { useState } from "react";

import {
  Check,
  Circle,
  Clock3,
  FileSearch,
  FileUp,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  GitBranch,
  Menu,
  X,
} from "lucide-react";
import type { ActionEvent } from "@/lib/actionEngine";
import { getActionStatusLabel, getToolCallLabel, latestActionEvents } from "@/lib/toolCallDisplay";
import type { FileAction, SearchingAction } from "@/lib/craftParser";

type ApprovalState = "pending" | "approving" | "approved" | "rejected" | "error";
type AttachmentState = "preparing" | "error" | null;
type StepState = "active" | "complete" | "waiting" | "error";

type WebResearchProgress = { stage: string; message: string; url?: string; completedPages?: number; totalPages?: number } | null;

type TimelineItem = {
  id: string;
  label: string;
  detail?: string;
  state: StepState;
  icon: typeof Search;
};

function actionLabel(action: FileAction): string {
  if (action.type === "reading") return "Reading verified repository context";
  if (action.type === "editing") return "Preparing targeted edit";
  if (action.type === "creating") return "Preparing new file";
  return "Preparing file removal";
}

function approvalLabel(state: ApprovalState): TimelineItem {
  if (state === "approving") return { id: "approval", label: "Applying approved repository change", state: "active", icon: Loader2 };
  if (state === "approved") return { id: "approval", label: "Approved change completed", state: "complete", icon: ShieldCheck };
  if (state === "rejected") return { id: "approval", label: "Approval declined — no change applied", state: "complete", icon: ShieldCheck };
  if (state === "error") return { id: "approval", label: "Approved action needs attention", state: "error", icon: XCircle };
  return { id: "approval", label: "Waiting for your approval", detail: "No repository change is applied until you approve it.", state: "waiting", icon: ShieldCheck };
}

function phaseState(streaming: boolean, hasExecution: boolean, hasVerification: boolean): TimelineItem[] {
  const planning = streaming && !hasExecution;
  const executing = streaming && hasExecution;
  const finished = !streaming;
  return [
    {
      id: "understand",
      label: "Understand the request",
      detail: "Identifying the goal, constraints, and affected surface.",
      state: planning ? "complete" : streaming ? "complete" : "complete",
      icon: Sparkles,
    },
    {
      id: "plan",
      label: "Plan the next steps",
      detail: planning ? "Preparing a concise plan before taking action." : "Plan established for this response.",
      state: planning ? "active" : "complete",
      icon: FileSearch,
    },
    {
      id: "execute",
      label: hasExecution ? "Execute the reported work" : "Compose the response",
      detail: hasExecution ? "Following the verified activity reported by the app." : "Generating the answer for this request.",
      state: executing ? "active" : finished ? "complete" : "waiting",
      icon: hasExecution ? GitBranch : Pencil,
    },
    {
      id: "verify",
      label: "Check the available result",
      detail: hasVerification ? "Provider or application evidence is available." : "Separating reported results from unverified claims.",
      state: streaming ? (hasVerification ? "active" : "waiting") : "complete",
      icon: ShieldCheck,
    },
    {
      id: "deliver",
      label: finished ? "Deliver the result" : "Prepare the result",
      detail: finished ? "The current response is ready to review." : "Keeping the response and live status synchronized.",
      state: finished ? "complete" : "waiting",
      icon: Check,
    },
  ];
}

export function AgentTimeline({
  streaming,
  actions,
  searching,
  attachmentState,
  approvalState,
  modelLabel = "KYVORIX AI",
  actionEvents = [],
  researchProgress = null,
}: {
  streaming: boolean;
  actions: FileAction[];
  searching?: SearchingAction | null;
  attachmentState?: AttachmentState;
  approvalState?: ApprovalState | null;
  modelLabel?: string;
  actionEvents?: ActionEvent[];
  researchProgress?: WebResearchProgress;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const hasExecution = Boolean(attachmentState || searching || researchProgress || actions.length > 0 || actionEvents.length > 0 || approvalState);
  if (!hasExecution && !streaming) return null;

  const hasVerification = actionEvents.some((event) => event.verification !== "none" || event.phase === "succeeded") || Boolean(approvalState === "approved");
  const latestToolEvents = latestActionEvents(actionEvents);
  const items: TimelineItem[] = phaseState(streaming, hasExecution, hasVerification);

  if (attachmentState === "preparing") {
    items.splice(2, 0, { id: "attachments", label: "Prepare attached context", detail: "Reading the files supplied for this request.", state: "active", icon: FileUp });
  } else if (attachmentState === "error") {
    items.splice(2, 0, { id: "attachments", label: "Attachment context needs attention", state: "error", icon: XCircle });
  }

  if (searching) {
    items.splice(2, 0, {
      id: `search:${searching.queries.join(",")}`,
      label: streaming ? "Gathering research context" : "Research context gathered",
      detail: searching.queries.slice(0, 2).join(" · "),
      state: streaming ? "active" : "complete",
      icon: Search,
    });
  }

  if (researchProgress) {
    const done = researchProgress.stage === "completed";
    const failed = researchProgress.stage === "failed";
    items.splice(2, 0, {
      id: "web-research-progress",
      label: researchProgress.message,
      detail: [researchProgress.url, researchProgress.completedPages !== undefined ? `${researchProgress.completedPages}/${researchProgress.totalPages ?? "?"} pages` : ""].filter(Boolean).join(" · "),
      state: failed ? "error" : done ? "complete" : "active",
      icon: Search,
    });
  }

  actions.slice(-4).forEach((action, index, visibleActions) => {
    const isLatest = index === visibleActions.length - 1;
    items.splice(2 + index, 0, {
      id: `${action.type}:${action.filePath}:${index}`,
      label: actionLabel(action),
      detail: action.linesChanged !== undefined ? `${action.filePath} · ${action.linesChanged} changed lines` : action.filePath,
      state: streaming && isLatest ? "active" : "complete",
      icon: action.type === "reading" ? FileSearch : Pencil,
    });
  });

  if (approvalState) items.push(approvalLabel(approvalState));

  const activeItem = [...items].reverse().find((item) => item.state === "active");
  const completedCount = items.filter((item) => item.state === "complete").length;
  const hasError = items.some((item) => item.state === "error");
  const progress = Math.min(100, Math.round((completedCount / Math.max(items.length, 1)) * 100));
  const agentCount = Math.min(3, 1 + Number(Boolean(searching)) + Number(actions.length > 0));
  const activeTool = latestToolEvents.find((event) => event.phase === "running" || event.phase === "verifying");
  const currentLabel = researchProgress?.message ?? (activeTool ? `${getToolCallLabel(activeTool.operation)} · ${getActionStatusLabel(activeTool.phase)}` : activeItem?.label) ?? (hasError ? "Action needs attention" : streaming ? "Preparing the next step" : "Execution complete");

  return (
    <section className="mx-auto mb-3 hidden w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-[1.35rem] border border-cyan/20 bg-panel/95 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:block" aria-label={`${modelLabel} execution dashboard`} aria-live="polite">
      <button
        type="button"
        onClick={() => setMobileExpanded((expanded) => !expanded)}
        aria-expanded={mobileExpanded}
        aria-controls="mobile-execution-details"
        className="relative z-10 flex w-full items-center justify-between gap-3 border-b border-cyan/15 bg-cyan/[0.03] px-3 py-2.5 text-left sm:hidden"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${hasError ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : streaming ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
            {hasError ? <XCircle className="h-3.5 w-3.5" /> : streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-bold text-ink">{modelLabel}</span>
              <span className="rounded-full border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan">{streaming ? "working" : "ready"}</span>
            </span>
            <span className="mt-0.5 block truncate text-[9px] text-ink-faint">{currentLabel}</span>
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(0,229,255,0.12)]" aria-hidden="true">
          {mobileExpanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </span>
      </button>

      <div className="relative hidden overflow-hidden border-b border-edge/70 bg-gradient-to-br from-cyan/[0.08] via-panel to-indigo/[0.07] px-4 pb-3 pt-3.5 sm:block">
        <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${hasError ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : streaming ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
              {hasError ? <XCircle className="h-4 w-4" /> : streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[12px] font-bold tracking-wide text-ink">{modelLabel} workspace</p>
                <span className="rounded-full border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-cyan">live plan</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-ink-faint">{currentLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[9px] font-mono text-ink-faint">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{agentCount} signals</span>
            {streaming ? <span className="flex items-center gap-1 text-cyan"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />LIVE</span> : <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />READY</span>}
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-edge/70"><div className={`h-full rounded-full transition-all duration-500 ${hasError ? "bg-rose-400" : streaming ? "bg-cyan" : "bg-emerald-400"}`} style={{ width: `${streaming ? Math.max(progress, 14) : 100}%` }} /></div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-ink-faint"><span>{completedCount} completed steps</span><span>{streaming ? "Working" : hasError ? "Needs attention" : "Ready"}</span></div>
      </div>

      <div id="mobile-execution-details" className={`${mobileExpanded ? "block" : "hidden"} border-b border-edge/60 px-4 py-2.5 sm:block`}>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Execution plan</p>
        <p className="mt-1 text-[11px] leading-5 text-ink-muted">Understand the request → plan the approach → perform only reported work → check available evidence → deliver the result.</p>
      </div>

      <ol className={`${mobileExpanded ? "block" : "hidden"} space-y-0 px-4 py-2.5 sm:block`}>
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.state === "active";
          const isError = item.state === "error";
          const isWaiting = item.state === "waiting";
          const isLast = index === items.length - 1;
          return (
            <li key={item.id} className="relative flex min-w-0 gap-2.5 py-1.5">
              {!isLast && <span className="absolute left-[10px] top-7 h-[calc(100%-7px)] w-px bg-edge/80" aria-hidden="true" />}
              <span className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isActive ? "border-cyan/40 bg-cyan/10 text-cyan" : isError ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : isWaiting ? "border-amber-300/40 bg-amber-300/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
                {isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : isError ? <XCircle className="h-3 w-3" /> : isWaiting ? <Circle className="h-2.5 w-2.5" /> : <Check className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-center gap-2"><p className={`truncate text-[11px] font-semibold ${isError ? "text-rose-200" : isWaiting ? "text-amber-200" : "text-ink"}`}>{item.label}</p>{isActive && <span className="shrink-0 rounded-full bg-cyan/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan">active</span>}</div>
                {item.detail && <p className="mt-0.5 truncate font-mono text-[9px] text-ink-faint" title={item.detail}>{item.detail}</p>}
              </div>
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isActive ? "text-cyan" : isError ? "text-rose-300" : "text-ink-faint"}`} />
            </li>
          );
        })}
      </ol>

      {actionEvents.length > 0 && (
        <div className={`${mobileExpanded ? "block" : "hidden"} border-t border-edge/60 px-4 py-2.5 sm:block`}>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">Verified activity</p>
          <div className="mt-2 space-y-1.5">
            {latestToolEvents.slice(-4).map((event) => (
              <div key={event.id} className="flex min-w-0 items-center gap-2 text-[10px]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.phase === "succeeded" ? "bg-emerald-400" : event.phase === "failed" || event.phase === "cancelled" ? "bg-rose-400" : "bg-cyan"}`} />
                <span className="shrink-0 font-semibold text-ink-muted">{getToolCallLabel(event.operation)}</span>
                <span className="shrink-0 uppercase tracking-wide text-cyan/80">{getActionStatusLabel(event.phase)}</span>
                <span className="truncate text-ink-faint">{event.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
