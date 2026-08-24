import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providers = readFileSync("lib/providers.server.ts", "utf8");
const route = readFileSync("app/api/chat/route.ts", "utf8");

assert.match(providers, /"craft-v3":\s*\{[\s\S]*?provider:\s*"gemini"/);
assert.match(providers, /model:\s*CRAFT_V3_LITE_MODEL/);
assert.match(providers, /const CRAFT_V3_LITE_MODEL = "gemini-3\.1-flash-lite"/);
assert.match(route, /function toGeminiInlineImage\(base64Image: string\)/);
assert.match(route, /inlineData:\s*\{\s*mimeType:\s*match\[1\],\s*data:\s*match\[2\]/);
assert.match(route, /message === lastUserMessage \? nativeImageParts : \[\]/);
assert.match(route, /searchGroundingEnabled \? \{ tools: \[\{ googleSearch: \{\} \}\] \} : \{\}/);
assert.match(route, /provider:.*gemini|useGemini/);

console.log("Craft V3 Gemini vision and Google Search contract checks passed.");
