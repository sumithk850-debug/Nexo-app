import type { CoderModelId } from "./coderModels";
import type { NexoModelId } from "./models";

export interface ModelToolCapability {
  modelId: NexoModelId | CoderModelId | string;
  displayName: string;
  supportsToolCalling: boolean;
  maxRounds: number;
  maxCalls: number;
  maxDocumentationChars: number;
  maxResultChars: number;
}

const DEFAULT_CAPABILITY: ModelToolCapability = {
  modelId: "unknown",
  displayName: "KYVORIX AI",
  supportsToolCalling: true,
  maxRounds: 3,
  maxCalls: 6,
  maxDocumentationChars: 18_000,
  maxResultChars: 10_000,
};

const CAPABILITIES: Record<string, ModelToolCapability> = {
  "nexio-1.1": { ...DEFAULT_CAPABILITY, modelId: "nexio-1.1", displayName: "Nexio 1.1", maxRounds: 2, maxCalls: 4, maxDocumentationChars: 12_000, maxResultChars: 8_000 },
  "spadec-3.5": { ...DEFAULT_CAPABILITY, modelId: "spadec-3.5", displayName: "Spadec 3.5", maxRounds: 3, maxCalls: 6 },
  // The stable internal id is retained for chat/database compatibility; 4.5 is the public identity.
  "galex-4.0": { ...DEFAULT_CAPABILITY, modelId: "galex-4.0", displayName: "Galex 4.5", maxRounds: 4, maxCalls: 8, maxDocumentationChars: 22_000, maxResultChars: 12_000 },
  "brainex-10.8": { ...DEFAULT_CAPABILITY, modelId: "brainex-10.8", displayName: "Brainex 10.8", maxRounds: 4, maxCalls: 8, maxDocumentationChars: 24_000, maxResultChars: 14_000 },
  "craft-v3": { ...DEFAULT_CAPABILITY, modelId: "craft-v3", displayName: "Craft V3", maxRounds: 3, maxCalls: 6 },
  "craft-v3-lite": { ...DEFAULT_CAPABILITY, modelId: "craft-v3-lite", displayName: "Craft V3 Lite", maxRounds: 3, maxCalls: 6, maxDocumentationChars: 16_000, maxResultChars: 9_000 },
  "craft-v5": { ...DEFAULT_CAPABILITY, modelId: "craft-v5", displayName: "Craft V5", maxRounds: 4, maxCalls: 8, maxDocumentationChars: 24_000, maxResultChars: 12_000 },
  "craft-v4": { ...DEFAULT_CAPABILITY, modelId: "craft-v4", displayName: "Craft V4", maxRounds: 4, maxCalls: 8, maxDocumentationChars: 22_000, maxResultChars: 12_000 },
};

export function getModelToolCapability(modelId: string | undefined): ModelToolCapability {
  return CAPABILITIES[modelId ?? ""] ?? { ...DEFAULT_CAPABILITY, modelId: modelId ?? DEFAULT_CAPABILITY.modelId };
}

export function getRegisteredToolCapabilityIds(): string[] {
  return Object.keys(CAPABILITIES);
}
