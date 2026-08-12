import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, sessionId, modelId, rating, comment } = body;

    if (!messageId || !sessionId || !modelId || !rating) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["up", "down"].includes(rating)) {
      return NextResponse.json(
        { error: "Invalid rating. Must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("feedback")
      .upsert(
        {
          message_id: messageId,
          user_id: sessionId,
          session_id: sessionId,
          model_id: modelId,
          rating: rating,
          comment: comment || null,
        },
        { onConflict: "message_id,user_id" }
      )
      .select();

    if (error) {
      console.error("Feedback save error:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Feedback route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
