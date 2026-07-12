import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { getPublicModel } from "@/lib/models";
import { Signal } from "./Signal";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const model = message.modelId ? getPublicModel(message.modelId) : undefined;

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo/90 px-4 py-3 text-sm text-ink md:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-edge bg-panel">
        <Signal size="sm" />
      </div>
      <div className="min-w-0 max-w-[85%] md:max-w-[75%]">
        {model && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-cyan">
            {model.name}
          </p>
        )}
        <div className="prose-nexo text-sm text-ink">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
