import { NextRequest } from "next/server";
import type { ActionEvent } from "@/lib/actionEngine";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { PROVIDER_CONFIG, type ProviderConfig } from "@/lib/providers.server";
import { runNativeToolLoop, type NativeToolMessage } from "@/lib/nativeTools.server";
import { signNativeToolContext } from "@/lib/nativeToolSignature.server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 4_000) : "";
    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    if (!userId || !query) {
      return Response.json({ error: "A signed-in user and query are required." }, { status: 400 });
    }

    const verified = await requireVerifiedUser(request, userId);
    if (verified.response) return verified.response;

    const config = (PROVIDER_CONFIG as Record<string, ProviderConfig | undefined>)[modelId];
    if (!config) {
      return Response.json({ error: "Tool preparation is not available for this model." }, { status: 400 });
    }

    const history: NativeToolMessage[] = Array.isArray(body.messages)
      ? body.messages
          .filter((item: unknown): item is { role: string; content: string } =>
            typeof item === "object" && item !== null &&
            ((item as { role?: unknown }).role === "user" || (item as { role?: unknown }).role === "assistant") &&
            typeof (item as { content?: unknown }).content === "string")
          .slice(-10)
          .map((item: { role: "user" | "assistant"; content: string }) => ({ role: item.role, content: item.content }))
      : [];
    const messages: NativeToolMessage[] = history.length > 0 ? history : [{ role: "user", content: query }];

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n"));
        };
        try {
          const result = await runNativeToolLoop({
            provider: config.provider,
            model: config.model,
            fallbackModels: config.fallbackModels,
            systemPrompt: config.systemPrompt,
            messages,
            userId: verified.user.id,
            githubEnabled: Boolean(body.githubEnabled),
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            geminiApiKey: process.env.GEMINI_API_KEY,
            groqApiKey: process.env.GROQ_API_KEY,
            maxRounds: 3,
            webResearchAlreadyDone: Boolean(body.webResearchAlreadyDone),
            onActionEvent: (event: ActionEvent) => send({ type: "action", event }),
          });
          send({ type: "result", token: signNativeToolContext({ userId: verified.user.id, query, result }) });
        } catch {
          send({ type: "error", message: "Tool preparation could not be completed." });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "Tool request could not be prepared." }, { status: 500 });
  }
}
