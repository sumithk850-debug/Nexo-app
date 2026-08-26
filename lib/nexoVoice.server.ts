import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const NEXO_LIVE_DAILY_LIMIT_SECONDS = 20 * 60;
export const NEXO_LIVE_MAX_TURN_SECONDS = 60;

export type NexoVoiceUsage = {
  usedSeconds: number;
  remainingSeconds: number;
  limitSeconds: number;
  resetAt: string;
};

type SessionStartResult = {
  allowed: boolean;
  sessionId?: string;
  remainingSeconds?: number;
  maxDurationSeconds?: number;
  reason?: string;
};

function getAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("NEXO Live storage is not configured.");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function startNexoVoiceSession(userId: string): Promise<SessionStartResult> {
  const { data, error } = await getAdmin().rpc("start_nexo_voice_session", {
    p_user_id: userId,
    p_daily_limit_seconds: NEXO_LIVE_DAILY_LIMIT_SECONDS,
    p_max_turn_seconds: NEXO_LIVE_MAX_TURN_SECONDS,
  });
  if (error) throw new Error(error.message);
  return (data ?? { allowed: false, reason: "Voice sessions are unavailable right now." }) as SessionStartResult;
}

export async function finishNexoVoiceSession(userId: string, sessionId: string, status: "completed" | "cancelled" = "completed") {
  const { data, error } = await getAdmin().rpc("finish_nexo_voice_session", {
    p_user_id: userId,
    p_session_id: sessionId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as { durationSeconds: number; usedSeconds: number; remainingSeconds: number };
}

export async function getNexoVoiceUsage(userId: string): Promise<NexoVoiceUsage> {
  const admin = getAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("nexo_voice_daily_usage")
    .select("used_seconds")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const reset = new Date(`${today}T00:00:00.000Z`);
  reset.setUTCDate(reset.getUTCDate() + 1);
  const usedSeconds = Math.max(0, Number(data?.used_seconds ?? 0));
  return {
    usedSeconds,
    remainingSeconds: Math.max(0, NEXO_LIVE_DAILY_LIMIT_SECONDS - usedSeconds),
    limitSeconds: NEXO_LIVE_DAILY_LIMIT_SECONDS,
    resetAt: reset.toISOString(),
  };
}

export function secondsToLabel(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
