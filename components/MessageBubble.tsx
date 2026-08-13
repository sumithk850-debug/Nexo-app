"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { getPublicModel } from "@/lib/models";
import { Signal } from "./Signal";
import { parseCraftSegments } from "@/lib/craftParser";
import { CraftStatusCard } from "./CraftStatusCard";
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
import { Copy, Check, RotateCw, ThumbsUp, ThumbsDown, Pencil, CheckCheck, X, Loader2 } from "lucide-react";
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
};

export function MessageBubble({
  message,
  onEdit,
  onRegenerate,
  isLast,
  coderMode = false,
  repoFullName,
  isStreaming = false,
  sessionId,
  onSuggestionSelect,
}: {
  message: ChatMessage;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  isLast?: boolean;
  coderMode?: boolean;
  repoFullName?: string | null;
  isStreaming?: boolean;
  sessionId?: string;
  onSuggestionSelect?: (suggestion: string) => void;
}) {
  const isUser = message.role === "user";
  const model = message.modelId ? getPublicModel(message.modelId) : undefined;
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

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
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
                      {seg.text}
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
          </div>
        ) : (
          <div className="prose-nexo text-sm text-ink">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

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
