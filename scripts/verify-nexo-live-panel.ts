import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const voiceRoutePath = path.join(root, "app/api/nexo/voice/route.ts");
const panelPath = path.join(root, "components/NexoLivePanel.tsx");
const oldRoutePath = path.join(root, "app/api/gemini-live/token/route.ts");
const oldPanelPath = path.join(root, "components/GeminiLiveTalkPanel.tsx");
const sessionRoute = read("app/api/nexo/voice/session/route.ts");
const usageRoute = read("app/api/nexo/voice/usage/route.ts");
const usageMigration = read("supabase/migrations/20260826_add_nexo_voice_usage.sql");
const voiceRoute = read("app/api/nexo/voice/route.ts");
const panel = read("components/NexoLivePanel.tsx");
const usagePanel = read("components/RateLimitationPanel.tsx");
const chatInput = read("components/ChatInput.tsx");
const page = read("app/page.tsx");

assert(fs.existsSync(voiceRoutePath), "The isolated primary voice route must exist.");
assert(fs.existsSync(panelPath), "The NEXO Live panel must exist.");
assert(fs.existsSync(path.join(root, "app/api/nexo/voice/session/route.ts")), "The voice session route must exist.");
assert(fs.existsSync(path.join(root, "app/api/nexo/voice/usage/route.ts")), "The voice usage route must exist.");
assert(fs.existsSync(path.join(root, "supabase/migrations/20260826_add_nexo_voice_usage.sql")), "The voice usage migration must exist.");
assert(!fs.existsSync(oldRoutePath), "The old temporary Live-token route must be removed.");
assert(!fs.existsSync(oldPanelPath), "The old provider-visible Live panel must be removed.");

assert(voiceRoute.includes("requireVerifiedUser(req)"), "Voice requests must verify the signed-in user.");
assert(voiceRoute.includes("finishNexoVoiceSession"), "Voice requests must finalize a server-side voice session.");
assert(voiceRoute.includes("sessionId"), "Voice requests must bind audio to a server-side session.");
assert(sessionRoute.includes("startNexoVoiceSession"), "Voice sessions must start through the server usage guard.");
assert(sessionRoute.includes("finishNexoVoiceSession"), "Voice sessions must support server-side cancellation.");
assert(usageRoute.includes("getNexoVoiceUsage"), "Voice usage must be read through a protected server route.");
assert(usageMigration.includes("nexo_voice_daily_usage"), "Voice daily usage must have isolated persistence.");
assert(usageMigration.includes("nexo_voice_sessions"), "Voice sessions must have isolated persistence.");
assert(usageMigration.includes("used_seconds"), "Voice usage must be recorded in seconds.");
assert(usageMigration.includes("start_nexo_voice_session"), "Voice starts must use the server database guard.");
assert(usageMigration.includes("finish_nexo_voice_session"), "Voice completion must use the server database guard.");
assert(usageMigration.includes("duration := 0"), "Cancelled voice sessions must not consume daily allowance.");
assert(usageMigration.includes("p_status <> 'cancelled'"), "Only completed voice turns may add daily usage.");
assert(usageMigration.includes("revoke all on table"), "Voice tables must not be browser-readable.");
assert(voiceRoute.includes("process.env.GEMINI_API_KEY"), "Voice requests must use the primary Gemini API key on the server.");
assert(!voiceRoute.includes("GEMINI_LIVE_API_KEY"), "Voice requests must not use the separate Live API key.");
assert(voiceRoute.includes(":generateContent?key="), "Voice requests must use the primary generate-content endpoint.");
assert(voiceRoute.includes("medium-length spoken reply"), "Voice replies must use medium-length guidance.");
assert(voiceRoute.includes("maxOutputTokens: 420"), "Voice replies must allow a moderate response length.");
assert(voiceRoute.includes("audioData"), "The primary voice route must accept in-memory audio data.");
assert(voiceRoute.includes("Cache-Control\": \"no-store\""), "Voice responses must not be cached.");
assert(!voiceRoute.includes("supabase"), "The isolated voice route must not introduce database changes.");

