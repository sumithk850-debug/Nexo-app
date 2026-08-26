import { NextRequest } from "next/server";
import { findOwnedChat, getChatAdminClient } from "@/lib/chatOwnership.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function requireOwnedChat(req: NextRequest, chatId: string) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return { response: verified.response } as const;

  const supabase = getChatAdminClient();
  const chat = await findOwnedChat(supabase, verified.user.id, chatId);
  if (!chat) return { response: jsonError("Chat not found.", 404) } as const;
  return { supabase, userId: verified.user.id } as const;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await requireOwnedChat(req, id);
    if ("response" in access) return access.response;

    const { data, error } = await access.supabase
      .from("messages")
      .select("id, role, content, model_id, created_at")
      .eq("chat_id", id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) return jsonError("Could not load messages.", 500);
    return Response.json({ messages: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { role?: unknown; content?: unknown; modelId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const role = body.role === "user" || body.role === "assistant" ? body.role : null;
  const content = typeof body.content === "string" ? body.content : null;
  const modelId = typeof body.modelId === "string" ? body.modelId.slice(0, 80) : null;
  if (!role || content === null || content.length > 120_000) {
    return jsonError("Missing or invalid message content", 400);
  }

  try {
    const access = await requireOwnedChat(req, id);
    if ("response" in access) return access.response;

    const { data, error } = await access.supabase
      .from("messages")
      .insert({ chat_id: id, role, content, model_id: modelId })
      .select("id, role, content, model_id, created_at")
      .single();

    if (error) return jsonError("Could not save message.", 500);

    const { error: touchError } = await access.supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", access.userId);
    if (touchError) return jsonError("Message was saved but chat update failed.", 500);

    return Response.json({ message: data }, { status: 201 });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messageId = req.nextUrl.searchParams.get("id");
  if (!messageId) return jsonError("Missing message id", 400);

  try {
    const access = await requireOwnedChat(req, id);
    if ("response" in access) return access.response;

    const { data, error } = await access.supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("chat_id", id)
      .select("id")
      .maybeSingle();

    if (error) return jsonError("Could not delete message.", 500);
    if (!data) return jsonError("Message not found.", 404);

    const { error: touchError } = await access.supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", access.userId);
    if (touchError) return jsonError("Message was deleted but chat update failed.", 500);

    return Response.json({ ok: true });
  } catch {
    return jsonError("Chat history is temporarily unavailable.", 503);
  }
}
