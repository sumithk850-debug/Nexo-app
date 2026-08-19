import {
  CRAFT_V3_PRO_ENGINE_CONFIG,
  CRAFT_V4_ENGINE_CONFIG,
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

console.log("NEXO model routing verification passed.");
