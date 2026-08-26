import { NextRequest } from "next/server";
import { findOwnedChat, getChatAdminClient, isSafeSessionId } from "@/lib/chatOwnership.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// GET /api/chats?sessionId=xxx — lists only chats owned by the verified user.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!isSafeSessionId(sessionId)) return jsonError("Missing or invalid session", 400);

  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const supabase = getChatAdminClient();
    const { data, error } = await supabase
      .from("chats")
      .select("id, session_id, title, model_id, created_at, updated_at")
      .eq("user_id", verified.user.id)
      .eq("session_id", sessionId.trim())
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) return jsonError("Could not load chat history.", 500);
    return Response.json({ chats: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}

// POST /api/chats — creates a chat owned by the verified user.
export async function POST(req: NextRequest) {
  let body: { sessionId?: unknown; title?: unknown; modelId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }
  if (!isSafeSessionId(body.sessionId)) return jsonError("Missing or invalid session", 400);

  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) || "New chat" : "New chat";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim().slice(0, 80) || "nexio-1.1" : "nexio-1.1";

  try {
    const supabase = getChatAdminClient();
    const { data, error } = await supabase
      .from("chats")
      .insert({
        session_id: body.sessionId.trim(),
        user_id: verified.user.id,
        title,
        model_id: modelId,
      })
      .select("id, session_id, title, model_id, created_at, updated_at")
      .single();

    if (error) return jsonError("Could not create chat.", 500);
    return Response.json({ chat: data }, { status: 201 });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}

// PATCH /api/chats — updates only a chat owned by the verified user.
export async function PATCH(req: NextRequest) {
  let body: { id?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const chatId = typeof body.id === "string" ? body.id : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  if (!chatId || !title) return jsonError("Missing id or title", 400);

  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const supabase = getChatAdminClient();
    const { data, error } = await supabase
      .from("chats")
      .update({ title })
      .eq("id", chatId)
      .eq("user_id", verified.user.id)
      .select("id, session_id, title, model_id, created_at, updated_at")
      .maybeSingle();

    if (error) return jsonError("Could not update chat.", 500);
    if (!data) return jsonError("Chat not found.", 404);
    return Response.json({ chat: data });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}

// DELETE /api/chats?id=xxx — deletes only a chat owned by the verified user.
export async function DELETE(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("id");
  if (!chatId) return jsonError("Missing id", 400);

  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const supabase = getChatAdminClient();
    const ownedChat = await findOwnedChat(supabase, verified.user.id, chatId);
    if (!ownedChat) return jsonError("Chat not found.", 404);

    const { error } = await supabase.from("chats").delete().eq("id", chatId).eq("user_id", verified.user.id);
    if (error) return jsonError("Could not delete chat.", 500);
    return Response.json({ success: true });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}
