import { requireVerifiedUser } from "@/lib/requestAuth.server";

const LIVE_MODEL = "gemini-3.1-flash-live-preview";
const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Provisions a short-lived, single-use Gemini Live token for the signed-in
 * browser. The long-lived production credential remains server-side.
 */
export async function POST(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  const apiKey = process.env.GEMINI_LIVE_API_KEY;
  if (!apiKey) {
    return errorResponse("Live connection is unavailable. The saved Gemini Live API key needs attention.", 503);
  }

  const now = Date.now();
  const expireTime = new Date(now + 25 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  try {
    const upstream = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: `models/${LIVE_MODEL}`,
          config: {
            responseModalities: ["AUDIO"],
          },
        },
      }),
      cache: "no-store",
    });

    const payload = await upstream.json().catch(() => ({})) as {
      name?: string;
      error?: { message?: string };
    };

    if (!upstream.ok || !payload.name) {
      console.error("Gemini Live token provisioning failed", {
        status: upstream.status,
        userId: verified.user.id,
      });
      return errorResponse(
        "Live connection could not start. Check the saved Gemini Live API key and Live model access.",
        502,
      );
    }

    return Response.json({
      token: payload.name,
      model: LIVE_MODEL,
      expiresAt: expireTime,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Gemini Live token request failed", {
      userId: verified.user.id,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return errorResponse("Live connection could not reach the service. Please retry.", 502);
  }
}
