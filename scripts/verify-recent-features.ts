import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

const folders = source("lib/chatFolders.ts");
const search = source("components/SearchModal.tsx");
const searchRoute = source("app/api/chats/search/route.ts");
const rateLimits = source("lib/rateLimits.server.ts");
const usageRoute = source("app/api/usage/route.ts");
const integrationStatusRoute = source("app/api/integrations/status/route.ts");
const integrationsPanel = source("components/IntegrationsPanel.tsx");
const page = source("app/page.tsx");
const timeline = source("components/AgentTimeline.tsx");
const recovery = source("components/ConnectionRecoveryBanner.tsx");
const vercelParser = source("lib/vercelToolParser.ts");
const vercelReadRoute = source("app/api/vercel/deployments/route.ts");

// Folder persistence contracts: each browser session must have an isolated key,
// malformed values must fall back safely, and legacy assignments are migrated.
assert.match(folders, /STORAGE_PREFIX = "nexo:chat-project-folders:"/);
assert.match(folders, /getChatFolderStorageKey\(sessionId: string\)/);
assert.match(folders, /sessionId \|\| "anonymous"/);
assert.match(folders, /return emptyChatFolderState\(\)/);
assert.match(folders, /legacyRaw/);
assert.match(folders, /writeChatFolderState\(sessionId, migrated\)/);

// Search contracts: verified server ownership scope, debounced UI requests, and capped results.
assert.match(search, /authenticatedFetch\(`\/api\/chats\/search\?q=/);
assert.doesNotMatch(search, /from\("chats"\)/);
assert.match(search, /setTimeout\(\(\) => void search\(\), 300\)/);
assert.match(search, /controller\.abort\(\)/);
assert.match(searchRoute, /requireVerifiedUser\(req\)/);
assert.match(searchRoute, /\.eq\("user_id", verified\.user\.id\)/);
assert.match(searchRoute, /\.limit\(20\)/);

// Usage and integration contracts: browser callers cannot identify another
// account's usage or learn configured infrastructure from an anonymous request.
assert.match(rateLimits, /import "server-only"/);
assert.match(rateLimits, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(rateLimits, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(usageRoute, /requireVerifiedUser\(request\)/);
assert.match(usageRoute, /`user:\$\{verified\.user\.id\}`/);
assert.doesNotMatch(usageRoute, /x-session-id/);
assert.match(integrationsPanel, /authenticatedFetch\(\s*`\/api\/supabase\/schema/);
assert.match(integrationStatusRoute, /connected: false/);

// Draft contracts: keep the offline cache bounded and reject GitHub-token-shaped text.
assert.match(page, /MAX_DRAFT_LENGTH/);
assert.match(page, /containsGithubToken\(input\)/);
assert.match(page, /draftScope = user\?\.id \? `user:\$\{user\.id\}`/);
assert.match(page, /draftScope \? `\$\{draftScope\}:\$\{draftId\}`/);

// Activity and recovery contracts: displayed entries must be driven by live request state.
assert.match(page, /<AgentTimeline/);
assert.match(timeline, /streaming/);
assert.match(timeline, /approvalState/);
assert.match(timeline, /attachments/);
assert.match(timeline, /search/);
assert.match(recovery, /navigator\.onLine/);
assert.match(recovery, /addEventListener\("offline"/);
assert.match(recovery, /addEventListener\("online"/);

// Vercel read protocol contracts: only the two read tools are accepted, IDs are bounded,
// internal blocks can be stripped, and deployments use the verified read route.
assert.match(vercelParser, /rawTool === "list_projects"/);
assert.match(vercelParser, /rawTool !== "list_deployments"/);
assert.match(vercelParser, /PROJECT_ID/);
assert.match(vercelParser, /1,160/);
assert.match(vercelParser, /stripVercelReadToolBlocks/);
assert.match(vercelReadRoute, /requireVerifiedUser/);
assert.match(vercelReadRoute, /listDeployments/);
assert.match(vercelReadRoute, /deploymentId/);

console.log("Recent feature contract verification passed: folders, verified search, private usage, integrations, drafts, timeline, recovery, and Vercel reads.");
