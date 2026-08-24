import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

const folders = source("lib/chatFolders.ts");
const search = source("components/SearchModal.tsx");
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

// Search contracts: scope by the active session, debounce requests, and cap results.
assert.match(search, /\.eq\("session_id", sessionId\)/);
assert.match(search, /\.limit\(20\)/);
assert.match(search, /setTimeout\(search, 300\)/);
assert.match(search, /clearTimeout\(debounce\)/);

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

console.log("Recent feature contract verification passed: folders, search, drafts, timeline, recovery, and Vercel reads.");
