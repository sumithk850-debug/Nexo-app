"use client";

import { useState, useEffect, useRef } from "react";
import { Signal } from "./Signal";
import { getLoadingMessage } from "@/lib/loadingMessages";

export function TypingIndicator({ modelId }: { modelId?: string }) {
  const [message, setMessage] = useState(() => getLoadingMessage());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMessage(getLoadingMessage());
    }, 2200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-edge bg-panel">
        <Signal size="sm" />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-xs text-ink-muted">{message}</span>
        {modelId && (
          <span className="text-[10px] text-ink-faint uppercase tracking-wider">{modelId} is thinking...</span>
        )}
      </div>
    </div>
  );
}