assert(panel.includes('authenticatedFetch("/api/nexo/voice/session"'), "The panel must start a protected voice session before recording.");
assert(panel.includes('authenticatedFetch("/api/nexo/voice"'), "The panel must call only the isolated primary voice route.");
assert(panel.includes("authenticatedFetch(\"/api/nexo/voice/session\", {"), "The panel must close abandoned sessions safely.");
assert(panel.includes("NEXO Live"), "The panel must use NEXO Live branding.");
assert(panel.includes("Listening"), "The panel must show the listening state.");
assert(panel.includes("Nexo is speaking"), "The panel must show the speaking state.");
assert(panel.includes("Microphone"), "The panel must show microphone status.");
assert(panel.includes("Connected"), "The panel must show connection status.");
assert(panel.includes("Voice connection error"), "The panel must show a neutral voice error heading.");
assert(panel.includes("border-red-400"), "The panel must use a visible red error state.");
assert(panel.includes("Retry"), "The panel must provide a retry control.");
assert(!panel.includes("Gemini"), "The visible panel must not expose provider names.");
assert(!panel.includes("API key"), "The visible panel must not expose API-key wording.");
assert(!panel.includes("GEMINI_"), "The visible panel must not contain environment key names.");
assert(panel.includes("MediaRecorder"), "The panel must capture voice turns locally before submitting them.");
assert(panel.includes("createAnalyser"), "The panel must analyse microphone input for the live waveform.");
assert(panel.includes("getByteTimeDomainData"), "The waveform must use the real microphone signal.");
assert(panel.includes("speechSynthesis.speak"), "The panel must play the Nexo response aloud.");
assert(panel.includes("selectMaleVoice"), "Playback must prefer a male voice when available.");
assert(panel.includes("si-LK"), "Sinhala playback must use a Sinhala language fallback.");
assert(panel.includes("en-US"), "English playback must use an English language fallback.");
assert(panel.includes("utterance.pitch = 0.82"), "Playback must use a professional lower voice pitch.");
assert(panel.includes("setAudioLevel"), "The panel must update waveform state from microphone audio.");
assert(panel.includes("closingRef"), "The panel must discard recorder callbacks after End Talk or cleanup.");
assert(panel.includes("shouldDiscard"), "The panel must not submit audio after a session is closed.");
assert(panel.includes("speechDetectedRef"), "The panel must detect real user speech before auto-submitting.");
assert(panel.includes("silenceStartedAtRef"), "The panel must finish a turn quickly after the user stops speaking.");
assert(panel.includes("userIsSpeaking"), "Waveform and turn completion must react to microphone activity.");
assert(panel.includes("voiceState === \"idle\") void startRecording"), "The panel must automatically enter capture mode when opened.");
assert(panel.includes("microphone starts automatically"), "The panel must tell the user that capture starts automatically.");
assert(usagePanel.includes('authenticatedFetch("/api/nexo/voice/usage"'), "The usage panel must fetch NEXO Live usage through the protected route.");
assert(usagePanel.includes("NEXO Live"), "The usage panel must show NEXO Live usage.");
assert(usagePanel.includes("Daily voice allowance"), "The usage panel must show the voice allowance label.");
assert(usagePanel.includes("20:00 available each day"), "The usage panel must show the 20-minute daily allowance.");

assert(chatInput.includes("onOpenLiveTalk?.();"), "The chat microphone must open the isolated NEXO Live panel.");
assert(page.includes("<NexoLivePanel onClose={() => setNexoLiveOpen(false)} />"), "The app shell must mount only the NEXO Live panel.");
assert(!page.includes("GeminiLiveTalkPanel"), "The app shell must not reference the old panel.");

console.log("NEXO Live panel checks passed: primary voice path, protected session accounting, real waveform/playback, NEXO-only UI, red errors, and visible daily allowance.");
