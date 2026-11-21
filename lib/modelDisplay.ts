import type { CoderModelId } from "./providers.server";
import type { NexoModelId } from "./models";

const CHAT_MODEL_NAMES: Record<NexoModelId, string> = {
  "nexio-1.1": "Nexio 1.1",
  "spadec-3.5": "Spadec 3.5",
  "galex-4.0": "Galex 4.5",
  "brainex-10.8": "Brainex 10.8",
  "craft-v3": "Craft V3",
};

const CODER_MODEL_NAMES: Record<CoderModelId, string> = {
  "craft-v3-lite": "Craft V3 Lite",
  "craft-v5": "Craft V5",
  "craft-v3": "Craft V3",
  "craft-v4": "Craft V4",
};

export function getModelDisplayName(modelId: string | undefined, coderMode = false): string {
  if (coderMode && modelId && modelId in CODER_MODEL_NAMES) {
    return CODER_MODEL_NAMES[modelId as CoderModelId];
  }
  if (modelId && modelId in CHAT_MODEL_NAMES) {
    return CHAT_MODEL_NAMES[modelId as NexoModelId];
  }
  return modelId || "KYVORIX AI";
}

export function getActiveModelDisplayName({
  selectedModel,
  coderModel,
  isCoderMode,
}: {
  selectedModel: string;
  coderModel: string;
  isCoderMode: boolean;
}): string {
  return getModelDisplayName(isCoderMode ? coderModel : selectedModel, isCoderMode);
}
