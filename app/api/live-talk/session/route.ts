import { NextRequest } from "next/server";

import { finishLiveTalkSession } from "@/lib/liveTalk.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const verified = await requireVerifiedUser(request);
  if (verified.response) return verified.response;

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(JSON.stringify({ error: "Invalid Live Talk session." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const usage = await finishLiveTalkSession(verified.user.id, sessionId);
    return new Response(JSON.stringify({ usage }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[live-talk] Could not finish session", error);
    return new Response(JSON.stringify({ error: "Live Talk usage could not be finalized." }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
