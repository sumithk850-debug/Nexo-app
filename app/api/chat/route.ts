import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIG } from "@/lib/providers.server";
import { readUrlsFromText, captureScreenshotsFromText } from "@/lib/urlReader.server";
import { buildGithubContext } from "@/lib/githubContext.server";
import type { NexoModelId } from "@/lib/models";
import { recordTokenUsage } from "@/lib/rateLimits.server";

export const runtime = "nodejs";
// Preserve enough execution time for one bounded primary attempt plus a fast
// fallback response; the request loop itself stays deliberately much shorter.
export const maxDuration = 60;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DAILY_MESSAGE_LIMIT = 50;
const CODER_DAILY_LIMIT = 5;

const REPOSITORY_ACTION_PROTOCOL = `
REPOSITORY ACTION PROTOCOL (MANDATORY FOR EVERY NEXO MODEL):
- When the user asks to read, create, edit, or delete repository files, perform the task through NEXO's repository workflow; do not paste implementation code as the answer.
- Start every repository task with one short sentence in the user's language that clearly says you are starting the requested work. Do not claim it is finished in this opening sentence.
- Announce each operation on its own line with exactly one marker: [READING FILE] path, [CREATING FILE] path, [EDITING FILE] path, or [DELETING FILE] path.
- For an existing-file edit, follow its marker with one \`\`\`diff:path/to/file.ext block containing only removed (-) and added (+) lines.
- For a new file, follow its marker with one \`\`\`language:path/to/file.ext block containing the complete new file.
- For deletion, emit only the deletion marker. Never include deleted file contents.
- Mutating actions pause for explicit user approval. Never claim a change was committed before approval.
- Keep prose brief. File bodies and diffs are rendered as live task cards and must not be repeated in normal prose.
- End every repository task with a concise report in the user's language under a "Task report" heading. Summarize what was read, created, edited, or proposed for deletion and the result. For proposed mutations, explicitly say they are waiting for approval rather than committed. Never repeat code, diffs, or full file contents in this report.
`;

// Output budgets. These are deliberately generous: replies were getting cut
// off mid-sentence (and mid-diff, which corrupts a proposed edit), so every
// model now gets a much larger completion window.
const MODEL_TOKEN_LIMITS: Partial<Record<NexoModelId, number>> = {
  "nexio-1.1": 8192,
  "spadec-3.5": 8192,
  "galex-4.0": 16384,
  "brainex-10.8": 16384,
  "craft-v3": 32768,
};

