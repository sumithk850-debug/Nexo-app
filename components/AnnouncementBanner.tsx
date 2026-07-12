"use client";

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Signal } from "./Signal";

interface Announcement {
  id: string;
  title: string;
  message: string;
}

const DISMISS_KEY_PREFIX = "nexo_dismissed_announcement_";

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, message")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setAnnouncement(data);
        const wasDismissed = localStorage.getItem(DISMISS_KEY_PREFIX + data.id);
        setDismissed(!!wasDismissed);
      }
    }
    load();
  }, []);

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    if (announcement) {
      localStorage.setItem(DISMISS_KEY_PREFIX + announcement.id, "1");
    }
    setDismissed(true);
  }

  if (!announcement || dismissed) return null;

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 border-b border-cyan/30 bg-cyan/10 px-4 py-2.5 text-left transition hover:bg-cyan/15"
      >
        <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan" />
        <p className="min-w-0 flex-1 truncate text-sm text-ink">
          <span className="font-semibold">{announcement.title}</span>
          <span className="text-ink-muted"> — {announcement.message}</span>
        </p>
        <span
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-full p-1 text-ink-faint hover:bg-ink/10 hover:text-ink"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </span>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:px-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-edge bg-panel p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Signal size="sm" />
                <span className="font-mono text-xs uppercase tracking-widest text-cyan">
                  What&apos;s new
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-ink-faint hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan/15">
                <Sparkles className="h-5 w-5 text-cyan" />
              </div>
              <h2 className="mt-1 font-display text-xl font-bold leading-snug text-ink">
                {announcement.title}
              </h2>
            </div>

            <div className="prose-nexo mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {announcement.message}
            </div>

            <button
              onClick={(e) => {
                handleDismiss(e);
                setExpanded(false);
              }}
              className="mt-6 w-full rounded-full bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
        }
