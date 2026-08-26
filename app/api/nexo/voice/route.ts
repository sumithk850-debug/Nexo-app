import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { finishNexoVoiceSession } from "@/lib/nexoVoice.server";

export const runtime = "nodejs";

const PRIMARY_VOICE_MODEL = "gemini-2.5-flash";
const MAX_AUDIO_BASE64_LENGTH = 12_000_000;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function finalizeSession(userId: string, sessionId: string, status: "completed" | "cancelled" = "completed") {
  try {
    return await finishNexoVoiceSession(userId, sessionId, status);
  } catch (cause) {
    console.error("NEXO voice session finalization failed", {
      userId,
      sessionId,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return null;
  }
}

/**
 * Converts one short voice recording into a Nexo response using the primary
 * Gemini API path. Audio is processed in memory and is never persisted.
 */
export async function POST(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse("Voice service is unavailable right now. Please try again later.", 503);
  }

  let body: { audioData?: unknown; mimeType?: unknown; sessionId?: unknown };
  try {
    body = await req.json() as { audioData?: unknown; mimeType?: unknown; sessionId?: unknown };
  } catch {
    return errorResponse("The voice message could not be read. Please try again.", 400);
  }

  const audioData = typeof body.audioData === "string" ? body.audioData : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) return errorResponse("The voice session is no longer active. Please retry.", 409);
  if (!audioData || !mimeType.startsWith("audio/") || audioData.length > MAX_AUDIO_BASE64_LENGTH) {
    await finalizeSession(verified.user.id, sessionId);
    return errorResponse("That voice message is too large or could not be read. Please try a shorter message.", 400);
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_VOICE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              {
                text: "Listen to the user's voice message and reply naturally as Nexo. Return only a professional, medium-length spoken reply without markdown, system details, service names, or API/key references. For a simple greeting, use 1–2 natural sentences; for a normal question, use about 2–5 useful sentences with enough context but no long essay. Reply in the language the user speaks.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioData,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 420,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      },
    );

    const payload = await upstream.json().catch(() => ({})) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join(" ")
      .trim();

    const usage = await finalizeSession(verified.user.id, sessionId);
    if (!upstream.ok || !text) {
      console.error("Nexo voice response failed", {
        status: upstream.status,
        userId: verified.user.id,
      });
      return errorResponse("Nexo could not understand that message. Please try again.", upstream.status === 429 ? 429 : 502);
    }

    return Response.json({ text, usage }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    await finalizeSession(verified.user.id, sessionId);
    console.error("Nexo voice request failed", {
      userId: verified.user.id,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return errorResponse("Voice response could not start. Please check your connection and retry.", 502);
  }
}
