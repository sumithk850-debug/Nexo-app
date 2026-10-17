import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";

export const runtime = "nodejs";

function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!isValidSessionId(sessionId)) return jsonError("Invalid or missing session.", 400);
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("chats").select("id, session_id, title, model_id, created_at, updated_at")
      .eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(100);
    if (error) {
      console.error("[chats] List failed:", error.message);
      return jsonError("Unable to load chat history.", 500);
    }
    return Response.json({ chats: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chats] List error:", error instanceof Error ? error.message : "unknown");
    return jsonError("Chat history is temporarily unavailable.", 500);
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError("Invalid request body.", 400); }
  const sessionId = body.sessionId;
  if (!isValidSessionId(sessionId)) return jsonError("Invalid or missing session.", 400);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "New chat";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim().slice(0, 120) : "nexio-1.1";
  try {
    const { data, error } = await getSupabaseAdmin().from("chats")
      .insert({ session_id: sessionId, title: title || "New chat", model_id: modelId || "nexio-1.1" })
      .select("id, session_id, title, model_id, created_at, updated_at").single();
    if (error || !data) {
      console.error("[chats] Create failed:", error?.message ?? "no row returned");
      return jsonError("Unable to create chat.", 500);
    }
    return Response.json({ chat: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chats] Create error:", error instanceof Error ? error.message : "unknown");
    return jsonError("Unable to create chat.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError("Invalid request body.", 400); }
  const { id, title, sessionId } = body;
  if (typeof id !== "string" || !isValidSessionId(sessionId) ||
      typeof title !== "string" || !title.trim() || title.length > 160) {
    return jsonError("Invalid chat update.", 400);
  }
  try {
    const { data, error } = await getSupabaseAdmin().from("chats")
      .update({ title: title.trim() }).eq("id", id).eq("session_id", sessionId)
      .select("id, session_id, title, model_id, created_at, updated_at").maybeSingle();
    if (error) {
      console.error("[chats] Update failed:", error.message);
      return jsonError("Unable to update chat.", 500);
    }
    if (!data) return jsonError("Chat not found for this session.", 404);
    return Response.json({ chat: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chats] Update error:", error instanceof Error ? error.message : "unknown");
    return jsonError("Unable to update chat.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!id || !isValidSessionId(sessionId)) return jsonError("Invalid chat or session.", 400);
  try {
    const supabase = getSupabaseAdmin();
    const { data: chat, error: lookupError } = await supabase.from("chats")
      .select("id").eq("id", id).eq("session_id", sessionId).maybeSingle();
    if (lookupError) {
      console.error("[chats] Delete lookup failed:", lookupError.message);
      return jsonError("Unable to delete chat.", 500);
    }
    if (!chat) return jsonError("Chat not found for this session.", 404);
    const { error: messageError } = await supabase.from("messages").delete().eq("chat_id", id);
    if (messageError) {
      console.error("[chats] Delete messages failed:", messageError.message);
      return jsonError("Unable to delete chat messages.", 500);
    }
    const { error } = await supabase.from("chats").delete().eq("id", id).eq("session_id", sessionId);
    if (error) {
      console.error("[chats] Delete failed:", error.message);
      return jsonError("Unable to delete chat.", 500);
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chats] Delete error:", error instanceof Error ? error.message : "unknown");
    return jsonError("Unable to delete chat.", 500);
  }
}
