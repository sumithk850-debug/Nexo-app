// NEXO AI — Token Usage Tracking (Server-only)
// This file tracks per-model token usage and provides daily usage data.
// It is only imported from app/api/** route handlers.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NexoModelId } from "./models";

export interface TokenUsageResult {
  nexio: number;
  spadec: number;
  galex: number;
  brainex: number;
  craft: number;
  total: number;
  messageCount: number;
  coderCount: number;
  coderPausedUntil: string | null;
  date: string;
}

export interface DailyLimits {
  nexio: { tokens: number; messages: number };
  spadec: { tokens: number; messages: number };
  galex: { tokens: number; messages: number };
  brainex: { tokens: number; messages: number };
  craft: { tokens: number; messages: number };
}

// Daily limits per model — tokens and messages
export const DAILY_LIMITS: DailyLimits = {
  // Credit allocation: bigger models get LOWER credits (more expensive),
  // smaller models get HIGHER credits (cheaper).
  nexio: { tokens: 200_000, messages: 50 },  // smallest model → most credits
  spadec: { tokens: 150_000, messages: 30 },
  galex: { tokens: 100_000, messages: 20 },
  brainex: { tokens: 60_000, messages: 10 },
  // Craft V3 is measured only by its 3K token budget; coder_count remains an
  // informational dashboard metric and no longer stops the fifth request.
  craft: { tokens: 3_000, messages: 0 },
};

export const CRAFT_TOKEN_LIMIT = DAILY_LIMITS.craft.tokens;
export const CODER_PAUSE_DURATION_MS = 24 * 60 * 60 * 1000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Usage persistence is not configured.");
  }

  // This module is invoked only after the caller's identity or anonymous scope
  // has been established by a route handler. The service client is necessary
  // because rate-limit rows are intentionally not browser-accessible.
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Estimate tokens from text length (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Cost multiplier per model — bigger models consume more "credits" per token.
// This means Craft V3 usage drains credits faster than Nexio.
export const MODEL_COST_MULTIPLIER: Partial<Record<NexoModelId, number>> = {
  "nexio-1.1": 1,
  "spadec-3.5": 1.5,
  "galex-4.0": 2,
  "brainex-10.8": 3,
  "craft-v3": 5,
};

// Increment token usage for a specific model after a chat response
export async function recordTokenUsage(
  sessionId: string,
  modelId: NexoModelId,
  inputText: string,
  outputText: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const totalForThis = inputTokens + outputTokens;

    const column = getTokensColumn(modelId);
    if (!column) return;

    const { data: existing } = await supabase
      .from("rate_limits")
      .select(`id, ${column}, total_tokens, coder_paused_until`)
      .eq("session_id", sessionId)
      .eq("date", today)
      .maybeSingle();

    const existingRecord = (existing ?? null) as unknown as Record<string, unknown> | null;
    const currentModelTokens = existingRecord?.[column] ?? 0;
    const currentTotal = existingRecord?.total_tokens ?? 0;
    const nextModelTokens = Number(currentModelTokens) + totalForThis;

    const updateData: Record<string, unknown> = {};
    updateData[column] = nextModelTokens;
    updateData["total_tokens"] = Number(currentTotal) + totalForThis;

    // The first response that exhausts Craft's 3K budget starts the exact
    // 24-hour pause. This timestamp is retained in Supabase so refreshes and
    // later visits cannot accidentally resume the paused task too early.
    if (
      modelId === "craft-v3" &&
      nextModelTokens >= CRAFT_TOKEN_LIMIT &&
      !existingRecord?.coder_paused_until
    ) {
      updateData.coder_paused_until = new Date(
        Date.now() + CODER_PAUSE_DURATION_MS
      ).toISOString();
    }

    const { error } = await supabase
      .from("rate_limits")
      .update(updateData)
      .eq("session_id", sessionId)
      .eq("date", today);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    // Silently ignore — token tracking is best-effort
    console.error("[rateLimits] Failed to record token usage:", err);
  }
}

