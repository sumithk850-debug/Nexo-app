import type { NexoModelId } from "./models";

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "document";
  dataUrl?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: NexoModelId;
  attachments?: ChatAttachment[];
}
