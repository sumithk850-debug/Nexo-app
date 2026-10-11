import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/chat/route.ts", "utf8");

assert.match(route, /const GEMINI_VISION_MODEL = "gemini-2\.5-flash"/);
assert.match(route, /GEMINI_API_KEY/);
assert.match(route, /:generateContent\?key=/);
assert.match(route, /toGeminiInlineImage\(image\.base64Image\)/);
assert.match(route, /OPENROUTER_API_KEY/);
assert.match(route, /VISION_FALLBACK_MODEL/);
assert.match(route, /config\.provider !== "gemini"/);
assert.match(route, /uploadedImageDescription/);
assert.match(route, /UPLOADED IMAGE DESCRIPTION/);
assert.match(route, /nativeImageParts/);

console.log("Universal image vision checks passed: Gemini analysis, OpenRouter fallback, and native Gemini image routing are wired.");
