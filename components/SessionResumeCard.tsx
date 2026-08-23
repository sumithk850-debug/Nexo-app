"use client";

import { useEffect, useState } from "react";
import { History, ArrowRight, X } from "lucide-react";
import type { DbChat } from "@/lib/supabase";

const DISMISS_KEY = "nexo_session_resume_dismissed";

export function SessionResumeCard({
  recentChats,
  onSelectChat,
  onDismiss,
}: {
  recentChats: DbChat[];
  onSelectChat: (chatId: string) => void;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
      // A short cooling-off period keeps this recovery aid useful without repeatedly
      // interrupting a user who has already dismissed it during the current day.
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    } catch {
      // Resume suggestions are optional and must never block the workspace.
    }
  }, []);

  // Filter to chats that look like real conversations (have a meaningful title)
  const resumeCandidates = recentChats
    .filter((c) => c.title && c.title !== "New chat" && c.title.length > 3)
    .slice(0, 3);

  if (dismissed || resumeCandidates.length === 0) return null;

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    onDismiss?.();
  }

  return (
    <div className="mx-4 mb-4 animate-fade-up">
      <div className="rounded-2xl border border-edge bg-panel shadow-lg backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan/10">
              <History className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Welcome back! 👋</h3>
              <p className="text-xs text-ink-muted">Continue from where you left off</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition hover:bg-void hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-1 px-4 pb-4">
          {resumeCandidates.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onSelectChat(chat.id);
                handleDismiss();
              }}
              className="group flex items-center gap-2.5 rounded-xl border border-edge/50 bg-void/40 px-3 py-2.5 text-left transition hover:border-cyan/30 hover:bg-cyan/5"
            >
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-panel">
                <ArrowRight className="h-3 w-3 text-cyan/60 transition group-hover:text-cyan" />
              </div>
              <span className="truncate text-xs font-medium text-ink-muted transition group-hover:text-ink">
                {chat.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
