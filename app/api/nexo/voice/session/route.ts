import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { finishNexoVoiceSession, startNexoVoiceSession } from "@/lib/nexoVoice.server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const session = await startNexoVoiceSession(verified.user.id);
    if (!session.allowed || !session.sessionId) {
      return errorResponse(session.reason ?? "Your voice session could not start.", 429);
    }
    return Response.json({
      sessionId: session.sessionId,
      remainingSeconds: session.remainingSeconds,
      maxDurationSeconds: session.maxDurationSeconds,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("NEXO Live session start failed", {
      userId: verified.user.id,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return errorResponse("Voice sessions are unavailable right now. Please retry.", 503);
  }
}

export async function DELETE(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  let sessionId = "";
  try {
    const body = await req.json() as { sessionId?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    return errorResponse("The voice session could not be closed.", 400);
  }

  if (!sessionId) return errorResponse("The voice session could not be closed.", 400);

  try {
    const result = await finishNexoVoiceSession(verified.user.id, sessionId, "cancelled");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("NEXO Live session cancel failed", {
      userId: verified.user.id,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return errorResponse("The voice session could not be closed.", 502);
  }
}
