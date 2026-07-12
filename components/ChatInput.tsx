"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowUp, Menu, Plus } from "lucide-react";
import { ModelSelectorChip } from "./ModelSelectorChip";
import type { NexoModelId } from "@/lib/models";

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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  onOpenSidebar: () => void;
  selectedModel: NexoModelId;
  onSelectModel: (id: NexoModelId) => void;
  unlockedTiers: string[];
  onAttach: (file: File) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = "";
  }

  return (
    <div className="border-t border-edge bg-void/95 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-edge bg-panel px-3 pb-2.5 pt-3 shadow-sm focus-within:border-cyan/50">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chat with NEXO…"
            className="max-h-40 w-full resize-none bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSidebar}
                className="flex-shrink-0 text-ink-muted hover:text-ink md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition hover:border-cyan/40 hover:text-ink"
                aria-label="Attach file"
              >
                <Plus className="h-4 w-4" />
              </button>

              <ModelSelectorChip
                selected={selectedModel}
                onSelect={onSelectModel}
                unlockedTiers={unlockedTiers}
              />
            </div>

            <button
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan text-white transition disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-ink-faint">
          NEXO can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
