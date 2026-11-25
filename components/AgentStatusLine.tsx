"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ActionEvent } from "@/lib/actionEngine";
import { getActionStatusLabel, getToolCallLabel, getVerificationLabel, latestActionEvents } from "@/lib/toolCallDisplay";

export function AgentStatusLine({ streaming, events }: { streaming: boolean; events: ActionEvent[] }) {
  const latest = latestActionEvents(events);
  const current = latest[latest.length - 1];
  if (!streaming && !current) return null;

  const failed = current?.phase === "failed" || current?.phase === "cancelled";
  const working = streaming && !failed && current?.phase !== "succeeded";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-2xl items-center gap-2 rounded-xl border border-cyan/15 bg-panel/80 px-3 py-2 text-xs text-ink-muted"
    >
      {failed ? (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
      ) : working ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
      )}
      <span className="min-w-0 truncate">
        {current ? `${getToolCallLabel(current.operation)} · ${getActionStatusLabel(current.phase)}` : "Preparing the next step"}
      </span>
      {current && (
        <span className="ml-auto shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] text-ink-faint">
          {getVerificationLabel(current.verification)}
        </span>
      )}
    </div>
  );
}