function getTokensColumn(modelId: NexoModelId): string | null {
  switch (modelId) {
    case "nexio-1.1": return "nexio_tokens";
    case "spadec-3.5": return "spadec_tokens";
    case "galex-4.0": return "galex_tokens";
    case "brainex-10.8": return "brainex_tokens";
    case "craft-v3": return "craft_tokens";
    default: return null;
  }
}

export interface CoderAvailability {
  allowed: boolean;
  remainingTokens: number;
  pausedUntil: string | null;
}

// Check Craft's running 3K token allowance. The pause search is intentionally
// not limited to the current UTC date because a 24-hour cooldown can cross
// midnight and must stay effective for its full duration.
export async function checkCoderTokenAvailability(
  sessionId: string,
  requestedInputTokens: number
): Promise<CoderAvailability> {
  const supabase = getSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: activePause, error: pauseError } = await supabase
    .from("rate_limits")
    .select("coder_paused_until")
    .eq("session_id", sessionId)
    .gt("coder_paused_until", nowIso)
    .order("coder_paused_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pauseError) {
    throw new Error(`Could not read coder pause state: ${pauseError.message}`);
  }

  if (activePause?.coder_paused_until) {
    return {
      allowed: false,
      remainingTokens: 0,
      pausedUntil: activePause.coder_paused_until,
    };
  }

  const today = nowIso.slice(0, 10);
  const { data: todayUsage, error: usageError } = await supabase
    .from("rate_limits")
    .select("craft_tokens")
    .eq("session_id", sessionId)
    .eq("date", today)
    .maybeSingle();

  if (usageError) {
    throw new Error(`Could not read coder usage: ${usageError.message}`);
  }

  const craftTokens = Number(todayUsage?.craft_tokens ?? 0);
  if (craftTokens + requestedInputTokens >= CRAFT_TOKEN_LIMIT) {
    const pausedUntil = new Date(
      now.getTime() + CODER_PAUSE_DURATION_MS
    ).toISOString();
    const { error: pauseWriteError } = await supabase
      .from("rate_limits")
      .upsert(
        { session_id: sessionId, date: today, coder_paused_until: pausedUntil },
        { onConflict: "session_id,date" }
      );

    if (pauseWriteError) {
      throw new Error(`Could not save coder pause state: ${pauseWriteError.message}`);
    }

    return { allowed: false, remainingTokens: 0, pausedUntil };
  }

  return {
    allowed: true,
    remainingTokens: CRAFT_TOKEN_LIMIT - craftTokens - requestedInputTokens,
    pausedUntil: null,
  };
}

// Get today's token usage and any active Craft pause for a session.
export async function getDailyUsage(sessionId: string): Promise<TokenUsageResult | null> {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("rate_limits")
      .select(
        `nexio_tokens, spadec_tokens, galex_tokens, brainex_tokens, craft_tokens, total_tokens, message_count, coder_count`
      )
      .eq("session_id", sessionId)
      .eq("date", today)
      .maybeSingle();

    const { data: activePause } = await supabase
      .from("rate_limits")
      .select("coder_paused_until")
      .eq("session_id", sessionId)
      .gt("coder_paused_until", now.toISOString())
      .order("coder_paused_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data && !activePause) return null;

    return {
      nexio: data?.nexio_tokens ?? 0,
      spadec: data?.spadec_tokens ?? 0,
      galex: data?.galex_tokens ?? 0,
      brainex: data?.brainex_tokens ?? 0,
      craft: data?.craft_tokens ?? 0,
      total: data?.total_tokens ?? 0,
      messageCount: data?.message_count ?? 0,
      coderCount: data?.coder_count ?? 0,
      coderPausedUntil: activePause?.coder_paused_until ?? null,
      date: today,
    };
  } catch (err) {
    console.error("[rateLimits] Failed to get daily usage:", err);
    return null;
  }
}
