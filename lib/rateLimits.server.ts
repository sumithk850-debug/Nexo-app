// NEXO AI — Token Usage Tracking (Server-only)
// This file tracks per-model token usage and provides daily usage data.
// It is only imported from app/api/** route handlers.
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
  nexio: { tokens: 50_000, messages: 50 },
  spadec: { tokens: 60_000, messages: 50 },
  galex: { tokens: 100_000, messages: 30 },
  brainex: { tokens: 150_000, messages: 20 },
  craft: { tokens: 200_000, messages: 5 },
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Estimate tokens from text length (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

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
      .select(`id, ${column}, total_tokens`)
      .eq("session_id", sessionId)
      .eq("date", today)
      .maybeSingle();

    const currentModelTokens = existing ? ((existing as unknown) as Record<string, unknown>)[column] ?? 0 : 0;
    const currentTotal = existing ? ((existing as unknown) as Record<string, unknown>).total_tokens ?? 0 : 0;

    const updateData: Record<string, unknown> = {};
    updateData[column] = Number(currentModelTokens) + totalForThis;
    updateData["total_tokens"] = Number(currentTotal) + totalForThis;

    await supabase
      .from("rate_limits")
      .update(updateData)
      .eq("session_id", sessionId)
      .eq("date", today);
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

// Get today's token usage for a session
export async function getDailyUsage(sessionId: string): Promise<TokenUsageResult | null> {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const { data } = await supabase
      .from("rate_limits")
      .select(
        `nexio_tokens, spadec_tokens, galex_tokens, brainex_tokens, craft_tokens, total_tokens, message_count, coder_count`
      )
      .eq("session_id", sessionId)
      .eq("date", today)
      .maybeSingle();

    if (!data) return null;

    return {
      nexio: data.nexio_tokens ?? 0,
      spadec: data.spadec_tokens ?? 0,
      galex: data.galex_tokens ?? 0,
      brainex: data.brainex_tokens ?? 0,
      craft: data.craft_tokens ?? 0,
      total: data.total_tokens ?? 0,
      messageCount: data.message_count ?? 0,
      coderCount: data.coder_count ?? 0,
      date: today,
    };
  } catch (err) {
    console.error("[rateLimits] Failed to get daily usage:", err);
    return null;
  }
}
