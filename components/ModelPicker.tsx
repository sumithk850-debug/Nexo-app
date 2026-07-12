"use client";

import { NEXO_MODELS, type NexoModelId } from "@/lib/models";
import { Lock } from "lucide-react";

const tierAccent: Record<string, string> = {
  Free: "border-l-ink-faint",
  Galex: "border-l-cyan",
  Brainex: "border-l-indigo",
  Craft: "border-l-cyan-glow",
};

export function ModelPicker({
  selected,
  onSelect,
  unlockedTiers,
}: {
  selected: NexoModelId;
  onSelect: (id: NexoModelId) => void;
  unlockedTiers: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {NEXO_MODELS.map((model) => {
        const isLocked = !unlockedTiers.includes(model.tier);
        const isSelected = selected === model.id;
        return (
          <button
            key={model.id}
            onClick={() => !isLocked && onSelect(model.id)}
            disabled={isLocked}
            className={`group flex items-center justify-between rounded-lg border-l-2 px-3 py-2.5 text-left transition ${
              tierAccent[model.tier]
            } ${
              isSelected
                ? "bg-panel-raised"
                : "hover:bg-panel-raised/60"
            } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <div className="min-w-0">
              <p
                className={`truncate font-display text-sm font-semibold ${
                  isSelected ? "text-cyan" : "text-ink"
                }`}
              >
                {model.name}
              </p>
              <p className="truncate text-xs text-ink-muted">{model.tagline}</p>
            </div>
            {isLocked && (
              <Lock className="ml-2 h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
            )}
          </button>
        );
      })}
    </div>
  );
}
