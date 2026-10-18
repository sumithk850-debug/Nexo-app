"use client";

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
} from "lucide-react";
import type { FileAction, SearchingAction } from "@/lib/craftParser";

type ApprovalState = "pending" | "approving" | "approved" | "rejected" | "error";
type AttachmentState = "preparing" | "error" | null;

type TimelineItem = {
  id: string;
  label: string;
  detail?: string;
  state: "active" | "complete" | "waiting" | "error";
  icon: typeof Search;
};

function actionLabel(action: FileAction): string {
  if (action.type === "reading") return "Repository analyst reading source";
  if (action.type === "editing") return "Change planner preparing edit";
  if (action.type === "creating") return "Builder preparing new file";
  return "Change planner preparing removal";
}

function approvalLabel(state: ApprovalState): TimelineItem {
  if (state === "approving") return { id: "approval", label: "Applying approved repository change", state: "active", icon: Loader2 };
  if (state === "approved") return { id: "approval", label: "Approved change completed", state: "complete", icon: ShieldCheck };
  if (state === "rejected") return { id: "approval", label: "Approval declined", state: "complete", icon: ShieldCheck };
  if (state === "error") return { id: "approval", label: "Approved action needs attention", state: "error", icon: XCircle };
  return { id: "approval", label: "Waiting for your approval", detail: "No repository change is applied until you approve it.", state: "waiting", icon: ShieldCheck };
}

export function AgentTimeline({
  streaming,
  actions,
  searching,
  attachmentState,
  approvalState,
}: {
  streaming: boolean;
  actions: FileAction[];
  searching?: SearchingAction | null;
  attachmentState?: AttachmentState;
  approvalState?: ApprovalState | null;
}) {
  const items: TimelineItem[] = [];
  const hasMeaningfulActivity = Boolean(attachmentState || searching || actions.length > 0 || approvalState);

  if (attachmentState === "preparing") {
    items.push({ id: "attachments", label: "Context agent preparing attachments", state: "active", icon: FileUp });
  } else if (attachmentState === "error") {
    items.push({ id: "attachments", label: "Attachment context needs attention", state: "error", icon: XCircle });
  }

  if (searching) {
    items.push({
      id: `search:${searching.queries.join(",")}`,
      label: "Research agent gathering context",
      detail: searching.queries.slice(0, 2).join(" · "),
      state: streaming ? "active" : "complete",
      icon: Search,
    });
  }

  actions.slice(-4).forEach((action, index, visibleActions) => {
    const isLatest = index === visibleActions.length - 1;
    items.push({
      id: `${action.type}:${action.filePath}:${index}`,
      label: actionLabel(action),
      detail: action.linesChanged !== undefined
        ? `${action.filePath} · ${action.linesChanged} changed lines`
        : action.filePath,
      state: streaming && isLatest ? "active" : "complete",
      icon: action.type === "reading" ? FileSearch : Pencil,
    });
  });

  if (streaming && hasMeaningfulActivity) {
    items.push({ id: "response", label: "Synthesis agent drafting response", detail: "Combining verified results", state: "active", icon: Sparkles });
  }

  if (approvalState) items.push(approvalLabel(approvalState));
  if (items.length === 0) return null;

  const activeItem = [...items].reverse().find((item) => item.state === "active");
  const completedCount = items.filter((item) => item.state === "complete").length;
  const hasError = items.some((item) => item.state === "error");
  const progress = Math.min(100, Math.round((completedCount / Math.max(items.length, 1)) * 100));
  const agentCount = Math.min(3, 1 + Number(Boolean(searching)) + Number(actions.length > 0));

  return (
    <section
      className="mx-auto mb-3 w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-[1.35rem] border border-cyan/20 bg-panel/95 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-xl"
      aria-label="KYVORIX agent execution timeline"
      aria-live="polite"
    >
      <div className="relative overflow-hidden border-b border-edge/70 bg-gradient-to-br from-cyan/[0.08] via-panel to-indigo/[0.07] px-4 pb-3 pt-3.5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${hasError ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : streaming ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
              {hasError ? <XCircle className="h-4 w-4" /> : streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[12px] font-bold tracking-wide text-ink">Agent workspace</p>
                <span className="rounded-full border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-cyan">orchestrated</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-ink-faint">{activeItem?.label ?? (hasError ? "Action needs attention" : "Execution complete")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[9px] font-mono text-ink-faint">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{agentCount} agents</span>
            {streaming ? <span className="flex items-center gap-1 text-cyan"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />LIVE</span> : <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />LATEST</span>}
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-edge/70"><div className={`h-full rounded-full transition-all duration-500 ${hasError ? "bg-rose-400" : streaming ? "bg-cyan" : "bg-emerald-400"}`} style={{ width: `${streaming ? Math.max(progress, 18) : 100}%` }} /></div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-ink-faint"><span>{completedCount} completed steps</span><span>{streaming ? "Executing" : "Verified"}</span></div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-edge/60 px-4 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan/15 bg-cyan/[0.06] px-2 py-1 text-[9px] font-semibold text-cyan"><GitBranch className="h-3 w-3" />Repository agent</span>
        {searching && <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-2 py-1 text-[9px] font-semibold text-violet-300"><Search className="h-3 w-3" />Research agent</span>}
        {actions.length > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-1 text-[9px] font-semibold text-amber-200"><Pencil className="h-3 w-3" />Change planner</span>}
      </div>

      <ol className="space-y-0 px-4 py-2.5">
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
    </section>
  );
}
