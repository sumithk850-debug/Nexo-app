import { useState } from "react";
import { Check, Database, Loader2, ShieldCheck, X } from "lucide-react";
import type { SupabaseTask } from "@/lib/supabaseTaskParser";

const OPERATION_LABELS: Record<SupabaseTask["operation"], string> = {
  inspect: "Inspecting schema",
  query: "Querying data",
  create_table: "Creating table",
  alter_table: "Altering table",
  insert: "Inserting rows",
  update: "Updating rows",
  delete: "Deleting rows",
  sql: "Preparing SQL",
};

export function SupabaseTaskCard({
  task,
  streaming = false,
  userId,
  onApprove,
}: {
  task: SupabaseTask;
  streaming?: boolean;
  userId?: string;
  onApprove?: (task: SupabaseTask) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [approvalState, setApprovalState] = useState<"idle" | "busy" | "success" | "error">("idle");
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const isReadOnly = task.operation === "inspect" || task.operation === "query";
  const hasVerifiedProject = Boolean(task.projectId && !["unknown", "null", "n/a"].includes(task.projectId.toLowerCase()));
  const canApprove = Boolean(userId && hasVerifiedProject && task.sql && onApprove);
  const label = OPERATION_LABELS[task.operation];

  async function approve() {
    if (!onApprove || !canApprove) return;
    setApprovalState("busy");
    setApprovalMessage(null);
    const result = await onApprove(task);
    setApprovalState(result.ok ? "success" : "error");
    setApprovalMessage(result.message ?? null);
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-emerald-400/25 bg-emerald-950/20 shadow-sm">
      <div className="flex items-center gap-2 border-b border-emerald-400/15 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
          {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" aria-label="Supabase" />}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Supabase</span>
        <span className="ml-auto text-[10px] font-mono text-ink-faint">{task.operation}</span>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-ink">
          {streaming ? <Loader2 className="h-3 w-3 animate-spin text-emerald-300" /> : <Check className="h-3 w-3 text-emerald-300" />}
          <span className="font-semibold">{streaming ? label : isReadOnly ? `${label} read plan` : `${label} approval required`}</span>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
          <span className="truncate text-ink-muted">Project: <strong className="font-mono text-ink">{task.projectId ?? "Not selected"}</strong></span>
          <span className="truncate text-ink-muted">Table: <strong className="font-mono text-ink">{task.table ?? "SQL target"}</strong></span>
        </div>
        {!isReadOnly && approvalState === "idle" && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Nothing is written until you approve this SQL.</span>
          </div>
        )}
        {onApprove && !streaming && !isReadOnly && approvalState === "idle" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!canApprove}
              onClick={approve}
              className="rounded-md bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Approve Supabase change
            </button>
            {!canApprove && <span className="text-[10px] text-ink-faint">Connect Supabase and select a verified project first.</span>}
          </div>
        )}
        {approvalState === "busy" && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-200"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing approved Supabase task…</div>
        )}
        {approvalState === "success" && (
          <div className="flex items-start gap-2 rounded-md bg-emerald-400/10 px-2 py-1.5 text-[11px] text-emerald-200"><Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /><span>{approvalMessage ?? "Supabase task completed and verified."}</span></div>
        )}
        {approvalState === "error" && (
          <div className="flex items-start gap-2 rounded-md bg-rose-400/10 px-2 py-1.5 text-[11px] text-rose-200"><X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /><span>{approvalMessage ?? "Supabase task failed; no success is reported."}</span></div>
        )}
      </div>
    </div>
  );
}
