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
const voiceRoute = read("app/api/nexo/voice/route.ts");
const panel = read("components/NexoLivePanel.tsx");
const chatInput = read("components/ChatInput.tsx");
const page = read("app/page.tsx");

assert(fs.existsSync(voiceRoutePath), "The isolated primary voice route must exist.");
assert(fs.existsSync(panelPath), "The NEXO Live panel must exist.");
assert(!fs.existsSync(oldRoutePath), "The old temporary Live-token route must be removed.");
assert(!fs.existsSync(oldPanelPath), "The old provider-visible Live panel must be removed.");

assert(voiceRoute.includes("requireVerifiedUser(req)"), "Voice requests must verify the signed-in user.");
assert(voiceRoute.includes("process.env.GEMINI_API_KEY"), "Voice requests must use the primary Gemini API key on the server.");
assert(!voiceRoute.includes("GEMINI_LIVE_API_KEY"), "Voice requests must not use the separate Live API key.");
assert(voiceRoute.includes(":generateContent?key="), "Voice requests must use the primary generate-content endpoint.");
assert(voiceRoute.includes("audioData"), "The primary voice route must accept in-memory audio data.");
assert(voiceRoute.includes("Cache-Control\": \"no-store\""), "Voice responses must not be cached.");
assert(!voiceRoute.includes("supabase"), "The isolated voice route must not introduce database changes.");

assert(panel.includes('authenticatedFetch("/api/nexo/voice"'), "The panel must call only the isolated primary voice route.");
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

assert(chatInput.includes("onOpenLiveTalk?.();"), "The chat microphone must open the isolated NEXO Live panel.");
assert(page.includes("<NexoLivePanel onClose={() => setNexoLiveOpen(false)} />"), "The app shell must mount only the NEXO Live panel.");
assert(!page.includes("GeminiLiveTalkPanel"), "The app shell must not reference the old panel.");

console.log("NEXO Live panel checks passed: primary voice path, NEXO-only UI, protected access, red errors, and isolated entry point.");
