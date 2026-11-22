import { NextRequest } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { searchAndReadWithTavily } from "@/lib/tavily.server";
import { shouldUseWebResearchIntent } from "@/lib/webResearchIntent";
import { signWebResearchContext } from "@/lib/webResearchSignature.server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 4_000) : "";
    if (!userId || !query) {
      return Response.json({ error: "A signed-in user and research query are required." }, { status: 400 });
    }

    const verified = await requireVerifiedUser(request, userId);
    if (verified.response) return verified.response;
    if (!shouldUseWebResearchIntent(query)) {
      return Response.json({ error: "This message does not need a web research run." }, { status: 400 });
    }
    if (!process.env.TAVILY_API_KEY) {
      return Response.json({ error: "Tavily is not configured yet. Add TAVILY_API_KEY in Vercel Environment Variables." }, { status: 503 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n"));
        };
        try {
          send({ type: "progress", stage: "queued", message: "Preparing secure web research." });
          const result = await searchAndReadWithTavily(query, (event) => send({ type: "progress", ...event }));
          const context = JSON.stringify(result).slice(0, 28_000);
          const token = signWebResearchContext(verified.user.id, query, context);
          send({ type: "result", result, token });
        } catch (error) {
          send({
            type: "error",
            message: error instanceof Error ? error.message.slice(0, 240) : "Web research could not be completed.",
          });
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
    return Response.json({ error: "Web research request could not be prepared." }, { status: 500 });
  }
}
