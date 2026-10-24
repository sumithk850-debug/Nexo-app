/**
 * Central verified-action contract for every KYVORIX tool integration.
 * This module is deliberately UI/provider agnostic so model and tool adapters
 * can share the same lifecycle and verification rules.
 */
export type ActionProvider = "github" | "supabase" | "vercel" | "browser" | "research" | "wikipedia" | "custom";
export type ActionPhase = "queued" | "running" | "verifying" | "succeeded" | "failed" | "needs_approval" | "needs_connection" | "cancelled";
export type VerificationLevel = "none" | "provider_acknowledged" | "result_checked";

export interface ActionEvent {
  id: string;
  actionId: string;
  provider: ActionProvider;
  operation: string;
  phase: ActionPhase;
  target: string;
  summary: string;
  verification: VerificationLevel;
  createdAt: number;
  correlationId?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface ActionStart {
  id: string;
  provider: ActionProvider;
  operation: string;
  target: string;
  summary?: string;
  correlationId?: string;
}

export interface ActionOutcome {
  phase: Extract<ActionPhase, "succeeded" | "failed" | "needs_approval" | "needs_connection" | "cancelled">;
  summary: string;
  verification?: VerificationLevel;
  details?: Record<string, string | number | boolean | null>;
}

const TERMINAL = new Set<ActionPhase>(["succeeded", "failed", "needs_approval", "needs_connection", "cancelled"]);
const TRANSITIONS: Record<ActionPhase, readonly ActionPhase[]> = {
  queued: ["running", "needs_approval", "needs_connection", "cancelled", "failed"],
  running: ["verifying", "failed", "needs_approval", "needs_connection", "cancelled"],
  verifying: ["succeeded", "failed", "needs_connection", "cancelled"],
  succeeded: [],
  failed: [],
  needs_approval: ["queued", "cancelled"],
  needs_connection: ["queued", "cancelled"],
  cancelled: [],
};

function safeText(value: string, max = 500): string {
  return value.replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim().slice(0, max);
}
function safeDetails(input?: Record<string, unknown>): Record<string, string | number | boolean | null> | undefined {
  if (!input) return undefined;
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,39}$/.test(key)) continue;
    if (typeof value === "string") output[key] = safeText(value, 300);
    else if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    else if (typeof value === "boolean" || value === null) output[key] = value;
  }
  return Object.keys(output).length ? output : undefined;
}

export function createActionEvent(start: ActionStart, phase: ActionPhase = "queued", now = Date.now()): ActionEvent {
  if (!start.id.trim() || !start.operation.trim() || !start.target.trim()) throw new Error("Action id, operation, and target are required.");
  return {
    id: `${start.id}:0`, actionId: safeText(start.id, 120), provider: start.provider,
    operation: safeText(start.operation, 100), phase, target: safeText(start.target, 400),
    summary: safeText(start.summary ?? "Action queued."), verification: "none", createdAt: now,
    ...(start.correlationId ? { correlationId: safeText(start.correlationId, 120) } : {}),
  };
}

export function transitionAction(previous: ActionEvent, nextPhase: ActionPhase, outcome?: ActionOutcome, now = Date.now()): ActionEvent {
  if (!TRANSITIONS[previous.phase].includes(nextPhase)) {
    throw new Error(`Invalid action transition: ${previous.phase} -> ${nextPhase}`);
  }
  if (nextPhase === "succeeded" && (!outcome || outcome.phase !== "succeeded" || (outcome.verification ?? "none") === "none")) {
    throw new Error("An action cannot be marked successful without an explicit verified outcome.");
  }
  if (TERMINAL.has(previous.phase)) throw new Error("Terminal action events are immutable; create a new attempt to retry.");
  const terminal = TERMINAL.has(nextPhase);
  return {
    ...previous,
    id: `${previous.actionId}:${Number(previous.id.split(":").at(-1) ?? 0) + 1}`,
    phase: nextPhase,
    summary: safeText(outcome?.summary ?? (nextPhase === "running" ? "Action is running." : nextPhase === "verifying" ? "Checking the result." : "Action status updated.")),
    verification: outcome?.verification ?? previous.verification,
    createdAt: now,
    ...(outcome?.details ? { details: safeDetails(outcome.details) } : {}),
  };
}

export function isTerminalAction(phase: ActionPhase): boolean {
  return TERMINAL.has(phase);
}

/** Stable keys prevent duplicated UI cards when adapters report the same event twice. */
export function deduplicateActionEvents(events: readonly ActionEvent[]): ActionEvent[] {
  const seen = new Set<string>();
  const output: ActionEvent[] = [];
  for (const event of events) {
    const key = event.id;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(event);
  }
  return output;
}
