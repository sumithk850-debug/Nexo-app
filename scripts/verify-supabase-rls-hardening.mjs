import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const admin = read("../lib/supabaseAdmin.server.ts");
const chats = read("../app/api/chats/route.ts");
const messages = read("../app/api/chats/[id]/messages/route.ts");
const chatApi = read("../app/api/chat/route.ts");
const usage = read("../app/api/usage/route.ts");
const page = read("../app/page.tsx");
const rateLimits = read("../lib/rateLimits.server.ts");
const migration = read("../supabase/migrations/20261017091539_harden_public_rls_chat_usage.sql");

assert.match(admin, /import ["']server-only["']/);
assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(chats, /getSupabaseAdmin/);
assert.match(chats, /\.eq\("session_id", sessionId\)/);
assert.match(chats, /isValidSessionId/);
assert.match(messages, /getSupabaseAdmin/);
assert.match(messages, /findOwnedChat/);
assert.match(messages, /Chat not found for this session/);
assert.match(chatApi, /getSupabaseAdmin/);
assert.match(chatApi, /Invalid or missing session/);
assert.match(usage, /Invalid or missing session/);
assert.match(page, /"x-session-id": sessionId/);
assert.match(page, /JSON\.stringify\(\{ role, content, modelId, sessionId \}\)/);
assert.match(rateLimits, /import ["']server-only["']/);
assert.match(rateLimits, /getSupabaseAdmin/);
assert.doesNotMatch(rateLimits, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(migration, /revoke all privileges on table public\.chats from public, anon, authenticated/i);
assert.match(migration, /revoke all privileges on table public\.messages from public, anon, authenticated/i);
assert.match(migration, /revoke all privileges on table public\.rate_limits from public, anon, authenticated/i);
assert.match(migration, /create policy "Public can read announcements"/i);
assert.doesNotMatch(migration, /create policy "Allow all access to (chats|messages|rate_limits|announcements)"/i);

console.log("Supabase RLS hardening source checks passed.");