// Vision-capable fallback model, also served via OpenRouter, used to analyze
// screenshots for models that can't natively see images.
const VISION_FALLBACK_MODEL = "nvidia/nemotron-nano-12b-2-vl:free";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function checkRateLimit(sessionId: string, isCoder: boolean): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const column = isCoder ? "coder_count" : "message_count";
  const limit = isCoder ? CODER_DAILY_LIMIT : DAILY_MESSAGE_LIMIT;

  const { data: existing, error } = await supabase
    .from("rate_limits")
    .select("message_count, coder_count")
    .eq("session_id", sessionId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read usage data: ${error.message}`);
  }

  const currentCount = Number(existing?.[column] ?? 0);
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  return { allowed: true, remaining: limit - currentCount - 1, limit };
}

async function incrementRateLimit(sessionId: string, isCoder: boolean): Promise<void> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const column = isCoder ? "coder_count" : "message_count";

  const { data: existing, error: readError } = await supabase
    .from("rate_limits")
    .select("message_count, coder_count")
    .eq("session_id", sessionId)
    .eq("date", today)
    .maybeSingle();

  if (readError) {
    throw new Error(`Could not read usage data before update: ${readError.message}`);
  }

  const updateData: Record<string, number | string> = {
    session_id: sessionId,
    date: today,
    [column]: Number(existing?.[column] ?? 0) + 1,
  };

  const { error: writeError } = await supabase
    .from("rate_limits")
    .upsert(updateData, { onConflict: "session_id,date" });

  if (writeError) {
    throw new Error(`Could not save message usage: ${writeError.message}`);
  }
}

async function getUserMemory(sessionId: string): Promise<any> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("user_settings")
      .select("memory_content, custom_persona, search_grounding_enabled, code_review_enabled")
      .eq("session_id", sessionId)
      .maybeSingle();
    return {
      memory: data?.memory_content?.trim() ?? "",
      persona: data?.custom_persona?.trim() ?? "",
      searchGrounding: data?.search_grounding_enabled ?? true,
      codeReview: data?.code_review_enabled ?? false,
    } as any;
  } catch { return { memory: "", persona: "", searchGrounding: true, codeReview: false } as any; }
}

async function describeUploadedImagesWithVisionModel(
  images: { base64Image: string }[],
  userQuestion: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || images.length === 0) return "";

  try {
    const content: any[] = [
      {
        type: "text",
        text: `Describe what is visually shown in the following uploaded image(s) in detail — content, objects, people, text, colors, and anything notable. The user asked: "${userQuestion}". Focus your description on what's relevant to their question.`,
      },
    ];
    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: img.base64Image },
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
      console.error("[vision] Uploaded image description error:", res.status, errBody.slice(0, 300));
      return "";
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[vision] Exception during uploaded image description:", err);
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
    // The user's actual auth/user id, distinct from sessionId, used to look up
    // their GitHub connection. Sent by the client alongside sessionId.
    const userId = body.userId as string | undefined;
    const isCoderMode = body.isCoderMode as boolean | undefined;
    const activePersona = body.persona as string | undefined;

    if (sessionId) {
      const { allowed, remaining, limit } = await checkRateLimit(sessionId, !!isCoderMode);
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

    const apiKey = config.provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      const keyName = config.provider === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY";
      return new Response(
        JSON.stringify({
          error: `Missing ${keyName}. Set it in your environment variables.`,
        }),
        { status: 500 }
      );
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const webContext = lastUserMessage
      ? await readUrlsFromText(lastUserMessage.content)
      : "";

    // All models here are text-only (no native vision), so any shared link
    // screenshots and uploaded images always get silently routed through the
    // vision fallback model, and the description is woven into the active
    // model's own system prompt. The user only ever talks to the model they picked.
    let visionContext = "";
    let uploadedImageDescription = "";

    // Handle uploaded images (base64 data sent from client)
    const uploadedImages = body.uploadedImages as { base64Image: string }[] | undefined;
    if (uploadedImages && uploadedImages.length > 0 && lastUserMessage) {
      const description = await describeUploadedImagesWithVisionModel(
        uploadedImages,
        lastUserMessage.content
      );
      if (description) {
        uploadedImageDescription = description;
      }
    }

    // Handle web link screenshots
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

    // GitHub context: only fetched for the coder model, since only Craft V3's
    // system prompt claims repo access and the tree/file fetch costs extra
    // GitHub API calls we don't want to pay on every free-tier chat message.
    let githubContextBlock = "";
    if (userId && lastUserMessage) {
      const githubContext = await buildGithubContext(userId, lastUserMessage.content);
      githubContextBlock = githubContext.contextBlock;
    }

    const userMem = sessionId ? await getUserMemory(sessionId) : { memory: "", persona: "", searchGrounding: true, codeReview: false };
    const memory = userMem.memory;
    const customPersona = userMem.persona;
    const searchGroundingEnabled = userMem.searchGrounding ?? true;
    const codeReviewEnabled = userMem.codeReview ?? false;
    const basePrompt = customPersona || config.systemPrompt;
    
    let activePersonaPrompt = "";
    if (activePersona === "react") {
      activePersonaPrompt = "You are a React Expert. You provide advanced, optimized React and Next.js code using modern hooks and patterns.";
    } else if (activePersona === "copywriter") {
      activePersonaPrompt = "You are a professional Copywriter. You write compelling, persuasive, and clear copy for marketing, emails, and web pages.";
    } else if (activePersona === "analyst") {
      activePersonaPrompt = "You are a Data Analyst. You explain data, statistics, and trends clearly, and provide structured insights.";
    }

    let systemPrompt = memory
      ? `${basePrompt}\n\n${activePersonaPrompt}\n\nThe user has saved the following information for you to always remember about them. Treat this as ground truth and use it naturally in conversation when relevant — for example, if they ask you their name and it's provided below, answer confidently from this:\n"""\n${memory}\n"""`
      : `${basePrompt}\n\n${activePersonaPrompt}`;

    // Code Review Mode: deep code analysis instructions for Craft V3
    if (codeReviewEnabled && modelId === "craft-v3") {
      systemPrompt += `\n\nCODE REVIEW MODE IS ACTIVE. For any code the user shares or asks about, provide a thorough code review including:\n- Code quality assessment (cleanliness, readability, maintainability)\n- Bug detection and potential issues\n- Performance optimization suggestions\n- Security vulnerability analysis\n- Best practices and improvement recommendations\n- Architecture and design pattern suggestions\nStructure your review with clear sections and use code examples where helpful.`;
    }

    if (webContext) {
      systemPrompt += `\n\nThe user's latest message contains one or more web links. The live contents of those pages were fetched and are provided below. Use this content as the primary source of truth when answering questions about the link(s) — summarize, quote, or analyze it as needed, and cite the page title or URL when helpful. If a page could not be read, tell the user briefly and answer from your own knowledge. Reply in the user's language.\n\n===== FETCHED WEB CONTENT =====\n${webContext}\n===== END WEB CONTENT =====`;
    }

    if (visionContext) {
      systemPrompt += `\n\nThe user shared a link, and a visual screenshot of that page was captured and analyzed for you (since you can't view images directly). Here is a description of what the page visually looks like — use it naturally as if you had looked at the page yourself, without mentioning that another system analyzed it:\n\n===== VISUAL PAGE DESCRIPTION =====\n${visionContext}\n===== END VISUAL DESCRIPTION =====`;
    }

    if (uploadedImageDescription) {
      systemPrompt += `\n\nThe user uploaded an image, and it was analyzed for you (since you can't view images directly). Here is a detailed description of what the image contains — use it naturally as if you had looked at the image yourself, without mentioning that another system analyzed it:\n\n===== UPLOADED IMAGE DESCRIPTION =====\n${uploadedImageDescription}\n===== END IMAGE DESCRIPTION =====`;
    }

    if (githubContextBlock) {
      systemPrompt += `${githubContextBlock}\n${REPOSITORY_ACTION_PROTOCOL}`;
    }

    const isGemini = config.provider === "gemini";
    let activeProviderModel = config.model;
    const upstreamUrl = isGemini
      ? `https://generativelanguage.googleapis.com/v1beta/models/${activeProviderModel}:streamGenerateContent?alt=sse`
      : OPENROUTER_ENDPOINT;

    const buildUpstreamBody = () =>
      isGemini
        ? {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 1.0,
              topP: 1.0,
              maxOutputTokens: MODEL_TOKEN_LIMITS[modelId] ?? 8192,
            },
            ...(searchGroundingEnabled ? { tools: [{ google_search: {} }] } : {}),
          }
        : {
            model: activeProviderModel,
            stream: true,
            temperature: 1.0,
            top_p: 1.0,
            max_tokens: MODEL_TOKEN_LIMITS[modelId] ?? 8192,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          };

    const buildUpstreamHeaders = (): Record<string, string> =>
      isGemini
        ? {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          }
        : {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://nexo-app-delta.vercel.app",
            "X-Title": "NEXO AI",
          };

    // A free provider can be briefly queued or exhausted. Bound every request
    // and then try the profile's next free route rather than leaving the user in
    // an endless thinking state.
    // Prefer a known-good fallback instead of spending the whole function
    // budget retrying a queued free route. This keeps every profile responsive
    // even when its preferred upstream is temporarily unavailable.
    const MAX_RETRIES_PER_MODEL = 0;
    const UPSTREAM_REQUEST_TIMEOUT_MS = 10_000;
    let upstreamRes: Response | null = null;
    let lastProviderError: unknown = null;
    const candidateModels = [config.model, ...(config.fallbackModels ?? [])];

    providerAttempt:
    for (const candidateModel of candidateModels) {
      activeProviderModel = candidateModel;
      
      // Dynamic upstream URL: switch to OpenRouter if we are using a fallback model for a Gemini profile
      const isCandidateGemini = candidateModel.startsWith("gemini-") || (isGemini && candidateModel === config.model);
      const currentUpstreamUrl = isCandidateGemini
        ? `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:streamGenerateContent?alt=sse`
        : OPENROUTER_ENDPOINT;

      const currentIsGemini = isCandidateGemini;

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          // Re-build headers and body for each candidate as the provider might change
          const currentHeaders = currentIsGemini
            ? { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" }
            : {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
                "HTTP-Referer": "https://nexo-app-delta.vercel.app",
                "X-Title": "NEXO AI",
              };

          const currentBody = currentIsGemini
            ? {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: messages.map((m) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }],
                })),
                generationConfig: {
                  temperature: 1.0,
                  topP: 1.0,
                  maxOutputTokens: MODEL_TOKEN_LIMITS[modelId] ?? 8192,
                },
                ...(searchGroundingEnabled ? { tools: [{ google_search: {} }] } : {}),
              }
            : {
                model: candidateModel,
                stream: true,
                temperature: 1.0,
                top_p: 1.0,
                max_tokens: MODEL_TOKEN_LIMITS[modelId] ?? 8192,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                ],
              };

          upstreamRes = await fetch(currentUpstreamUrl, {
            method: "POST",
            headers: currentHeaders,
            body: JSON.stringify(currentBody),
            signal: AbortSignal.timeout(UPSTREAM_REQUEST_TIMEOUT_MS),
          });
        } catch (error) {
          lastProviderError = error;
          upstreamRes = null;
          console.warn(`[chat] Provider request timed out or failed for ${candidateModel}`, error);
        }

        if (upstreamRes?.ok && upstreamRes.body) {
          break providerAttempt;
        }

        const status = upstreamRes?.status ?? 0;
        const isTransient = status === 0 || status === 429 || status === 502 || status === 503;
        if (isTransient && attempt < MAX_RETRIES_PER_MODEL) {
          const delay = 1_000;
          console.log(`[chat] Provider unavailable (${status || "timeout"}), retrying ${candidateModel} in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // This route is exhausted; continue with the next free fallback model.
        break;
      }
    }

    void lastProviderError;

    if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) {
      const status = upstreamRes?.status ?? 0;
      const errBody = await upstreamRes?.text().catch(() => "") ?? "";
      let errMsg = "Something went wrong reaching NEXO. Please try again.";

      if (status === 429) {
        errMsg = "The AI provider is temporarily busy. Please wait a moment and try again.";
      } else if (status === 502 || status === 503) {
        errMsg = "The AI provider is temporarily unavailable. Please try again in a moment.";
      } else if (status === 500) {
        errMsg = "An internal error occurred on the AI provider side. Please try again.";
      } else if (status >= 400 && status < 500) {
        errMsg = "There was an issue with your request. Please try again.";
      } else if (status === 0) {
        errMsg = "Could not reach the AI provider. Please check your connection and try again.";
      }

      console.error("[chat] Upstream provider error after retries:", status, errBody.slice(0, 500));

      return new Response(
        JSON.stringify({ error: "upstream_error", message: errMsg }),
        { status: 502 }
      );
    }

    // A provider has accepted the request, so this completed request now counts.
    // Failed/busy provider attempts do not consume a user's NEXO message allowance.
    if (sessionId) {
      await incrementRateLimit(sessionId, !!isCoderMode);
      // Persist prompt usage at acceptance time. Completion usage is added when
      // the stream ends, so dashboard totals remain truthful even if a provider
      // stalls after accepting a request.
      await recordTokenUsage(sessionId, modelId, lastUserMessage?.content ?? "", "");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const upstreamReader = upstreamRes.body!.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamReader;
        let buffer = "";
        let responseText = "";
        let usageRecorded = false;

        const persistTokenUsage = async () => {
          if (usageRecorded || !sessionId) return;
          usageRecorded = true;
          await recordTokenUsage(sessionId, modelId, "", responseText);
        };

        try {
          while (true) {
            const { done, value } = await Promise.race([
              reader.read(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("UPSTREAM_STREAM_IDLE_TIMEOUT")),
                  45_000
                )
              ),
            ]);
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                await persistTokenUsage();
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                if (isGemini) {
                  const parts = json.candidates?.[0]?.content?.parts ?? [];
                  const textParts = parts.map((part: { text?: string }) => part.text ?? "").join("");
                  if (textParts) {
                    responseText += textParts;
                    controller.enqueue(encoder.encode(textParts));
                  }
                  // Built-in Google Search: when the model decides to search the
                  // web, the stream emits a part with a `googleSearchCall`
                  // field containing the queries it executed. Relay that back
                  // to the client as a [NEXO:SEARCHING ...] marker so the UI
                  // can show a "Searching..." pill in the live status bar.
                  for (const part of parts) {
                    if (part?.googleSearchCall?.arguments?.queries?.length) {
                      const queries = part.googleSearchCall.arguments.queries.join(", ");
                      controller.enqueue(encoder.encode(`\n[NEXO:SEARCHING ${queries}]\n`));
                    }
                  }
                } else {
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) {
                    responseText += delta;
                    controller.enqueue(encoder.encode(delta));
                  }
                }
              } catch {
                // ignore malformed keep-alive lines
              }
            }
          }
          await persistTokenUsage();
          controller.close();
        } catch (err) {
          await persistTokenUsage();
          try {
            await reader.cancel(err);
          } catch {
            // The upstream stream may already be closed.
          }
          controller.error(err);
        }
      },
      async cancel() {
        // The browser aborted the request (user navigated away or pressed
        // stop) — release the upstream connection instead of leaking it.
        try {
          await upstreamReader.cancel();
        } catch {
          // already closed
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
