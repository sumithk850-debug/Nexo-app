import { NextRequest } from "next/server";

import {
  buildLiveTalkInstruction,
  finishLiveTalkSession,
  getLiveTalkPreferences,
  LIVE_TALK_MODEL,
  startLiveTalkSession,
} from "@/lib/liveTalk.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EphemeralTokenResponse = {
  name?: string;
  error?: { message?: string } | string;
};

function unavailable(message: string, status = 503) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  const apiKey = process.env.GEMINI_LIVE_API_KEY;
  if (!apiKey) {
    return unavailable("Live Talk is not configured yet. Please try again later.");
  }

  let sessionId: string | null = null;
  try {
    const started = await startLiveTalkSession(verified.user.id);
    sessionId = started.sessionId;
    if (started.status === "limit" || !sessionId || !started.expiresAt) {
      return unavailable("You have used today's 20-minute NEXO Live allowance. It resets at midnight.", 429);
    }
    if (started.status === "active") {
      return unavailable("NEXO Live is already active in another tab or device. End that session before starting a new one.", 409);
    }

    const preferences = await getLiveTalkPreferences(verified.user.id);
    const now = Date.now();
    const expireAt = new Date(Math.min(new Date(started.expiresAt).getTime(), now + 30 * 60 * 1000));
    const newSessionExpireAt = new Date(now + 60 * 1000);
    const sessionConfig = {
      responseModalities: ["AUDIO"],
      systemInstruction: {
        parts: [{ text: buildLiveTalkInstruction(preferences) }],
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          prefixPaddingMs: 450,
          silenceDurationMs: 1200,
        },
      },
      sessionResumption: {},
    };

    const tokenResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: expireAt.toISOString(),
        newSessionExpireTime: newSessionExpireAt.toISOString(),
        liveConnectConstraints: {
          model: `models/${LIVE_TALK_MODEL}`,
          config: sessionConfig,
        },
        // An empty field-mask request locks every field set above, including
        // the private system instruction and the audio/VAD-only policy.
        lockAdditionalFields: [],
      }),
      cache: "no-store",
    });

    const tokenData = (await tokenResponse.json().catch(() => ({}))) as EphemeralTokenResponse;
    if (!tokenResponse.ok || !tokenData.name) {
      console.error("[live-talk] Token provisioning failed", tokenResponse.status);
      await finishLiveTalkSession(verified.user.id, sessionId).catch(() => {});
      return unavailable("Live Talk could not start right now. Please try again shortly.");
    }

    return new Response(
      JSON.stringify({
        token: tokenData.name,
        sessionId,
        expiresAt: started.expiresAt,
        remainingSeconds: started.remainingSeconds,
        model: LIVE_TALK_MODEL,
        preferences,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("[live-talk] Could not create session", error);
    if (sessionId) await finishLiveTalkSession(verified.user.id, sessionId).catch(() => {});
    return unavailable("Live Talk could not start right now. Please try again shortly.");
  }
}
