import { NextRequest } from "next/server";

import {
  getLiveTalkPreferences,
  saveLiveTalkPreferences,
  type LiveTalkLanguage,
  type LiveTalkSpeed,
} from "@/lib/liveTalk.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  try {
    const preferences = await getLiveTalkPreferences(verified.user.id);
    return new Response(JSON.stringify({ preferences }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[live-talk] Could not load preferences", error);
    return new Response(JSON.stringify({ error: "Live Talk settings are unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export async function PATCH(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  const body = await request.json().catch(() => ({}));
  const language = body.language as LiveTalkLanguage | undefined;
  const speed = body.speed as LiveTalkSpeed | undefined;
  if (
    (language !== undefined && language !== "auto" && language !== "si" && language !== "en") ||
    (speed !== undefined && speed !== "slow" && speed !== "normal" && speed !== "fast")
  ) {
    return new Response(JSON.stringify({ error: "Invalid Live Talk preference." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const current = await getLiveTalkPreferences(verified.user.id);
    const preferences = await saveLiveTalkPreferences(verified.user.id, {
      language: language ?? current.language,
      speed: speed ?? current.speed,
    });
    return new Response(JSON.stringify({ preferences }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[live-talk] Could not save preferences", error);
    return new Response(JSON.stringify({ error: "Live Talk settings could not be saved." }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
