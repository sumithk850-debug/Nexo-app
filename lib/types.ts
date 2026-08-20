import type { NexoModelId } from "./models";

export interface ChatImageAttachment {
  /** Browser-local data URL used to render the image the user just sent. */
  dataUrl: string;
  name: string;
}

export type FileActivityState = "loading" | "success" | "error" | "proposed";

/**
 * A client-side verified artifact for a repository file action. Its compact
 * card is separate from assistant prose, while its viewer can reveal source
 * only after the user explicitly opens it.
 */
export interface FileActivityArtifact {
  id: string;
  action: "reading" | "creating" | "editing" | "deleting";
  filePath: string;
  language: string;
  state: FileActivityState;
  content?: string;
  diff?: string;
  lineCount?: number;
  additions?: number;
  deletions?: number;
  message?: string;
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
  /** Real GitHub file activity for this turn; never rendered as normal prose. */
  fileActivities?: FileActivityArtifact[];
}
