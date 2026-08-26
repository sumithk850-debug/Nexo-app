"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowUp, Menu, Mic, Plus, Square, X, Paperclip } from "lucide-react";
import { ModelSelectorChip } from "./ModelSelectorChip";
import type { NexoModelId } from "@/lib/models";

// GitHub's classic and fine-grained token prefixes. Detection happens only in
// the client input so a matching secret never enters message state or reaches
// the model/chat API.
function extractGithubPersonalAccessToken(value: string): string | null {
  return value.match(/(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})/)?.[0] ?? null;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  onOpenSidebar,
  selectedModel,
  onSelectModel,
  unlockedTiers,
  onAttach,
  attachedFiles = [],
  onRemoveAttach,
  isStreaming,
  onStop,
  streamElapsedSeconds = 0,
  onSecretDetected,
  onOpenLiveTalk,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  onOpenSidebar?: () => void;
  selectedModel: NexoModelId;
  onSelectModel: (id: NexoModelId) => void;
  unlockedTiers?: string[];
  onAttach: (files: File[]) => void;
  attachedFiles?: File[];
  onRemoveAttach?: (index: number) => void;
  isStreaming?: boolean;
  onStop?: () => void;
  streamElapsedSeconds?: number;
  onSecretDetected?: (secret: string) => void;
  onOpenLiveTalk?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    const objectUrls = attachedFiles
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));
    setImagePreviews(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [attachedFiles]);

  function interceptSecret(): boolean {
    const secret = extractGithubPersonalAccessToken(value);
    if (!secret) return false;
    onChange("");
    onSecretDetected?.(secret);
    return true;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachedFiles.length > 0) && !disabled && !interceptSecret()) onSend();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = e.clipboardData.getData("text");
    const secret = extractGithubPersonalAccessToken(pastedText);
    if (!secret) return;
    e.preventDefault();
    onChange("");
    onSecretDetected?.(secret);
  }

  function handleSendClick() {
    if (!interceptSecret()) onSend();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAttach(files);
    e.target.value = "";
  }

  return (
    <div className="px-4 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl border border-edge bg-panel px-3 pb-2.5 pt-3 shadow-sm focus-within:border-cyan/50 transition-all duration-300">
          
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-lg bg-void/50 p-2 animate-fade-up custom-scrollbar">
              {attachedFiles.map((file, index) => {
                const imageIndex = attachedFiles.slice(0, index).filter((candidate) => candidate.type.startsWith("image/")).length;
                const imagePreview = file.type.startsWith("image/") ? imagePreviews[imageIndex] : undefined;
                return (
                  <div key={`${file.name}-${index}`} className="relative flex min-w-[76px] max-w-[112px] flex-col gap-1 rounded-md border border-edge bg-panel/70 p-1.5">
                    {imagePreview ? (
                      <Image src={imagePreview} alt={`Attached image preview: ${file.name}`} width={84} height={56} unoptimized className="h-14 w-full rounded object-cover" />
                    ) : (
                      <div className="flex h-14 items-center justify-center rounded bg-cyan/10 text-cyan"><Paperclip className="h-4 w-4" /></div>
                    )}
                    <p className="truncate text-[10px] font-bold text-ink" title={file.name}>{file.name}</p>
                    <p className="text-[9px] uppercase text-ink-faint">
                      {file.type === "application/pdf"
                        ? "PDF analysis"
                        : file.type.startsWith("image/")
                          ? "Image ready"
                          : file.type.startsWith("video/")
                            ? "Video preview"
                            : file.type.startsWith("audio/")
                              ? "Audio attached"
                              : "File uploaded"}
                    </p>
                    <button onClick={() => onRemoveAttach?.(index)} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-edge bg-panel text-ink-faint hover:text-red-400" aria-label={`Remove ${file.name}`}><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
            </div>
          )}

          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="Chat with NEXO AI…"
            className="max-h-40 w-full resize-none bg-transparent px-1 py-1 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onOpenSidebar && (
                <button
                  onClick={onOpenSidebar}
                  className="flex-shrink-0 text-ink-muted hover:text-ink md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition hover:border-cyan/40 hover:text-ink"
                aria-label="Attach image or file"
                title="Attach image or file"
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                onClick={onOpenLiveTalk}
                disabled={!onOpenLiveTalk}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition-all duration-300 hover:border-cyan/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Open NEXO Live"
                title="NEXO Live"
              >
                <Mic className="h-4 w-4" />
              </button>

              <ModelSelectorChip
                selected={selectedModel}
                onSelect={onSelectModel}
                unlockedTiers={unlockedTiers || ["Free"]}
              />
            </div>

            <button
              onClick={isStreaming ? onStop : handleSendClick}
              disabled={isStreaming ? !onStop : disabled || (!value.trim() && attachedFiles.length === 0)}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 hover:scale-105 active:scale-95 ${
                isStreaming
                  ? "bg-rose-500 text-white hover:bg-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.35)]"
                  : "bg-cyan text-void hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
              }`}
              aria-label={isStreaming ? `Stop generating after ${streamElapsedSeconds} seconds` : "Send message"}
              title={isStreaming ? "Stop generating" : "Send message"}
            >
              {isStreaming ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
