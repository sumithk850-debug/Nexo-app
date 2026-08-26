import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectIncludes(source: string, expected: string, label: string) {
  assert(source.includes(expected), `${label} is missing: ${expected}`);
}

function expectExcludes(source: string, forbidden: string, label: string) {
  assert(!source.includes(forbidden), `${label} must not contain: ${forbidden}`);
}

const tokenRoute = read("app/api/live-talk/token/route.ts");
const sessionRoute = read("app/api/live-talk/session/route.ts");
const preferencesRoute = read("app/api/live-talk/preferences/route.ts");
const screen = read("components/LiveTalkScreen.tsx");
const input = read("components/ChatInput.tsx");
const page = read("app/page.tsx");
const usageRoute = read("app/api/usage/route.ts");
const helper = read("lib/liveTalk.server.ts");
const migration = read("supabase/migrations/20260826_add_live_talk_isolation.sql");
const sessionGuardMigration = read("supabase/migrations/20260826_prevent_parallel_live_sessions.sql");
const serializationMigration = read("supabase/migrations/20260826_serialize_live_session_starts.sql");
const packageJson = read("package.json");

expectIncludes(tokenRoute, "requireVerifiedUser(request)", "Live token route");
expectIncludes(tokenRoute, "process.env.GEMINI_LIVE_API_KEY", "Live token route");
expectIncludes(tokenRoute, "auth_tokens", "Live token route");
expectIncludes(tokenRoute, "liveConnectConstraints", "Live token route");
expectIncludes(tokenRoute, "responseModalities: [\"AUDIO\"]", "Live token route");
expectIncludes(tokenRoute, "uses: 1", "Live token route");
expectIncludes(tokenRoute, "newSessionExpireTime", "Live token route");
expectIncludes(tokenRoute, "lockAdditionalFields: []", "Live token route");
expectIncludes(tokenRoute, 'started.status === "active"', "Live token route");
expectExcludes(tokenRoute, "NEXT_PUBLIC_GEMINI_LIVE", "Live token route");

expectIncludes(sessionRoute, "requireVerifiedUser(request)", "Live session route");
expectIncludes(sessionRoute, "finishLiveTalkSession", "Live session route");
expectIncludes(preferencesRoute, "requireVerifiedUser(request)", "Live preferences route");
expectIncludes(preferencesRoute, "saveLiveTalkPreferences", "Live preferences route");

expectIncludes(screen, "authenticatedFetch(\"/api/live-talk/token\"", "Live Talk screen");
expectIncludes(screen, "navigator.mediaDevices.getUserMedia", "Live Talk screen");
expectIncludes(screen, "echoCancellation: true", "Live Talk screen");
expectIncludes(screen, "noiseSuppression: true", "Live Talk screen");
expectIncludes(screen, "autoGainControl: true", "Live Talk screen");
expectIncludes(screen, "content?.interrupted", "Live Talk screen");
expectIncludes(screen, "stopPlayback()", "Live Talk screen");
expectIncludes(screen, "authenticatedFetch(\"/api/live-talk/session\"", "Live Talk screen");
expectIncludes(screen, "const config = {};", "Live Talk screen");
expectExcludes(screen, "GEMINI_LIVE_API_KEY", "Live Talk screen");
expectExcludes(screen, "GEMINI_API_KEY", "Live Talk screen");

expectIncludes(input, "onOpenLiveTalk", "Chat input");
expectExcludes(input, "SpeechRecognition", "Chat input");
expectIncludes(page, "<LiveTalkScreen", "Authenticated app shell");
expectIncludes(page, "onOpenLiveTalk={() => setLiveTalkOpen(true)}", "Chat input mount");
expectIncludes(usageRoute, "getLiveTalkUsage", "Usage route");

expectIncludes(helper, 'import "server-only"', "Live Talk helper");
expectIncludes(helper, "LIVE_TALK_DAILY_LIMIT_SECONDS = 20 * 60", "Live Talk helper");
expectIncludes(migration, "live_talk_preferences", "Live Talk migration");
expectIncludes(migration, "live_talk_daily_usage", "Live Talk migration");
expectIncludes(migration, "live_talk_sessions", "Live Talk migration");
expectIncludes(migration, "enable row level security", "Live Talk migration");
expectIncludes(migration, "revoke all on table public.live_talk_sessions from public, anon, authenticated", "Live Talk migration");
expectIncludes(migration, "grant execute on function public.start_live_talk_session(uuid) to service_role", "Live Talk migration");
expectExcludes(migration, "raw_audio", "Live Talk migration");
expectIncludes(sessionGuardMigration, "live_talk_one_active_session_per_user_idx", "NEXO Live session guard migration");
expectIncludes(sessionGuardMigration, "where status = 'active'", "NEXO Live session guard migration");
expectIncludes(serializationMigration, "pg_advisory_xact_lock", "NEXO Live session serialization migration");
expectIncludes(packageJson, '"@google/genai"', "Package dependencies");

console.log("Live Talk security and isolation checks passed.");
