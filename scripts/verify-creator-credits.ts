import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/chat/route.ts", "utf8");

assert.match(route, /const CREATOR_CREDITS_PROTOCOL = `/);
for (const name of [
  "Hasith Heshan",
  "Thenuk Dulneth",
  "Anuhas Hansana",
  "Kaveesha Hansamal",
  "Pruthuvi Mahasen",
  "Vinul Sanumitha",
  "Varuna Damsara",
]) {
  assert.ok(route.includes(name), `Missing creator credit: ${name}`);
}
assert.match(route, /Do not volunteer, repeat, or append these names in ordinary answers/);
assert.match(route, /Mention these credits only when the user explicitly asks/);
assert.match(route, /systemPrompt \+= CREATOR_CREDITS_PROTOCOL/);

console.log("Creator-credit explicit-question-only checks passed.");
