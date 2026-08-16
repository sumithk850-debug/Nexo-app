"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { getPublicModel } from "@/lib/models";
import { Signal } from "./Signal";
import { parseCraftSegments } from "@/lib/craftParser";
import { parseSupabaseTaskBlocks, stripSupabaseTaskBlocks, type SupabaseTask } from "@/lib/supabaseTaskParser";
import { CraftStatusCard } from "./CraftStatusCard";
import { SupabaseTaskCard } from "./SupabaseTaskCard";
import { SummaryCard } from "./SummaryCard";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-xml-doc";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import { Copy, Check, RotateCw, ThumbsUp, ThumbsDown, Pencil, CheckCheck, X, Loader2, Square, Play, Volume2 } from "lucide-react";
import { SmartReplySuggestions } from "./SmartReplySuggestions";

/**
 * Code block with prism.js syntax highlighting and a per-block copy button.
 */
function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const code = String(children ?? "").replace(/\n$/, "");
  const [copied, setCopied] = useState(false);
  const lang = (className ?? "")
    .replace("language-", "")
    .trim()
    .toLowerCase();
  const grammar = lang && Prism.languages[lang] ? Prism.languages[lang] : Prism.languages.plaintext;
  const highlighted = Prism.highlight(code, grammar, lang || "plaintext");

  return (
    <div className="group/code my-2 overflow-hidden rounded-lg border border-edge bg-void/70">
      <div className="flex items-center justify-between bg-panel px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {lang || "code"}
        </span>
        <button
          key={copied ? "copied" : "copy"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // clipboard access may be blocked — fail silently
            }
          }}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-faint transition hover:bg-void hover:text-ink"
          aria-label="Copy code"
          title="Copy"
        >
          {copied ? (
            <Check className="h-3 w-3 text-cyan" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} className="!bg-transparent !p-0 text-ink" />
      </pre>
    </div>
  );
}

const markdownComponents = {
  pre(props: { children?: React.ReactNode; className?: string }) {
    const child = props.children;
    const codeNode = child as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
    return (
      <CodeBlock className={codeNode?.props?.className}>{codeNode?.props?.children}</CodeBlock>
    );
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-edge/80 bg-panel/45 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <table className="min-w-[34rem] w-full border-separate border-spacing-0 text-left text-[12px] leading-5">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }: { children?: React.ReactNode }) {
    return <thead className="bg-cyan/10 text-[10px] uppercase tracking-[0.08em] text-cyan">{children}</thead>;
  },
  th({ children }: { children?: React.ReactNode }) {
    return <th className="px-3 py-2.5 font-bold first:rounded-tl-xl last:rounded-tr-xl">{children}</th>;
  },
  tbody({ children }: { children?: React.ReactNode }) {
    return <tbody className="divide-y divide-edge/70">{children}</tbody>;
  },
  tr({ children }: { children?: React.ReactNode }) {
    return <tr className="align-top odd:bg-void/15">{children}</tr>;
  },
  td({ children }: { children?: React.ReactNode }) {
    return <td className="max-w-[18rem] break-words px-3 py-2.5 text-ink-muted">{children}</td>;
  },
};

function normalizeMarkdownForDisplay(content: string) {
  const withoutSupabaseTasks = stripSupabaseTaskBlocks(content);
  return withoutSupabaseTasks
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith("```") ? part : part.replace(/<br\s*\/?>/gi, "  \n")))
    .join("");
}

