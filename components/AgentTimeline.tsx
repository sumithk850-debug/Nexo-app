"use client";

import { Check, Circle, FileSearch, FileUp, GitPullRequest, Loader2, Pencil, Search, ShieldCheck, Sparkles, XCircle } from "lucide-react";
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

  actions.slice(-4).forEach((action, index) => {
    const isLatest = index === Math.min(actions.length, 4) - 1;
    items.push({
      id: `${action.type}:${action.filePath}:${index}`,
      label: actionLabel(action),
      detail: action.filePath,
      state: streaming && isLatest ? "active" : "complete",
      icon: action.type === "reading" ? FileSearch : Pencil,
    });
  });

  // Plain chat generation already has its own Generating response status card.
  // Keep this richer timeline for requests with observable work to report.
  if (streaming && hasMeaningfulActivity) {
    items.push({ id: "response", label: "Drafting response", state: "active", icon: Sparkles });
  }

  if (approvalState) items.push(approvalLabel(approvalState));
  if (items.length === 0) return null;

  return (
    <section className="mx-auto mb-2 w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border border-edge bg-panel/90 shadow-sm" aria-label="Agent activity timeline">
      <div className="flex items-center justify-between border-b border-edge/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan/10 text-cyan">
            <Sparkles className="h-3 w-3" />
          </span>
          <p className="text-xs font-semibold text-ink">Agent timeline</p>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">{streaming ? "LIVE" : "LATEST"}</span>
      </div>
      <ol className="space-y-0 px-3 py-2">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.state === "active";
          const isError = item.state === "error";
          const isWaiting = item.state === "waiting";
          return (
            <li key={item.id} className="relative flex min-w-0 gap-2.5 py-1.5">
              {index < items.length - 1 && <span className="absolute left-[9px] top-6 h-[calc(100%-8px)] w-px bg-edge" aria-hidden="true" />}
              <span className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border ${
                isActive ? "border-cyan/40 bg-cyan/10 text-cyan" : isError ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : isWaiting ? "border-amber-300/40 bg-amber-300/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              }`}>
                {isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : isError ? <XCircle className="h-3 w-3" /> : isWaiting ? <Circle className="h-2.5 w-2.5" /> : <Check className="h-3 w-3" />}
              </span>
              <div className="min-w-0 pb-0.5">
                <p className={`truncate text-xs font-medium ${isError ? "text-rose-200" : isWaiting ? "text-amber-200" : "text-ink"}`}>{item.label}</p>
                {item.detail && <p className="truncate font-mono text-[10px] text-ink-faint" title={item.detail}>{item.detail}</p>}
              </div>
              <Icon className={`ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 ${isActive ? "text-cyan" : "text-ink-faint"}`} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
