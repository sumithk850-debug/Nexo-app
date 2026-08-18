import { NextRequest } from "next/server";
import { saveGithubConversationMemory } from "@/lib/githubMemory.server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid memory request" }), { status: 400 });
    }
    const userId = typeof body.userId === "string" ? body.userId : "";
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    const title = typeof body.title === "string" ? body.title : undefined;
    const modelId = typeof body.modelId === "string" ? body.modelId : undefined;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!userId || !chatId || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing memory data" }), { status: 400 });
    }
    const verified = await requireVerifiedUser(request, userId);
    if (verified.response) return verified.response;

    await saveGithubConversationMemory({ userId: verified.user.id, chatId, title, modelId, messages });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("[github-memory] Save failed:", error);
    return new Response(JSON.stringify({ error: "Could not save GitHub conversation memory" }), { status: 500 });
  }
}