function toSpeakableText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/!?(\[[^\]]*\])\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MessageBubble({
  message,
  onEdit,
  onRegenerate,
  onRetry,
  onContinue,
  isLast,
  coderMode = false,
  repoFullName,
  isStreaming = false,
  sessionId,
  userId,
  onSupabaseApprove,
  onSuggestionSelect,
}: {
  message: ChatMessage;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  onRetry?: (messageId: string) => void;
  onContinue?: (messageId: string) => void;
  isLast?: boolean;
  coderMode?: boolean;
  repoFullName?: string | null;
  isStreaming?: boolean;
  sessionId?: string;
  userId?: string;
  onSupabaseApprove?: (task: SupabaseTask) => Promise<{ ok: boolean; message?: string }>;
  onSuggestionSelect?: (suggestion: string) => void;
}) {
  const isUser = message.role === "user";
  const model = message.modelId ? getPublicModel(message.modelId) : undefined;
  const attachments = message.imageAttachments ?? (message.imageAttachment ? [message.imageAttachment] : []);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const supabaseTasks = parseSupabaseTaskBlocks(message.content);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access may be blocked — fail silently
    }
  }

  async function handleFeedback(value: "up" | "down") {
    setFeedback((prev) => (prev === value ? null : value));
    if (!sessionId) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          sessionId,
          modelId: message.modelId || "unknown",
          rating: value,
        }),
      });
    } catch (err) {
      console.error("Failed to save feedback:", err);
    }
  }

  function startEdit() {
    setDraft(message.content);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(message.content);
  }

  function submitEdit() {
    const value = draft.trim();
    if (!value || value === message.content) {
      setEditing(false);
      return;
    }
    setEditing(false);
    setDraft(value);
    onEdit?.(message.id, value);
  }

  function handleReadAloud() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const spokenText = toSpeakableText(message.content);
    if (!spokenText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 0.96;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  if (isUser) {
    if (editing) {
      return (
        <div className="flex justify-end px-4 py-2">
          <div className="flex w-full max-w-[85%] flex-col gap-2 md:max-w-[70%]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 60)))}
              className="w-full rounded-2xl bg-panel px-4 py-3 text-sm text-ink outline-none ring-1 ring-edge focus:ring-2 focus:ring-cyan/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <div className="flex items-center justify-end gap-1.5 pr-1">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-panel hover:text-ink"
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                onClick={submitEdit}
                className="flex items-center gap-1 rounded-md bg-cyan px-2 py-1 text-xs text-void transition hover:bg-cyan-dim"
                aria-label="Send edit"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Resend
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="group flex justify-end px-4 py-2">
        <div className="relative max-w-[85%] rounded-2xl rounded-br-md bg-indigo/90 px-4 py-3 text-sm text-white md:max-w-[70%]">
          {attachments.length > 0 && (
            <div className={`grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {attachments.map((attachment, index) => (
                <Image key={`${attachment.name}-${index}`} src={attachment.dataUrl} alt={`Attachment: ${attachment.name}`} width={320} height={240} unoptimized className="max-h-56 w-full rounded-xl border border-white/20 object-contain shadow-sm" />
              ))}
            </div>
          )}
          {message.content && (
            <div className={`${attachments.length > 0 ? "mt-2" : ""} whitespace-pre-wrap break-words`}>
              {message.content}
            </div>
          )}
          {!isStreaming && (
            <button
              onClick={startEdit}
              className="absolute -left-8 top-1/2 flex -translate-y-1/2 items-center rounded-md p-1.5 text-ink-faint opacity-0 transition hover:bg-panel hover:text-ink group-hover:opacity-100"
              aria-label="Edit message"
              title="Edit & resend"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
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
        {/* Repository operation markers and file bodies belong exclusively in
            the activity panel above the composer. Only normal prose/report
            segments remain in the transcript. */}
        {coderMode ? (
          <div className="space-y-2">
            {parseCraftSegments(message.content).map((seg, i) =>
              seg.kind === "text" ? (
                seg.text.trim() ? (
                  <div key={i} className="prose-nexo text-sm text-ink">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {normalizeMarkdownForDisplay(seg.text)}
                    </ReactMarkdown>
                  </div>
                ) : null
              ) : seg.kind === "summary" ? (
                <SummaryCard
                  key={i}
                  summary={seg.summary}
                  streaming={isStreaming && seg.streaming}
                />
              ) : seg.kind === "searching" ? (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-ink"
                >
                  {isStreaming && seg.streaming ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                      <span className="font-semibold text-violet-400">Searching</span>
                      {seg.action.queries.length > 0 && (
                        <span className="max-w-[40ch] truncate text-ink-faint" title={seg.action.queries.join(", ")}>
                          {seg.action.queries.join(", ")}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-green-400" />
                      <span className="font-semibold text-ink-muted">Searched</span>
                      {seg.action.queries.length > 0 && (
                        <span className="max-w-[40ch] truncate text-ink-faint" title={seg.action.queries.join(", ")}>
                          {seg.action.queries.join(", ")}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <CraftStatusCard
                  key={i}
                  action={seg.action}
                  streaming={isStreaming && seg.streaming}
                  repoFullName={repoFullName}
                />
              )
            )}
            {supabaseTasks.map((task) => (
              <SupabaseTaskCard
                key={task.id}
                task={task}
                streaming={isStreaming}
                userId={userId}
                onApprove={onSupabaseApprove}
              />
            ))}
          </div>
        ) : (
          <div className="prose-nexo text-sm text-ink">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {normalizeMarkdownForDisplay(message.content)}
            </ReactMarkdown>
            {supabaseTasks.map((task) => (
              <SupabaseTaskCard
                key={task.id}
                task={task}
                streaming={isStreaming}
                userId={userId}
                onApprove={onSupabaseApprove}
              />
            ))}
          </div>
        )}

        {message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={handleReadAloud}
              className={`flex items-center gap-1 rounded-md p-1.5 transition hover:bg-panel ${isSpeaking ? "text-rose-400" : "text-ink-faint hover:text-ink"}`}
              aria-label={isSpeaking ? "Stop reading response" : "Read response aloud"}
              title={isSpeaking ? "Stop reading" : "Read aloud"}
            >
              {isSpeaking ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
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

        {isLast && message.generationState && !isStreaming && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${message.generationState === "stopped" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>
              <Square className="h-2.5 w-2.5 fill-current" />
              {message.generationState === "stopped" ? "Stopped" : "Connection interrupted"}
            </span>
            {onRetry && (
              <button onClick={() => onRetry(message.id)} className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel px-2 py-1 text-[10px] font-bold text-ink-muted transition hover:border-cyan/40 hover:text-cyan" aria-label="Retry response">
                <RotateCw className="h-3 w-3" /> Retry
              </button>
            )}
            {message.generationState === "stopped" && onContinue && (
              <button onClick={() => onContinue(message.id)} className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel px-2 py-1 text-[10px] font-bold text-ink-muted transition hover:border-cyan/40 hover:text-cyan" aria-label="Continue response">
                <Play className="h-3 w-3 fill-current" /> Continue
              </button>
            )}
          </div>
        )}

        {/* Smart Reply Suggestions — only on the last non-streaming assistant message */}
        {isLast && message.role === "assistant" && message.content && !isStreaming && onSuggestionSelect && (
          <SmartReplySuggestions
            lastMessageContent={message.content}
            onSelect={onSuggestionSelect}
            disabled={isStreaming}
          />
        )}
      </div>
    </div>
  );
}
