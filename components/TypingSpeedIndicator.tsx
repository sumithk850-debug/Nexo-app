"use client";

import { Gauge, Zap, Loader2 } from "lucide-react";

/**
 * Calculates typing speed (chars/sec) during streaming.
 * Tracks character accumulation over time windows.
 */
export function useTypingSpeed(isStreaming: boolean, contentLength: number) {
  // This is handled via the parent component using a ref and interval
  // The component itself just displays the metric
  return null;
}

export function TypingSpeedBadge({ charsPerSecond, streaming }: { charsPerSecond: number; streaming: boolean }) {
  if (!streaming || charsPerSecond <= 0) return null;

  const displaySpeed = Math.min(Math.round(charsPerSecond), 999);
  const isFast = charsPerSecond > 50;
  const isMedium = charsPerSecond > 20;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        isFast
          ? "bg-green-500/10 text-green-400"
          : isMedium
            ? "bg-cyan/10 text-cyan"
            : "bg-amber-500/10 text-amber-400"
      }`}
    >
      <Loader2 className="h-2.5 w-2.5 animate-spin" />
      {isFast ? <Zap className="h-2.5 w-2.5" /> : <Gauge className="h-2.5 w-2.5" />}
      <span className="font-mono">{displaySpeed}</span>
      <span className="opacity-70">chars/s</span>
    </div>
  );
}

/**
 * Standalone typing speed pill shown when LiveStatusBar has no actions/searching.
 */
export function TypingSpeedPill({ charsPerSecond }: { charsPerSecond: number }) {
  if (charsPerSecond <= 0) return null;

  const displaySpeed = Math.min(Math.round(charsPerSecond), 999);
  const isFast = charsPerSecond > 50;
  const isMedium = charsPerSecond > 20;

  return (
    <div
      className={`mx-4 mb-2 flex items-center justify-center gap-2 rounded-xl border border-edge bg-panel px-4 py-2 text-xs font-medium ${
        isFast
          ? "text-green-400"
          : isMedium
            ? "text-cyan"
            : "text-amber-400"
      }`}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="font-medium text-ink">Generating response</span>
      <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-mono text-[10px]">
        {displaySpeed} chars/s
      </span>
    </div>
  );
}
