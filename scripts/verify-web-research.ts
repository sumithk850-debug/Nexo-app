import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSafeWebResearchQuery, shouldUseWebResearchIntent } from "../lib/webResearchIntent";

assert.equal(shouldUseWebResearchIntent("What are the latest changes in TypeScript?"), true);
assert.equal(shouldUseWebResearchIntent("Search the web for recent climate research"), true);
assert.equal(shouldUseWebResearchIntent("Explain the causes of the French Revolution"), true);
assert.equal(shouldUseWebResearchIntent("ශ්‍රී ලංකාවේ අද පුවත් මොනවාද?"), true);
assert.equal(shouldUseWebResearchIntent("මට අලුත්ම තොරතුරු සොයා බලන්න"), true);
assert.equal(shouldUseWebResearchIntent("Please debug this React component"), false);
assert.equal(shouldUseWebResearchIntent("Translate this paragraph into Sinhala"), false);
assert.equal(shouldUseWebResearchIntent("Hello, how are you?"), false);

for (const query of [
  "latest information about guns",
  "find knives for sale",
  "where to buy recreational drugs",
  "online casino recommendations",
  "sports betting sites",
  "dangerous stunt challenge ideas",
]) {
  assert.equal(isSafeWebResearchQuery(query), false, "Restricted topic must be blocked: " + query);
  assert.equal(shouldUseWebResearchIntent(query), false, "Restricted topic must not start web research: " + query);
}

const tavily = readFileSync("lib/tavily.server.ts", "utf8");
const route = readFileSync("app/api/web-research/route.ts", "utf8");
const chatRoute = readFileSync("app/api/chat/route.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const native = readFileSync("lib/nativeTools.server.ts", "utf8");
const timeline = readFileSync("components/AgentTimeline.tsx", "utf8");
const signature = readFileSync("lib/webResearchSignature.server.ts", "utf8");
const drawer = readFileSync("components/RealityDrawer.tsx", "utf8");

assert.ok(tavily.includes('const TAVILY_BASE = "https://api.tavily.com"') && tavily.includes('"/search"'), "Tavily search endpoint must be used.");
assert.ok(tavily.includes('"/extract"'), "Tavily must extract actual page contents, not only snippets.");
assert.ok(tavily.includes("extractSameSiteLinks"), "Relevant same-site links must be discovered and followed.");
assert.ok(tavily.includes("isSafeWebResearchQuery"), "The server-side Tavily operation must enforce safe topic filtering.");
assert.ok(tavily.includes('stage: item.linkedFrom ? "following_links" : "reading"'), "Page-reading progress must be emitted while extraction runs.");
assert.ok(tavily.includes("AbortSignal.timeout"), "Tavily requests must have bounded timeouts.");
assert.ok(route.includes("requireVerifiedUser"), "Web research endpoint must require a verified user.");
assert.ok(route.includes("text/event-stream"), "Web research endpoint must stream progress using SSE.");
assert.ok(route.includes("searchAndReadWithTavily(query"), "SSE route must execute Tavily research.");
assert.ok(route.includes("signWebResearchContext"), "Research results must be signed before being sent to the client.");
assert.ok(page.includes('authenticatedFetch("/api/web-research"'), "Chat must call the authenticated web research endpoint.");
assert.ok(page.includes("reader.read()"), "Chat must consume live SSE progress.");
assert.ok(page.includes("webResearchToken"), "Signed research context must be forwarded to chat generation.");
assert.ok(signature.includes("timingSafeEqual"), "Chat must verify signed research tokens using constant-time comparison.");
assert.ok(signature.includes("SUPABASE_SERVICE_ROLE_KEY"), "Research signing must use a server-only secret.");
assert.ok(chatRoute.includes("VERIFIED WEB RESEARCH CONTEXT"), "Final model must receive extracted research context.");
assert.ok(chatRoute.includes("verifyWebResearchContext(body.webResearchToken"), "Chat must reject forged or expired client research context.");
assert.ok(chatRoute.includes("webResearchAlreadyDone: Boolean(webResearchContext)"), "Chat must avoid a duplicate web search after pre-research.");
assert.ok(native.includes('name: "tavily_web_research"'), "Tavily must remain available to the shared native tool registry.");
assert.ok(native.includes("searchAndReadWithTavily(query)"), "Native model tool calls must route through Tavily.");
assert.ok(timeline.includes("researchProgress={") || timeline.includes("researchProgress"), "Desktop activity timeline must render research progress.");
assert.ok(drawer.includes("researchProgress"), "Mobile activity drawer must render research progress.");

console.log("Autonomous Tavily web-research contract and safety tests passed.");
