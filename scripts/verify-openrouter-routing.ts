import { readFileSync } from "node:fs";
import {
  CRAFT_V3_PRO_ENGINE_CONFIG,
  CRAFT_V4_ENGINE_CONFIG,
  CODER_MODELS,
  PROVIDER_CONFIG,
} from "../lib/providers.server";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const expectedRoutes = {
  "nexio-1.1": {
    model: "openrouter/free",
    fallbacks: [
      "google/gemma-4-31b-it:free",
      "dots-studio/dots-3-note-preview:free",
      "google/gemma-4-26b-a4b-it:free",
    ],
  },
  "spadec-3.5": {
    model: "dots-studio/dots-3-note-preview:free",
    fallbacks: ["google/gemma-4-31b-it:free", "openai/gpt-oss-20b:free"],
  },
  "galex-4.0": {
    model: "google/gemma-4-31b-it:free",
    fallbacks: ["dots-studio/dots-3-note-preview:free", "nvidia/nemotron-3-super-120b-a12b:free"],
  },
  "brainex-10.8": {
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    fallbacks: ["nvidia/nemotron-3-ultra-550b-a55b:free", "openai/gpt-oss-20b:free"],
  },
  "craft-v3": {
    model: "gemini-3.1-flash-lite",
    fallbacks: ["dots-studio/dots-3-note-preview:free", "cohere/north-mini-code:free"],
  },
} as const;

for (const [id, expected] of Object.entries(expectedRoutes)) {
  const config = PROVIDER_CONFIG[id as keyof typeof PROVIDER_CONFIG];
  const expectedProvider = id === "craft-v3" ? "gemini" : "openrouter";
  assert(config.provider === expectedProvider, `${id} provider route is incorrect`);
  assert(config.model === expected.model, `${id} primary route is incorrect`);
  assert(JSON.stringify(config.fallbackModels ?? []) === JSON.stringify(expected.fallbacks), `${id} fallback order is incorrect`);
}

assert(CRAFT_V3_PRO_ENGINE_CONFIG.provider === "openrouter", "Craft V3 Pro must use OpenRouter only");
assert(CRAFT_V3_PRO_ENGINE_CONFIG.model === "poolside/laguna-s-2.1:free", "Craft V3 Pro primary route is incorrect");
assert(JSON.stringify(CRAFT_V3_PRO_ENGINE_CONFIG.fallbackModels) === JSON.stringify([
  "dots-studio/dots-3-note-preview:free",
  "cohere/north-mini-code:free",
]), "Craft V3 Pro fallback order is incorrect");

assert(CRAFT_V4_ENGINE_CONFIG.provider === "openrouter", "Craft V4 must use OpenRouter only");
assert(CRAFT_V4_ENGINE_CONFIG.model === "poolside/laguna-s-2.1:free", "Craft V4 primary route is incorrect");
assert(JSON.stringify(CRAFT_V4_ENGINE_CONFIG.fallbackModels) === JSON.stringify([
  "nvidia/nemotron-3-super-120b-a12b:free",
  "dots-studio/dots-3-note-preview:free",
  "cohere/north-mini-code:free",
]), "Craft V4 fallback order is incorrect");

console.log("KYVORIX model routing verification passed.");

assert(CODER_MODELS.find((model) => model.id === "craft-v3-lite")?.locked === false, "Craft V3 Lite must remain free and selectable");
assert(CODER_MODELS.find((model) => model.id === "craft-v3")?.locked === true, "Paid Craft V3 must remain locked");
assert(CODER_MODELS.find((model) => model.id === "craft-v4")?.locked === true, "Paid Craft V4 must remain locked");

const chatRoute = readFileSync("app/api/chat/route.ts", "utf8");
const chatPage = readFileSync("app/page.tsx", "utf8");
assert(chatRoute.includes("requestedLockedCoderModel"), "Server must enforce the paid Craft model lock");
assert(chatRoute.includes('coderModel === "craft-v3" || coderModel === "craft-v4"'), "Both paid Coder variants must be locked server-side");
assert(chatRoute.includes('!isCoderMode && modelId === "craft-v3"'), "The public Craft V3 profile must remain paid-gated");
assert(chatRoute.includes("This Craft model is locked until the Kyvorix Pro plan is available."), "Paid-model response must explain the Pro requirement");
assert(chatRoute.includes('activeCoderModel === "craft-v3-lite"'), "Craft V3 Lite must use its dedicated prompt route");
assert(chatPage.includes("proposalId: proposalData.proposalId"), "GitHub writes must continue through the server-approved proposal flow");

