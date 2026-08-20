import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  parseIntegrationReadToolIntents,
  stripIntegrationReadToolBlocks,
} from "../lib/integrationToolParser";
import {
  createIntegrationReadBlock,
  parseIntegrationReadBlocks,
  stripIntegrationReadBlocks,
} from "../lib/integrationReadParser";

const parsed = parseIntegrationReadToolIntents([
  '<integration-tool>{"service":"vercel","action":"list_projects"}</integration-tool>',
  '<integration-tool>{"service":"github","action":"selected_repository"}</integration-tool>',
  '<integration-tool>{"service":"vercel","action":"promote"}</integration-tool>',
].join("\n"));
assert.deepEqual(parsed, [
  { service: "vercel", action: "list_projects" },
  { service: "github", action: "selected_repository" },
]);
assert.equal(stripIntegrationReadToolBlocks("Before <integration-tool>{\"service\":\"vercel\",\"action\":\"list_projects\"}</integration-tool> After"), "Before  After");

const card = createIntegrationReadBlock({
  service: "vercel",
  state: "success",
  title: "Verified Vercel projects",
  message: "1 verified Vercel project returned.",
  items: [{ primary: "nexo-app", secondary: "nextjs" }],
});
assert.equal(parseIntegrationReadBlocks(card)[0]?.items?.[0]?.primary, "nexo-app");
assert.equal(stripIntegrationReadBlocks(`${card}\nNatural final answer.`), "Natural final answer.");

const page = readFileSync("app/page.tsx", "utf8");
const chatRoute = readFileSync("app/api/chat/route.ts", "utf8");
const bubble = readFileSync("components/MessageBubble.tsx", "utf8");
assert.match(page, /executeIntegrationReadTool/);
assert.match(page, /\[Verified \$\{serviceName\} read executed by Nexo\]/);
assert.match(page, /integrationToolDepth \+ 1/);
assert.match(chatRoute, /<integration-tool>/);
assert.match(chatRoute, /Never write labels such as/);
assert.match(bubble, /IntegrationReadCard/);
assert.match(bubble, /stripIntegrationReadBlocks/);

console.log("Integration task-result continuation checks passed.");
