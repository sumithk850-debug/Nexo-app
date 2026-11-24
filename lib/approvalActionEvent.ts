import { createActionEvent, type ActionEvent, type ActionPhase } from "@/lib/actionEngine";

const PHASE_BY_STATUS: Record<string, ActionPhase | undefined> = {
  pending: "needs_approval",
  approving: "running",
  approved: "succeeded",
  rejected: "cancelled",
  error: "failed",
};

const SUMMARY_BY_PHASE: Partial<Record<ActionPhase, string>> = {
  needs_approval: "Waiting for your approval before anything is committed.",
  running: "Committing the approved changes.",
  succeeded: "Commit confirmed by the server.",
  cancelled: "Changes rejected. Nothing was committed.",
  failed: "Commit failed. The approval card shows the reason.",
};

// Maps the commit approval card state into the same action-event shape the
// timeline and status line already render, so write actions appear in one place.
export function approvalActionEvent(status: string | null, changeCount: number): ActionEvent | null {
  const phase = status ? PHASE_BY_STATUS[status] : undefined;
  if (!phase) return null;
  const event = createActionEvent(
    {
      id: "repo-approval",
      provider: "github",
      operation: "commit approval",
      target: changeCount + " repository change(s)",
      summary: SUMMARY_BY_PHASE[phase] ?? "Repository change update.",
    },
    phase
  );
  return { ...event, verification: phase === "succeeded" ? "result_checked" : "none" };
}
