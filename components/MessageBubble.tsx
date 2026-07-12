"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { getPublicModel } from "@/lib/models";
import { Signal } from "./Signal";
import { Copy, Check, RotateCw } from "lucide-react";

export function MessageBubble({
  message,
  onRegenerate,
  isLast,
}: {
  message: ChatMessage;
  onRegenerate?: () => void;
  isLast?: boolean;
}) {
  const isUser = message.role === "user";
  const model = message.modelId ? getPublicModel(message.modelId) : undefined;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access may be blocked — fail silently
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo/90 px-4 py-3 text-sm text-white md:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3 px-4 py-3">
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

        {message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md p-1.5 text-ink-faint transition hover:bg-panel hover:text-ink"
              aria-label="Copy response"
              title="Copy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-cyan" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-md p-1.5 text-ink-faint transition hover:bg-panel hover:text-ink"
                aria-label="Regenerate response"
                title="Regenerate"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
