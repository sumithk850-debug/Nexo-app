import { NextRequest } from "next/server";
import { getChatAdminClient } from "@/lib/chatOwnership.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

type SearchResult = {
  id: string;
  chat_id: string;
  content: string;
  chat_title: string;
  kind: "conversation" | "message";
};

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Searches only rows whose parent chat belongs to the verified caller. */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) return jsonError("Enter between 2 and 120 characters to search.", 400);

  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;

  try {
    const supabase = getChatAdminClient();
    const { data: chats, error: chatsError } = await supabase
      .from("chats")
      .select("id, title")
      .eq("user_id", verified.user.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (chatsError) return jsonError("Could not search conversations.", 500);

    const normalized = query.toLocaleLowerCase();
    const titleResults: SearchResult[] = (chats ?? [])
      .filter((chat) => chat.title.toLocaleLowerCase().includes(normalized))
      .slice(0, 8)
      .map((chat) => ({
        id: `chat:${chat.id}`,
        chat_id: chat.id,
        chat_title: chat.title,
        content: "Conversation title",
        kind: "conversation",
      }));

    const chatIds = (chats ?? []).map((chat) => chat.id);
    if (chatIds.length === 0) return Response.json({ results: titleResults }, { headers: { "Cache-Control": "no-store" } });

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, chat_id, content")
      .in("chat_id", chatIds)
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (messagesError) return jsonError("Could not search messages.", 500);

    const titles = new Map((chats ?? []).map((chat) => [chat.id, chat.title]));
    const messageResults: SearchResult[] = (messages ?? []).map((message) => ({
      id: message.id,
      chat_id: message.chat_id,
      content: message.content,
      chat_title: titles.get(message.chat_id) ?? "Conversation",
      kind: "message",
    }));

    return Response.json({ results: [...titleResults, ...messageResults].slice(0, 20) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return jsonError("Search is temporarily unavailable.", 503);
  }
}
