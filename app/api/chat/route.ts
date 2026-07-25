import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIG } from "@/lib/providers.server";
import { extractUrls, readUrlsForModel } from "@/lib/urlReader.server";
import type { NexoModelId } from "@/lib/models";

export const runtime = "nodejs";

interface IncomingAttachment {
  name: string;
  type: string;
  size: number;
  kind: "image" | "document";
  dataUrl?: string;
  text?: string;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: IncomingAttachment[];
}

type ProviderMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

const GITHUB_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DAILY_MESSAGE_LIMIT = 50;
const CODER_DAILY_LIMIT = 5;

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

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const latestUrls = lastUserMessage ? extractUrls(lastUserMessage.content) : [];
    const webResult = lastUserMessage
      ? await readUrlsForModel(lastUserMessage.content)
      : { context: "", imageUrls: [] };
    const webContext = webResult.context;
    const uploadedImageUrls = (lastUserMessage?.attachments ?? [])
      .filter((file) => file.kind === "image" && file.dataUrl)
      .map((file) => file.dataUrl as string);
    const documentContext = (lastUserMessage?.attachments ?? [])
      .filter((file) => file.kind === "document")
      .map((file) =>
        file.text
          ? `Document: ${file.name} (${file.type || "unknown"}, ${file.size} bytes)\n${file.text.slice(0, 12000)}`
          : `Document: ${file.name} (${file.type || "unknown"}, ${file.size} bytes)\nNo extractable text was available from this file. Ask the user to paste text if needed.`
      )
      .join("\n\n----------\n\n");
    const visionImageUrls = [...uploadedImageUrls, ...webResult.imageUrls].slice(0, 8);
    const shouldAttachImages = config.provider === "github" && visionImageUrls.length > 0;

    const memory = sessionId ? await getUserMemory(sessionId) : "";
    let systemPrompt = memory
      ? `${config.systemPrompt}\n\nThe user has saved the following information for you to always remember about them. Treat this as ground truth and use it naturally in conversation when relevant — for example, if they ask you their name and it's provided below, answer confidently from this:\n"""\n${memory}\n"""`
      : config.systemPrompt;

    if (webContext || documentContext || shouldAttachImages) {
      systemPrompt += `\n\nThe user's latest message may include web links and uploaded files. Any fetched page text and extracted document text are provided below. Use that content as the primary source of truth when answering questions about links or documents. If images are attached, visually inspect them and combine what you see with the page/document text instead of relying on alt text only. Start the final answer with a short acknowledgement that you checked the link or attachment, then organize the result under useful subheadings such as "Link", "Document", "Images", and "Summary" when relevant. If a page or file could not be read, tell the user briefly and answer from your own knowledge. Reply in the user's language.\n\n===== FETCHED WEB CONTENT =====\n${webContext || "No fetched web text."}${documentContext ? `\n\n===== UPLOADED DOCUMENTS =====\n${documentContext}\n===== END UPLOADED DOCUMENTS =====` : ""}\n===== END WEB CONTENT =====`;
    }


    const providerMessages: Array<{ role: "system" | "user" | "assistant"; content: ProviderMessageContent }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m, index) => {
        const isLatestLinkedUserMessage =
          shouldAttachImages &&
          m.role === "user" &&
          index === messages.length - 1;

        if (!isLatestLinkedUserMessage) {
          return { role: m.role, content: m.content };
        }

        return {
          role: m.role,
          content: [
            { type: "text" as const, text: m.content },
            ...visionImageUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        };
      }),
    ];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (latestUrls.length > 0) {
          controller.enqueue(
            encoder.encode(
              `හරි, මට පුළුවන් — මම ඔබේ link එක පරීක්ෂා කරනවා.\n\n### Link පරීක්ෂාව\n- Open කරනවා: ${latestUrls.slice(0, 2).join(", ")}\n- Page text සහ images කියවනවා...\n\n`
            )
          );
        }
        try {
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
              messages: providerMessages,
            }),
          });

          if (!upstreamRes.ok || !upstreamRes.body) {
            const errText = await upstreamRes.text().catch(() => "Unknown error");
            controller.enqueue(
              encoder.encode(`\nමට link එක පරීක්ෂා කිරීමේදී provider error එකක් ආවා: ${errText}`)
            );
            controller.close();
            return;
          }

          const reader = upstreamRes.body.getReader();
          let buffer = "";

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
