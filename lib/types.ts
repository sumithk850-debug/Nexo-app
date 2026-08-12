import type { NexoModelId } from "./models";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: NexoModelId;
  /** True when this message was loaded from / saved to the database. */
  persisted?: boolean;
}
