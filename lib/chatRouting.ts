// KYVORIX AI — strict separation between regular chat and Coder Agent routing.
export type PublicChatModelId = "nexio-1.1" | "spadec-3.5" | "galex-4.0" | "brainex-10.8" | "craft-v3";
export type PublicCoderModelId = "craft-v3-lite" | "craft-v5" | "craft-v3" | "craft-v4";
export interface ChatRoutingInput { modelId: PublicChatModelId; isCoderMode: unknown; coderModel?: unknown; }
export interface ChatRoutingDecision {
  isCoderMode: boolean; coderModel: PublicCoderModelId | undefined; requestedCraftV5: boolean;
  requestedLockedCoderModel: boolean; explicitlyUnlockedLite: boolean;
  activeCoderModel: PublicCoderModelId; usesCoderBudget: boolean;
}
const ALLOWED_CODER_MODELS = new Set<PublicCoderModelId>(["craft-v3-lite", "craft-v5", "craft-v3", "craft-v4"]);
export function resolveChatRouting(input: ChatRoutingInput): ChatRoutingDecision | null {
  const isCoderMode = input.isCoderMode === true;
  const coderModel = typeof input.coderModel === "string" && ALLOWED_CODER_MODELS.has(input.coderModel as PublicCoderModelId)
    ? input.coderModel as PublicCoderModelId : undefined;
  if (isCoderMode && input.coderModel !== undefined && coderModel === undefined) return null;
  const requestedCraftV5 = isCoderMode && coderModel === "craft-v5";
  const explicitlyUnlockedLite = isCoderMode && coderModel === "craft-v3-lite";
  const requestedLockedCoderModel =
    (isCoderMode && (coderModel === "craft-v3" || coderModel === "craft-v4")) ||
    (!isCoderMode && input.modelId === "craft-v3");
  const activeCoderModel: PublicCoderModelId = requestedCraftV5 ? "craft-v5" : "craft-v3-lite";
  return { isCoderMode, coderModel, requestedCraftV5, requestedLockedCoderModel, explicitlyUnlockedLite,
    activeCoderModel, usesCoderBudget: (isCoderMode || input.modelId === "craft-v3") && !requestedCraftV5 };
}
