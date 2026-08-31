import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { finishNexoVoiceSession } from "@/lib/nexoVoice.server";

export const runtime = "nodejs";

const PRIMARY_VOICE_MODEL = "gemini-2.5-flash";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const TTS_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
] as const;
const MAX_AUDIO_BASE64_LENGTH = 12_000_000;
const MAX_RESPONSE_TOKENS = 700;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function pcmToWavBase64(base64Pcm: string, sampleRate = 24_000, channels = 1, bitsPerSample = 16) {
  const pcm = Buffer.from(base64Pcm, "base64");
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(blockAlign, 32); header.writeUInt16LE(bitsPerSample, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

async function finalizeSession(userId: string, sessionId: string, status: "completed" | "cancelled" = "completed") {
  try { return await finishNexoVoiceSession(userId, sessionId, status); }
  catch (cause) { console.error("NEXO voice session finalization failed", { userId, sessionId, cause: cause instanceof Error ? cause.message : "unknown" }); return null; }
}

function stableVoiceForUser(displayName: string | null) {
  const seed = (displayName?.trim() || "NEXO").normalize("NFKC");
  let hash = 2166136261;
  for (const char of seed) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619); }
  return TTS_VOICES[(hash >>> 0) % TTS_VOICES.length] ?? "Kore";
}

async function synthesizeGeminiVoice(apiKey: string, text: string, displayName: string | null) {
  const voice = stableVoiceForUser(displayName);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: [
            "Synthesize speech for NEXO's complete response.",
            "Use a natural, calm, clear, confident conversational delivery.",
            "Read the transcript exactly and completely. Do not summarize, omit, repeat, or invent words.",
            "Use natural pauses between sentences and a comfortable speaking pace.",
            "The transcript begins after the marker below.",
            "TRANSCRIPT:", text,
          ].join("\n"),
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice }] },
        }),
        cache: "no-store", signal: AbortSignal.timeout(45_000),
      });
      const payload = await response.json().catch(() => ({})) as { output_audio?: { data?: string }; error?: { message?: string } };
      if (!response.ok || !payload.output_audio?.data) throw new Error(payload.error?.message ?? `Voice synthesis failed with status ${response.status}.`);
      return { audioData: pcmToWavBase64(payload.output_audio.data), audioMimeType: "audio/wav" };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Voice synthesis failed.");
}

export async function POST(req: Request) {
  const verified = await requireVerifiedUser(req);
  if (verified.response) return verified.response;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse("Voice service is unavailable right now. Please try again later.", 503);
  let body: { audioData?: unknown; mimeType?: unknown; sessionId?: unknown };
  try { body = await req.json(); } catch { return errorResponse("The voice message could not be read. Please try again.", 400); }
  const audioData = typeof body.audioData === "string" ? body.audioData : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) return errorResponse("The voice session is no longer active. Please retry.", 409);
  if (!audioData || !mimeType.startsWith("audio/") || audioData.length > MAX_AUDIO_BASE64_LENGTH) {
    await finalizeSession(verified.user.id, sessionId); return errorResponse("That voice message is too large or could not be read. Please try a shorter message.", 400);
  }
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_VOICE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [
        { text: "Listen to the user's voice message and reply naturally as Nexo. Give a normal conversational answer with enough detail to be genuinely useful. Do not shorten the answer just because this is voice mode. Usually answer in a few natural sentences or short paragraphs, matching the user's language and the complexity of the question. Reply in the language the user speaks." },
        { inline_data: { mime_type: mimeType, data: audioData } },
      ] }], generationConfig: { temperature: 0.55, maxOutputTokens: MAX_RESPONSE_TOKENS } }),
      cache: "no-store", signal: AbortSignal.timeout(45_000),
    });
    const payload = await upstream.json().catch(() => ({})) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join(" ").trim();
    if (!upstream.ok || !text) { await finalizeSession(verified.user.id, sessionId); return errorResponse("Nexo could not understand that message. Please try again.", upstream.status === 429 ? 429 : 502); }
    let audioDataResponse: string | undefined; let audioMimeType: string | undefined;
    try { const tts = await synthesizeGeminiVoice(apiKey, text, verified.user.displayName); audioDataResponse = tts.audioData; audioMimeType = tts.audioMimeType; }
    catch (ttsError) { console.warn("NEXO voice synthesis unavailable; browser fallback will be used.", { cause: ttsError instanceof Error ? ttsError.message : "unknown" }); }
    const usage = await finalizeSession(verified.user.id, sessionId);
    return Response.json({ text, audioData: audioDataResponse, audioMimeType, voiceProvider: audioDataResponse ? "voice" : "browser-fallback", usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    await finalizeSession(verified.user.id, sessionId); console.error("Nexo voice request failed", { userId: verified.user.id, cause: cause instanceof Error ? cause.message : "unknown" });
    return errorResponse("Voice response could not start. Please check your connection and retry.", 502);
  }
}
