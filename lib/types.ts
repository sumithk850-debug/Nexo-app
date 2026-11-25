import type { NexoModelId } from "./models";
import type { ArtifactDescriptor } from "./artifactTypes";
import type { PresentationDescriptor } from "./presentationTypes";
import type { ActionEvent } from "./actionEngine";
import type { MessageProgress } from "./progressSteps";

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
  /** Local display label for coder sub-models such as Craft V5. */
  modelLabel?: string;
  /** True when this message was loaded from / saved to the database. */
  persisted?: boolean;
  /** Local-only recovery state for a streamed assistant response. */
  generationState?: "stopped" | "failed";
  /** Local artifact card payload returned by the first-party artifact route. */
  artifact?: ArtifactDescriptor | PresentationDescriptor;
  /** Verified lifecycle events emitted by server-side tool adapters. */
  actionEvents?: ActionEvent[];
  /** Live "Summary" steps for this reply. Browser-local; never sent to the server. */
  progress?: MessageProgress;
}
