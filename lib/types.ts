import type { NexoModelId } from "./models";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: NexoModelId;
}
