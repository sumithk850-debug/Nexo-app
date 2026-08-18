"use client";

import { useState, useRef, useEffect } from "react";
import { NEXO_MODELS, type NexoModelId } from "@/lib/models";
import { ChevronDown, Lock, Check, Zap } from "lucide-react";

const ULTRA_SPEED_MODEL_IDS = new Set<NexoModelId>([
  "spadec-3.5",
  "galex-4.0",
  "brainex-10.8",
  "craft-v3",
]);

export function ModelSelectorChip({
  selected,
  onSelect,
  unlockedTiers,
}: {
  selected: NexoModelId;
  onSelect: (id: NexoModelId) => void;
  unlockedTiers: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeModel = NEXO_MODELS.find((m) => m.id === selected);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs font-medium text-ink transition hover:border-cyan/40"
      >
        {activeModel?.name ?? "Select model"}
        {activeModel && ULTRA_SPEED_MODEL_IDS.has(activeModel.id) && (
          <span className="hidden items-center gap-0.5 rounded-full bg-cyan/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan sm:inline-flex">
            <Zap className="h-2.5 w-2.5" aria-hidden="true" />
            UltraSpeed
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-edge bg-panel-raised p-1.5 shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan">
            <Zap className="h-3 w-3" aria-hidden="true" />
            Nexo UltraSpeed
          </div>
          {NEXO_MODELS.map((model) => {
            const isLocked = !unlockedTiers.includes(model.tier);
            const isSelected = model.id === selected;
            return (
              <button
                key={model.id}
                onClick={() => {
                  if (isLocked) return;
                  onSelect(model.id);
                  setOpen(false);
                }}
                disabled={isLocked}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                  isSelected ? "bg-void" : "hover:bg-void/60"
                } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-sm font-semibold text-ink">
                      {model.name}
                    </p>
                    {ULTRA_SPEED_MODEL_IDS.has(model.id) && (
                      <span className="rounded border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-cyan">
                        UltraSpeed
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-muted">
                    {model.tagline}
                  </p>
                </div>
                {isLocked ? (
                  <Lock className="ml-2 h-4 w-4 flex-shrink-0 text-ink-faint" />
                ) : isSelected ? (
                  <Check className="ml-2 h-4 w-4 flex-shrink-0 text-cyan" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
