import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

const providers = source("lib/providers.server.ts");
const coderModels = source("lib/coderModels.ts");
const chatRoute = source("app/api/chat/route.ts");
const coderSelector = source("components/CoderModelSelector.tsx");
const page = source("app/page.tsx");
const chatInput = source("components/ChatInput.tsx");
const attachmentProcessing = source("lib/attachmentProcessing.ts");
const githubCommit = source("app/api/github/commit/route.ts");
const githubProposals = source("app/api/github/proposals/route.ts");
const chatsRoute = source("app/api/chats/route.ts");
const messagesRoute = source("app/api/chats/[id]/messages/route.ts");
const integrations = source("components/IntegrationsPanel.tsx");

// 1. Model access: the free Coder tier stays available, while Pro-only tiers
// remain locked in both model metadata and the server-side API boundary.
assert.match(coderModels, /id: "craft-v3-lite", name: "Craft V3 Lite", badge: "LITE", locked: false/);
assert.match(coderModels, /id: "craft-v3", name: "Craft V3", badge: "PRO", locked: true/);
assert.match(coderModels, /id: "craft-v4", name: "Craft V4", badge: "PRO", locked: true/);
assert.match(chatRoute, /requestedLockedCoderModel/);
assert.match(chatRoute, /if \(requestedLockedCoderModel\)/);
assert.match(chatRoute, /coder_model_locked/);
assert.match(chatRoute, /Craft V3 Lite remains available for free users/);
assert.match(coderSelector, /Craft V3 & V4 are locked/);

// 2. GitHub writes must stay behind a verified, explicit, single-use proposal.
// The approved repository base must still match before any commit is written.
assert.match(page, /\/api\/github\/proposals/);
assert.match(page, /proposalId: proposalData\.proposalId/);
assert.match(githubProposals, /requireVerifiedUser/);
assert.match(githubProposals, /github_write_proposals/);
assert.match(githubProposals, /base_commit_sha/);
assert.match(githubProposals, /expires_at/);
assert.match(githubCommit, /requireVerifiedUser/);
assert.match(githubCommit, /!userId \|\| !proposalId/);
assert.match(githubCommit, /\.eq\("id", proposalId\)/);
assert.match(githubCommit, /\.eq\("user_id", verified\.user\.id\)/);
assert.match(githubCommit, /proposal\.consumed_at/);
assert.match(githubCommit, /proposal\.expires_at/);
assert.match(githubCommit, /baseCommitSha !== proposal\.base_commit_sha/);

// 3. Chat history must remain session-scoped, bounded, and ownership-checked.
assert.match(chatsRoute, /isValidSessionId/);
assert.match(chatsRoute, /\.eq\("session_id", sessionId\)/);
assert.match(chatsRoute, /\.limit\(100\)/);
assert.match(chatsRoute, /Cache-Control.*no-store/);
assert.match(messagesRoute, /findOwnedChat/);
assert.match(messagesRoute, /\.eq\("id", chatId\)\.eq\("session_id", sessionId\)/);
assert.match(messagesRoute, /\.eq\("chat_id", id\)/);
assert.match(messagesRoute, /content\.length > 100_000/);
assert.match(messagesRoute, /\.limit\(200\)/);

// 4. Stop-generation must abort the actual streaming request, not only hide UI.
assert.match(page, /function handleStopGenerating\(\)/);
assert.match(page, /streamAbortControllerRef\.current\?\.abort\(\)/);
assert.match(page, /signal: controller\.signal/);
assert.match(page, /onStop=\{handleStopGenerating\}/);
assert.match(chatInput, /onClick=\{isStreaming \? onStop : handleSendClick\}/);

// 5. Attachments stay capped and pass through the shared preparation pipeline.
assert.match(attachmentProcessing, /MAX_ATTACHMENTS_PER_MESSAGE = 10/);
assert.match(attachmentProcessing, /MAX_PDF_PAGES_PER_MESSAGE = 6/);
assert.match(attachmentProcessing, /files\.slice\(0, MAX_ATTACHMENTS_PER_MESSAGE\)/);
assert.match(page, /prepareAttachmentsForVision\(attachedFiles\)/);
assert.match(page, /\.slice\(0, MAX_ATTACHMENTS_PER_MESSAGE\)/);
assert.match(page, /Attachments are never persisted/);

// 6. Existing connected integrations and Phase A-C entry points must not vanish.
assert.match(page, /<IntegrationsPanel/);
assert.match(integrations, /\/api\/github\/status/);
assert.match(integrations, /\/api\/supabase\/status/);
assert.match(integrations, /\/api\/vercel\/status/);
assert.match(page, /<MissionControlHeader/);
assert.match(page, /Ctrl\+K|Command\+K|metaKey/);
for (const action of ["Summarize", "Write", "Learn", "Brainstorm"]) {
  assert.ok(page.includes(action), `Missing Phase C quick action: ${action}`);
}

// 7. Cleanup regressions: no bundler aliases, no server-only modules in client
// bundles, no body-supplied access token, and no conflicting Craft V5 route claims.
const nextConfig = source("next.config.mjs");
assert.doesNotMatch(nextConfig, /resolveAlias|resolve\.alias/, "next.config.mjs must not alias application modules");
assert.ok(!existsSync("lib/providersWithWikipedia.server.ts"), "The Wikipedia provider wrapper must stay merged into providers.server.ts");
assert.ok(!existsSync("components/IntegrationsPanelWithWikipedia.tsx"), "The Wikipedia panel DOM-injection wrapper must stay removed");
assert.match(providers, /SHARED_RESEARCH_PROTOCOL/);
assert.match(chatRoute, /from "@\/lib\/providers\.server"/);
assert.equal((integrations.match(/<WikipediaIntegrationPanel/g) ?? []).length, 1, "Wikipedia must render exactly once inside IntegrationsPanel");
for (const file of ["app/page.tsx", ...readdirSync("components").filter((name) => name.endsWith(".tsx")).map((name) => `components/${name}`)]) {
  assert.ok(!source(file).includes("providers.server"), `${file} must not import the server-only providers module (it would ship system prompts and provider routes to the browser)`);
}
assert.doesNotMatch(chatRoute, /body\.userAccessToken/, "The chat route must not trust an access token from the request body");
assert.match(chatRoute, /userAccessToken = getBearerToken\(req\)/);
assert.doesNotMatch(page, /userAccessToken/, "The client must send its token only in the Authorization header");
assert.doesNotMatch(providers, /same internal engineering model route as Craft V3 Lite|around the existing Craft V3 Lite route/, "Craft V5 prompt must not claim a route it does not use");

console.log("Phase D regression checks passed: model access, GitHub approval safety, chat history isolation, stop-generation, attachments, integrations, and Phase A-C UI contracts.");
