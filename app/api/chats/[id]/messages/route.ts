import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";
import { prepareProgressForStorage } from "@/lib/progressSteps";

export const runtime = "nodejs";

function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

// The Summary column is added by supabase/migrations/20261125_messages_progress_summary.sql.
// Until that migration has run, saving and loading must keep working without it.
function isMissingProgressColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /progress/i.test(error.message ?? "") && /column/i.test(error.message ?? "");
}

async function findOwnedChat(chatId: string, sessionId: string) {
  const { data, error } = await getSupabaseAdmin().from("chats")
    .select("id").eq("id", chatId).eq("session_id", sessionId).maybeSingle();
  if (error) {
    console.error("[chat-messages] Ownership lookup failed:", error.message);
    return { chat: null, failed: true };
  }
  return { chat: data, failed: false };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = req.headers.get("x-session-id");
  if (!id || !isValidSessionId(sessionId)) return jsonError("Invalid chat or session.", 400);
  const ownership = await findOwnedChat(id, sessionId);
  if (ownership.failed) return jsonError("Unable to load chat messages.", 500);
  if (!ownership.chat) return jsonError("Chat not found for this session.", 404);
  const admin = getSupabaseAdmin();
  const loadRows = async (columns: string) => {
    const result = await admin.from("messages")
      .select(columns).eq("chat_id", id)
      .order("created_at", { ascending: true }).limit(200);
    return { data: result.data as unknown as unknown[] | null, error: result.error };
  };
  let { data, error } = await loadRows("id, role, content, model_id, created_at, progress");
  if (error && isMissingProgressColumn(error)) {
    ({ data, error } = await loadRows("id, role, content, model_id, created_at"));
  }
  if (error) {
    console.error("[chat-messages] Read failed:", error.message);
    return jsonError("Unable to load chat messages.", 500);
  }
  return Response.json({ messages: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError("Invalid request body.", 400); }
  const { role, content, modelId, sessionId } = body;
  if (!id || !isValidSessionId(sessionId) ||
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" || content.length > 100_000 ||
      (modelId !== undefined && modelId !== null && typeof modelId !== "string")) {
    return jsonError("Invalid message payload.", 400);
  }
  const ownership = await findOwnedChat(id, sessionId);
  if (ownership.failed) return jsonError("Unable to save chat message.", 500);
  if (!ownership.chat) return jsonError("Chat not found for this session.", 404);
  const supabase = getSupabaseAdmin();
  const row = { chat_id: id, role, content, model_id: typeof modelId === "string" ? modelId.slice(0, 120) || null : null };
  // Only assistant replies carry a Summary, and only a well-formed, small one is stored.
  const storedProgress = role === "assistant" ? prepareProgressForStorage(body.progress) : null;
  const rowWithProgress: Record<string, unknown> = storedProgress ? { ...row, progress: storedProgress } : row;
  let { data, error } = await supabase.from("messages")
    .insert(rowWithProgress as any)
    .select("id, chat_id, role, content, model_id, created_at").single();
  if (error && storedProgress && isMissingProgressColumn(error)) {
    // The migration has not been run yet: save the reply itself without its Summary.
    ({ data, error } = await supabase.from("messages")
      .insert(row)
      .select("id, chat_id, role, content, model_id, created_at").single());
  }
  if (error || !data) {
    console.error("[chat-messages] Save failed:", error?.message ?? "no row returned");
    return jsonError("Unable to save chat message.", 500);
  }
  const { error: updateError } = await supabase.from("chats")
    .update({ updated_at: new Date().toISOString() }).eq("id", id).eq("session_id", sessionId);
  if (updateError) console.error("[chat-messages] Chat timestamp update failed:", updateError.message);
  return Response.json({ message: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messageId = req.nextUrl.searchParams.get("id");
  const sessionId = req.headers.get("x-session-id");
  if (!messageId || !id || !isValidSessionId(sessionId)) return jsonError("Invalid message or session.", 400);
  const ownership = await findOwnedChat(id, sessionId);
  if (ownership.failed) return jsonError("Unable to delete chat message.", 500);
  if (!ownership.chat) return jsonError("Chat not found for this session.", 404);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("chat_id", id);
  if (error) {
    console.error("[chat-messages] Delete failed:", error.message);
    return jsonError("Unable to delete chat message.", 500);
  }
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id).eq("session_id", sessionId);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
