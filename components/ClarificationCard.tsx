import React, { useState } from "react";
import { HelpCircle, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import type { ClarificationCardData } from "@/lib/clarificationParser";

export function ClarificationCard({
  card,
  onSelect,
}: {
  card: ClarificationCardData;
  onSelect: (selectedId: string, customText?: string) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleConfirm() {
    if (!selectedOption && !customInput.trim()) return;
    setSubmitted(true);
    onSelect(selectedOption ?? "custom", customInput.trim() || undefined);
  }

  return (
    <div className="my-3 rounded-2xl border border-cyan/30 bg-cyan/5 p-4 shadow-md backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan">
              <Sparkles className="h-3 w-3" /> Clarification Required
            </span>
          </div>
          <h4 className="mt-1.5 font-display text-sm font-semibold text-ink leading-snug">
            {card.question}
          </h4>

          <div className="mt-3 space-y-2">
            {card.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                    isSelected
                      ? "border-cyan bg-cyan/15 text-ink font-medium shadow-sm"
                      : "border-edge bg-void/60 text-ink-muted hover:border-cyan/40 hover:text-ink"
                  } ${submitted ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] ${
                      isSelected ? "border-cyan bg-cyan text-void font-bold" : "border-edge"
                    }`}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {card.allowCustomInput && !submitted && (
            <div className="mt-3">
              <input
                type="text"
                value={customInput}
                onChange={(event) => {
                  setCustomInput(event.target.value);
                  if (event.target.value) setSelectedOption(null);
                }}
                placeholder="Or type your specific requirement..."
                className="w-full rounded-xl border border-edge bg-void/80 px-3.5 py-2 text-xs text-ink outline-none transition focus:border-cyan/60"
              />
            </div>
          )}

          {!submitted ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!selectedOption && !customInput.trim()}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 rounded-xl bg-cyan px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-dim disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue with Selection <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Selection recorded. Continuing execution...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
