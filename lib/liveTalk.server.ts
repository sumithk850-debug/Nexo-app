import "server-only";

import { createClient } from "@supabase/supabase-js";

export const LIVE_TALK_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
export const LIVE_TALK_DAILY_LIMIT_SECONDS = 20 * 60;
export const LIVE_TALK_TIME_ZONE = "Asia/Colombo";

export type LiveTalkLanguage = "auto" | "si" | "en";
export type LiveTalkSpeed = "slow" | "normal" | "fast";

export type LiveTalkPreferences = {
  language: LiveTalkLanguage;
  speed: LiveTalkSpeed;
};

export type LiveTalkUsage = {
  usedSeconds: number;
  remainingSeconds: number;
  limitSeconds: number;
  activeSessionId: string | null;
  activeExpiresAt: string | null;
  resetAt: string;
};

type StartedSession = {
  sessionId: string | null;
  remainingSeconds: number;
  expiresAt: string | null;
  status: "started" | "active" | "limit";
};

const DEFAULT_PREFERENCES: LiveTalkPreferences = {
  language: "auto",
  speed: "normal",
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Live Talk persistence is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizePreferences(value: Partial<LiveTalkPreferences> | null | undefined): LiveTalkPreferences {
  return {
    language: value?.language === "si" || value?.language === "en" ? value.language : "auto",
    speed: value?.speed === "slow" || value?.speed === "fast" ? value.speed : "normal",
  };
}

function nextColomboMidnightIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIVE_TALK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  // Sri Lanka is UTC+05:30 and does not observe daylight-saving time.
  return new Date(nextDay.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
}

export async function getLiveTalkPreferences(userId: string): Promise<LiveTalkPreferences> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("live_talk_preferences")
    .select("language, speed")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not read Live Talk preferences: ${error.message}`);
  return sanitizePreferences(data);
}

export async function saveLiveTalkPreferences(
  userId: string,
  value: Partial<LiveTalkPreferences>
): Promise<LiveTalkPreferences> {
  const preferences = sanitizePreferences(value);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("live_talk_preferences")
    .upsert(
      {
        user_id: userId,
        language: preferences.language,
        speed: preferences.speed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) throw new Error(`Could not save Live Talk preferences: ${error.message}`);
  return preferences;
}

function normalizeUsageRow(value: unknown): LiveTalkUsage {
  const row = (value ?? {}) as Record<string, unknown>;
  const usedSeconds = Math.max(0, Number(row.used_seconds ?? row.usedSeconds ?? 0));
  const remainingSeconds = Math.max(0, Number(row.remaining_seconds ?? row.remainingSeconds ?? LIVE_TALK_DAILY_LIMIT_SECONDS - usedSeconds));
  return {
    usedSeconds: Math.min(LIVE_TALK_DAILY_LIMIT_SECONDS, usedSeconds),
    remainingSeconds: Math.min(LIVE_TALK_DAILY_LIMIT_SECONDS, remainingSeconds),
    limitSeconds: LIVE_TALK_DAILY_LIMIT_SECONDS,
    activeSessionId: typeof row.active_session_id === "string" ? row.active_session_id : null,
    activeExpiresAt: typeof row.active_expires_at === "string" ? row.active_expires_at : null,
    resetAt: typeof row.reset_at === "string" ? row.reset_at : nextColomboMidnightIso(),
  };
}

export async function getLiveTalkUsage(userId: string): Promise<LiveTalkUsage> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_live_talk_usage", { p_user_id: userId });
  if (error) throw new Error(`Could not read Live Talk usage: ${error.message}`);
  return normalizeUsageRow(Array.isArray(data) ? data[0] : data);
}

export async function startLiveTalkSession(userId: string): Promise<StartedSession> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("start_live_talk_session", { p_user_id: userId });
  if (error) throw new Error(`Could not start Live Talk session: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data ?? {}) as Record<string, unknown>;
  const status = row.status === "active" || row.status === "limit" ? row.status : "started";
  return {
    sessionId: typeof row.session_id === "string" ? row.session_id : null,
    remainingSeconds: Math.max(0, Number(row.remaining_seconds ?? 0)),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    status,
  };
}

export async function finishLiveTalkSession(userId: string, sessionId: string): Promise<LiveTalkUsage> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("finish_live_talk_session", {
    p_user_id: userId,
    p_session_id: sessionId,
  });
  if (error) throw new Error(`Could not finish Live Talk session: ${error.message}`);
  return normalizeUsageRow(Array.isArray(data) ? data[0] : data);
}

export function buildLiveTalkInstruction(preferences: LiveTalkPreferences): string {
  const languageInstruction = preferences.language === "si"
    ? "Respond in Sinhala unless the user explicitly asks for another language. Keep code identifiers and established product names unchanged."
    : preferences.language === "en"
      ? "Respond in English unless the user explicitly asks for another language."
      : "Reply naturally in the user's dominant spoken language. Keep a stable language for the session instead of switching unpredictably.";

  const speedInstruction = preferences.speed === "slow"
    ? "Speak clearly at a slightly slower, easy-to-follow pace."
    : preferences.speed === "fast"
      ? "Speak briskly while staying clear and natural."
      : "Speak at a natural conversational pace.";

  return [
    "You are Nexo Live Talk, a concise and warm voice-only assistant.",
    languageInstruction,
    speedInstruction,
    "Keep ordinary answers short enough for a natural spoken conversation. Expand only when the user explicitly asks for detail.",
    "If the audio or intent is unclear, ask the user to repeat it briefly instead of guessing.",
    "Never claim that a repository, database, deployment, account, or external system has changed without its separate verified approval workflow.",
    "Do not execute, promise, or bypass any GitHub, Supabase, Vercel, payment, account, or other external write action from this voice session. Explain that explicit approval is required.",
    "Do not ask the user for passwords, API keys, access tokens, or other secrets.",
  ].join(" ");
}

export { DEFAULT_PREFERENCES };
