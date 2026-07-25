"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { getPublicModel } from "@/lib/models";
import { Signal } from "./Signal";
import { Copy, Check, RotateCw, ThumbsUp, ThumbsDown, Volume2, VolumeX, ImageIcon, FileText } from "lucide-react";

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
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access may be blocked — fail silently
    }
  }

  function handleFeedback(value: "up" | "down") {
    setFeedback((prev) => (prev === value ? null : value));
  }

  function handleSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.content.replace(/```[\s\S]*?```/g, "code block omitted"));
    utterance.lang = /[\u0D80-\u0DFF]/.test(message.content) ? "si-LK" : "en-US";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo/90 px-4 py-3 text-sm text-white md:max-w-[70%]">
          {message.content}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((file) => (
                <div key={file.id} className="overflow-hidden rounded-xl border border-white/20 bg-black/10">
                  {file.kind === "image" && file.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.dataUrl} alt={file.name} className="max-h-64 w-full object-cover" />
                  ) : null}
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/80">
                    {file.kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="truncate">{file.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

            <button
              onClick={handleSpeak}
              className={`flex items-center gap-1 rounded-md p-1.5 transition hover:bg-panel ${
                speaking ? "text-cyan" : "text-ink-faint hover:text-ink"
              }`}
              aria-label={speaking ? "Stop voice reply" : "Read response aloud"}
              title={speaking ? "Stop voice" : "Voice reply"}
            >
              {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
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

            <button
              onClick={() => handleFeedback("up")}
              className={`flex items-center gap-1 rounded-md p-1.5 transition hover:bg-panel ${
                feedback === "up" ? "text-cyan" : "text-ink-faint hover:text-ink"
              }`}
              aria-label="Like response"
              title="Like"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => handleFeedback("down")}
              className={`flex items-center gap-1 rounded-md p-1.5 transition hover:bg-panel ${
                feedback === "down" ? "text-cyan" : "text-ink-faint hover:text-ink"
              }`}
              aria-label="Dislike response"
              title="Dislike"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
