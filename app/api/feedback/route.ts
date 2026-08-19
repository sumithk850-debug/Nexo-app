import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getDevelopmentIntelligenceAdmin } from "@/lib/developmentIntelligence.server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Stores an explicit user feedback signal. Identity always comes from the
 * verified bearer token, never from a browser-provided session or user ID.
 * Feedback is private and does not automatically alter model behavior.
 */
export async function POST(request: Request) {
  const verified = await requireVerifiedUser(request);
  if ("response" in verified) return verified.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
    const rating = body.rating;
    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : null;

    if (!messageId || messageId.length > 200) return badRequest("A valid message is required.");
    if (!modelId || modelId.length > 120) return badRequest("A valid model is required.");
    if (rating !== "up" && rating !== "down") return badRequest("Rating must be 'up' or 'down'.");

    const admin = getDevelopmentIntelligenceAdmin();
    const { error } = await admin
      .from("feedback")
      .upsert(
        {
          message_id: messageId,
          user_id: verified.user.id,
          session_id: verified.user.id,
          model_id: modelId,
          rating,
          comment,
        },
        { onConflict: "message_id,user_id" },
      );

    if (error) {
      console.error("Feedback save error:", error.message);
      return NextResponse.json({ error: "Unable to save feedback right now." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback route error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }
}
