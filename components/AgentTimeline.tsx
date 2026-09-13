"use client";

import { Check, Circle, FileSearch, FileUp, Loader2, Pencil, Search, ShieldCheck, Sparkles, XCircle, Clock3 } from "lucide-react";
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
  if (action.type === "reading") return "Inspecting project context";
  if (action.type === "editing") return "Preparing a change";
  if (action.type === "creating") return "Preparing a new file";
  return "Preparing a removal";
}

function approvalLabel(state: ApprovalState): TimelineItem {
  if (state === "approving") return { id: "approval", label: "Applying approved action", state: "active", icon: Loader2 };
  if (state === "approved") return { id: "approval", label: "Approved action completed", state: "complete", icon: ShieldCheck };
  if (state === "rejected") return { id: "approval", label: "Approval declined", state: "complete", icon: ShieldCheck };
  if (state === "error") return { id: "approval", label: "Approved action needs attention", state: "error", icon: XCircle };
  return { id: "approval", label: "Waiting for your approval", detail: "No change is applied until you approve it.", state: "waiting", icon: ShieldCheck };
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
    items.push({ id: "attachments", label: "Preparing attachment context", state: "active", icon: FileUp });
  } else if (attachmentState === "error") {
    items.push({ id: "attachments", label: "Attachment preparation needs attention", state: "error", icon: XCircle });
  }

  if (searching) {
    items.push({
      id: `search:${searching.queries.join(",")}`,
      label: "Researching context",
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
      detail: action.filePath,
      state: streaming && isLatest ? "active" : "complete",
      icon: action.type === "reading" ? FileSearch : Pencil,
    });
  });

  if (streaming && hasMeaningfulActivity) {
    items.push({ id: "response", label: "Drafting response", detail: "NEXO is combining the results", state: "active", icon: Sparkles });
  }

  if (approvalState) items.push(approvalLabel(approvalState));
  if (items.length === 0) return null;

  const activeItem = [...items].reverse().find((item) => item.state === "active");
  const completedCount = items.filter((item) => item.state === "complete").length;
  const hasError = items.some((item) => item.state === "error");

  return (
    <section
      className="mx-auto mb-2 w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-edge/80 bg-panel/95 shadow-[0_10px_35px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      aria-label="NEXO activity timeline"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-edge/70 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
            hasError ? "bg-rose-400/10 text-rose-300" : streaming ? "bg-cyan/10 text-cyan" : "bg-emerald-400/10 text-emerald-300"
          }`}>
            {hasError ? <XCircle className="h-3.5 w-3.5" /> : streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-ink">NEXO Activity</p>
            <p className="truncate text-[9px] text-ink-faint">
              {activeItem?.label ?? (hasError ? "Action needs attention" : "Task completed")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[9px] font-mono text-ink-faint">
          {completedCount > 0 && <span>{completedCount} done</span>}
          {streaming ? (
            <span className="flex items-center gap-1 text-cyan"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />LIVE</span>
          ) : (
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />LATEST</span>
          )}
        </div>
      </div>

      <ol className="space-y-0 px-3.5 py-2.5">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.state === "active";
          const isError = item.state === "error";
          const isWaiting = item.state === "waiting";
          const isLast = index === items.length - 1;

          return (
            <li key={item.id} className="relative flex min-w-0 gap-2.5 py-1.5">
              {!isLast && <span className="absolute left-[10px] top-7 h-[calc(100%-7px)] w-px bg-edge/80" aria-hidden="true" />}
              <span className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                isActive ? "border-cyan/40 bg-cyan/10 text-cyan" : isError ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : isWaiting ? "border-amber-300/40 bg-amber-300/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              }`}>
                {isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : isError ? <XCircle className="h-3 w-3" /> : isWaiting ? <Circle className="h-2.5 w-2.5" /> : <Check className="h-3 w-3" />}
              </span>

              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-center gap-2">
                  <p className={`truncate text-[11px] font-semibold ${isError ? "text-rose-200" : isWaiting ? "text-amber-200" : "text-ink"}`}>{item.label}</p>
                  {isActive && <span className="shrink-0 rounded-full bg-cyan/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan">active</span>}
                </div>
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
