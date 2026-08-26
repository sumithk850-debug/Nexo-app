import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tokenRoute = read("app/api/gemini-live/token/route.ts");
const panel = read("components/GeminiLiveTalkPanel.tsx");
const chatInput = read("components/ChatInput.tsx");
const page = read("app/page.tsx");

assert(tokenRoute.includes('process.env.GEMINI_LIVE_API_KEY'), "Gemini Live route must use only GEMINI_LIVE_API_KEY.");
assert(!tokenRoute.includes("GEMINI_API_KEY"), "Gemini Live route must not use the regular Gemini API key.");
assert(tokenRoute.includes("requireVerifiedUser(req)"), "Gemini Live route must verify the signed-in user.");
assert(tokenRoute.includes("auth_tokens"), "Gemini Live route must provision a temporary Live token.");
assert(tokenRoute.includes("uses: 1"), "Gemini Live temporary tokens must be single-use.");
assert(tokenRoute.includes('responseModalities: ["AUDIO"]'), "Gemini Live token must constrain the connection to audio responses.");
assert(!tokenRoute.includes("supabase"), "Gemini Live route must not introduce database access.");

assert(panel.includes('authenticatedFetch("/api/gemini-live/token"'), "Panel must call only the protected Gemini Live token route.");
assert(panel.includes("Gemini Live error"), "Panel must expose a visible red error heading.");
assert(panel.includes("border-red-400"), "Panel must render temporary red error styling.");
assert(panel.includes("new GoogleGenAI({ apiKey: tokenPayload.token })"), "Panel must connect with a temporary token, not a production key.");
assert(panel.includes("sendRealtimeInput"), "Panel must stream microphone PCM audio to the Live session.");
assert(panel.includes("End Talk"), "Panel must provide an explicit end control.");
assert(!panel.includes("GEMINI_API_KEY"), "Panel must never contain a Gemini API key reference.");

assert(chatInput.includes("onOpenLiveTalk?.();"), "Chat microphone entry must open the isolated Live Talk flow.");
assert(page.includes("<GeminiLiveTalkPanel onClose={() => setGeminiLiveOpen(false)} />"), "Main app shell must mount the panel only when requested.");

console.log("Gemini Live panel checks passed: protected temporary token, isolated UI, audio streaming, and visible red error state.");
