import type { NexoModelId } from "./models";

export interface ChatImageAttachment {
  /** Browser-local data URL used to render the image the user just sent. */
  dataUrl: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present for a newly-sent image so the chat shows the actual preview. */
  imageAttachment?: ChatImageAttachment;
  /** Browser-local previews for a multi-image upload or rendered PDF pages. */
  imageAttachments?: ChatImageAttachment[];
  modelId?: NexoModelId;
  /** True when this message was loaded from / saved to the database. */
  persisted?: boolean;
  /** Local-only recovery state for a streamed assistant response. */
  generationState?: "stopped" | "failed";
}
