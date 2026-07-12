import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIG } from "@/lib/providers.server";
import type { NexoModelId } from "@/lib/models";

export const runtime = "nodejs";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const GITHUB_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DAILY_MESSAGE_LIMIT = 50;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function checkAndIncrementRateLimit(sessionId: string): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("message_count")
    .eq("session_id", sessionId)
    .eq("date", today)
    .maybeSingle();

  const currentCount = existing?.message_count ?? 0;

  if (currentCount >= DAILY_MESSAGE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await supabase
    .from("rate_limits")
    .upsert(
      { session_id: sessionId, date: today, message_count: currentCount + 1 },
      { onConflict: "session_id,date" }
    );

  return { allowed: true, remaining: DAILY_MESSAGE_LIMIT - currentCount - 1 };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = body.modelId as NexoModelId;
    const messages = body.messages as IncomingMessage[];
    const sessionId = body.sessionId as string | undefined;

    // Rate limiting — only enforced when a sessionId is provided.
    // This keeps the API safe to call even if the client hasn't set up
    // a session yet, while still protecting the common path.
    if (sessionId) {
      const { allowed, remaining } = await checkAndIncrementRateLimit(sessionId);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            message: `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} messages. Come back tomorrow, or upgrade for unlimited access.`,
          }),
          { status: 429 }
        );
      }
      // Remaining count is available here if we want to surface it to the client later.
      void remaining;
    }

    const config = PROVIDER_CONFIG[modelId];
    if (!config) {
      return new Response(JSON.stringify({ error: "Unknown model" }), {
        status: 400,
      });
    }

    const apiKey =
      config.provider === "github"
        ? process.env.GITHUB_MODELS_TOKEN
        : process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `Missing API key for provider: ${config.provider}. Set it in your environment variables.`,
        }),
        { status: 500 }
      );
    }

    const endpoint = config.provider === "github" ? GITHUB_ENDPOINT : GROQ_ENDPOINT;

    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 1.0,
        top_p: 1.0,
        max_tokens: 1000,
        messages: [
          { role: "system", content: config.systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text().catch(() => "Unknown error");
      return new Response(
        JSON.stringify({ error: "Upstream provider error", detail: errText }),
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamRes.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // ignore malformed keep-alive lines
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500 }
    );
  }
    }
