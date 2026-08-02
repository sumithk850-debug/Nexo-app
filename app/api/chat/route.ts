import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIG } from "@/lib/providers.server";
import { readUrlsFromText, captureScreenshotsFromText } from "@/lib/urlReader.server";
import type { NexoModelId } from "@/lib/models";

export const runtime = "nodejs";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DAILY_MESSAGE_LIMIT = 50;
const CODER_DAILY_LIMIT = 5;

// Vision-capable fallback model, also served via OpenRouter, used to analyze
// screenshots for models that can't natively see images.
const VISION_FALLBACK_MODEL = "nvidia/nemotron-nano-12b-2-vl:free";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function checkAndIncrementRateLimit(sessionId: string, isCoder: boolean): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const column = isCoder ? "coder_count" : "message_count";
  const limit = isCoder ? CODER_DAILY_LIMIT : DAILY_MESSAGE_LIMIT;

  const { data: existing } = await supabase
    .from("rate_limits")
    .select(`message_count, coder_count`)
    .eq("session_id", sessionId)
    .eq("date", today)
    .maybeSingle();

  const currentCount = (isCoder ? existing?.coder_count : existing?.message_count) ?? 0;

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  const updateData: any = { session_id: sessionId, date: today };
  updateData[column] = currentCount + 1;

  await supabase
    .from("rate_limits")
    .upsert(
      updateData,
      { onConflict: "session_id,date" }
    );

  return { allowed: true, remaining: limit - currentCount - 1, limit };
}

async function getUserMemory(sessionId: string): Promise<string> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("user_settings")
      .select("memory_content")
      .eq("session_id", sessionId)
      .maybeSingle();
    return data?.memory_content?.trim() ?? "";
  } catch {
    return "";
  }
}

async function describeScreenshotsWithVisionModel(
  screenshots: { url: string; base64Image: string }[],
  userQuestion: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || screenshots.length === 0) return "";

  try {
    const content: any[] = [
      {
        type: "text",
        text: `Describe what is visually shown in the following webpage screenshot(s) in detail — layout, key text, images, colors, and anything notable. The user asked: "${userQuestion}". Focus your description on what's relevant to their question.`,
      },
    ];
    for (const shot of screenshots) {
      content.push({
        type: "image_url",
        image_url: { url: shot.base64Image },
      });
    }

    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_FALLBACK_MODEL,
        temperature: 0.7,
        max_tokens: 700,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[vision] Fallback model error:", res.status, errBody.slice(0, 300));
      return "";
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[vision] Exception during vision analysis:", err);
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = body.modelId as NexoModelId;
    const messages = body.messages as IncomingMessage[];
    const sessionId = body.sessionId as string | undefined;
    const isCoderMode = body.isCoderMode as boolean | undefined;

    if (sessionId) {
      const { allowed, remaining, limit } = await checkAndIncrementRateLimit(sessionId, !!isCoderMode);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            message: isCoderMode 
              ? `You've reached your free limit of ${CODER_DAILY_LIMIT} Nexo Coder queries today. Upgrade for unlimited access.`
              : `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} messages. Come back tomorrow, or upgrade for unlimited access.`,
          }),
          { status: 429 }
        );
      }
      void remaining;
      void limit;
    }

    const config = PROVIDER_CONFIG[modelId];
    if (!config) {
      return new Response(JSON.stringify({ error: "Unknown model" }), {
        status: 400,
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENROUTER_API_KEY. Set it in your environment variables.",
        }),
        { status: 500 }
      );
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const webContext = lastUserMessage
      ? await readUrlsFromText(lastUserMessage.content)
      : "";

    // All models here are text-only (no native vision), so any shared link
    // screenshots always get silently routed through the vision fallback
    // model, and the description is woven into the active model's own
    // system prompt. The user only ever talks to the model they picked.
    let visionContext = "";
    if (lastUserMessage) {
      const screenshots = await captureScreenshotsFromText(lastUserMessage.content);
      if (screenshots.length > 0) {
        const description = await describeScreenshotsWithVisionModel(
          screenshots,
          lastUserMessage.content
        );
        if (description) {
          visionContext = screenshots
            .map((s) => `Screenshot of ${s.url}:\n${description}`)
            .join("\n\n");
        }
      }
    }

    const memory = sessionId ? await getUserMemory(sessionId) : "";
    let systemPrompt = memory
      ? `${config.systemPrompt}\n\nThe user has saved the following information for you to always remember about them. Treat this as ground truth and use it naturally in conversation when relevant — for example, if they ask you their name and it's provided below, answer confidently from this:\n"""\n${memory}\n"""`
      : config.systemPrompt;

    if (webContext) {
      systemPrompt += `\n\nThe user's latest message contains one or more web links. The live contents of those pages were fetched and are provided below. Use this content as the primary source of truth when answering questions about the link(s) — summarize, quote, or analyze it as needed, and cite the page title or URL when helpful. If a page could not be read, tell the user briefly and answer from your own knowledge. Reply in the user's language.\n\n===== FETCHED WEB CONTENT =====\n${webContext}\n===== END WEB CONTENT =====`;
    }

    if (visionContext) {
      systemPrompt += `\n\nThe user shared a link, and a visual screenshot of that page was captured and analyzed for you (since you can't view images directly). Here is a description of what the page visually looks like — use it naturally as if you had looked at the page yourself, without mentioning that another system analyzed it:\n\n===== VISUAL PAGE DESCRIPTION =====\n${visionContext}\n===== END VISUAL DESCRIPTION =====`;
    }

    const upstreamRes = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://nexo-app-delta.vercel.app",
        "X-Title": "NEXO AI",
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 1.0,
        top_p: 1.0,
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
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
