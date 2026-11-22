import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";

export const CRAFT_V5_TRIAL_DURATION_MS = 48 * 60 * 60 * 1000;
export const CRAFT_V5_TOKEN_LIMIT = 1_000;
export const CRAFT_V5_TOKEN_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CraftV5Trial {
  userId: string;
  startedAt: string;
  expiresAt: string;
  active: boolean;
  remainingMs: number;
}

export interface CraftV5TokenWindow {
  tokensUsed: number;
  remainingTokens: number;
  resetAt: string | null;
}

function mapTrial(row: { user_id: string; started_at: string; expires_at: string }): CraftV5Trial {
  const remainingMs = Math.max(0, new Date(row.expires_at).getTime() - Date.now());
  return {
    userId: row.user_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    active: remainingMs > 0,
    remainingMs,
  };
}

export async function getCraftV5Trial(userId: string): Promise<CraftV5Trial | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("craft_v5_trials")
    .select("user_id, started_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read Craft V5 trial: ${error.message}`);
  return data ? mapTrial(data) : null;
}

/** Starts a trial exactly once; the database primary key handles concurrent first entries. */
export async function startCraftV5Trial(userId: string): Promise<CraftV5Trial> {
  const existing = await getCraftV5Trial(userId);
  if (existing) return existing;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + CRAFT_V5_TRIAL_DURATION_MS);
  const { error } = await getSupabaseAdmin().from("craft_v5_trials").insert({
    user_id: userId,
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (error && error.code !== "23505") throw new Error(`Could not start Craft V5 trial: ${error.message}`);

  const trial = await getCraftV5Trial(userId);
  if (!trial) throw new Error("Craft V5 trial could not be confirmed.");
  return trial;
}

export async function requireActiveCraftV5Trial(userId: string): Promise<CraftV5Trial> {
  const trial = await getCraftV5Trial(userId);
  if (!trial || !trial.active) throw new Error("Craft V5 trial is not active.");
  return trial;
}

/**
 * Craft V5 remains available after the launch window through its separate
 * daily token allowance. A user must have activated the experience once, but
 * the 48-hour launch window must not hide or disable the model afterwards.
 */
export async function requireCraftV5Access(userId: string): Promise<CraftV5Trial> {
  const trial = await getCraftV5Trial(userId);
  if (!trial) throw new Error("Craft V5 has not been activated for this account.");
  return trial;
}

/** Atomically reserves a bounded estimate for one V5 request. */
export async function consumeCraftV5Tokens(userId: string, requestedTokens: number): Promise<CraftV5TokenWindow & { allowed: boolean }> {
  const bounded = Math.max(1, Math.ceil(requestedTokens));
  const { data, error } = await getSupabaseAdmin().rpc("consume_craft_v5_tokens", {
    p_user_id: userId,
    p_tokens: bounded,
    p_limit: CRAFT_V5_TOKEN_LIMIT,
  });
  if (error) throw new Error(`Could not reserve Craft V5 tokens: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    tokensUsed: Number(row?.tokens_used ?? 0),
    remainingTokens: Number(row?.remaining_tokens ?? 0),
    resetAt: typeof row?.reset_at === "string" ? row.reset_at : null,
  };
}

export async function getCraftV5TokenWindow(userId: string): Promise<CraftV5TokenWindow> {
  const { data, error } = await getSupabaseAdmin()
    .from("craft_v5_token_windows")
    .select("window_started_at, tokens_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read Craft V5 token window: ${error.message}`);
  if (!data || new Date(data.window_started_at).getTime() + CRAFT_V5_TOKEN_WINDOW_MS <= Date.now()) {
    return { tokensUsed: 0, remainingTokens: CRAFT_V5_TOKEN_LIMIT, resetAt: null };
  }
  const tokensUsed = Number(data.tokens_used ?? 0);
  return {
    tokensUsed,
    remainingTokens: Math.max(0, CRAFT_V5_TOKEN_LIMIT - tokensUsed),
    resetAt: new Date(new Date(data.window_started_at).getTime() + CRAFT_V5_TOKEN_WINDOW_MS).toISOString(),
  };
}
