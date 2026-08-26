import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const chatsRoute = read("app/api/chats/route.ts");
const messagesRoute = read("app/api/chats/[id]/messages/route.ts");
const migration = read("supabase/migrations/20260825_secure_chat_history.sql");
const page = read("app/page.tsx");

assert.match(chatsRoute, /requireVerifiedUser\(req\)/, "Chat CRUD must require a verified user.");
assert.match(chatsRoute, /\.eq\("user_id", verified\.user\.id\)/, "Chat reads and mutations must scope to the verified owner.");
assert.match(chatsRoute, /user_id: verified\.user\.id/, "New chats must persist the verified owner.");
assert.match(messagesRoute, /requireVerifiedUser\(req\)/, "Message routes must require a verified user.");
assert.match(messagesRoute, /findOwnedChat\(/, "Message routes must verify parent-chat ownership.");
assert.doesNotMatch(messagesRoute, /createClient\(/, "Message routes must not use an unrestricted browser client.");
assert.match(page, /authenticatedFetch\(`\/api\/chats\?sessionId=/, "Chat history calls must send the verified session token.");
assert.match(page, /authenticatedFetch\(`\/api\/chats\/\$\{encodeURIComponent\(chatId\)\}\/messages/, "Message calls must send the verified session token.");
assert.match(migration, /to authenticated/, "Chat policies must only apply to authenticated users.");
assert.match(migration, /user_id = auth\.uid\(\)/, "Chat policies must enforce owner identity.");
assert.doesNotMatch(migration, /qual \(true\)|with check \(true\)/i, "The migration must not reintroduce unrestricted policies.");

console.log("Chat ownership regression checks passed.");
