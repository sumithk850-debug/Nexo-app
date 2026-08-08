"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Rocket } from "lucide-react";
import { supabase } from "@/lib/supabase";

const APP_VERSION = "2.0.0";
const DISMISS_KEY_PREFIX = "nexo_dismissed_announcement_";

interface Announcement {
  id: string;
  title: string;
  message: string;
  version: string;
}

function isVersionNewer(remoteVersion: string, localVersion: string): boolean {
  const parse = (v: string) =>
    v.split(".").map((n) => parseInt(n, 10) || 0);
  const remote = parse(remoteVersion);
  const local = parse(localVersion);
  for (let i = 0; i < Math.max(remote.length, local.length); i++) {
    const r = remote[i] ?? 0;
    const l = local[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, message, version")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.version && isVersionNewer(data.version, APP_VERSION)) {
        setAnnouncement(data);
        const wasDismissed = localStorage.getItem(DISMISS_KEY_PREFIX + data.id);
        setDismissed(!!wasDismissed);
        if (!wasDismissed) {
          // Small delay for a smooth entrance
          requestAnimationFrame(() => setIsVisible(true));
        }
      }
    }
    load();
  }, []);

  function handleDismiss() {
    if (announcement) {
      localStorage.setItem(DISMISS_KEY_PREFIX + announcement.id, "1");
    }
    setDismissed(true);
    setIsVisible(false);
  }

  function handleUpdateNow() {
    // Update acknowledged — mark this announcement as seen
    if (announcement) {
      localStorage.setItem(DISMISS_KEY_PREFIX + announcement.id, "1");
    }
    setDismissed(true);
    setIsVisible(false);
    // Reload the page to get the latest build
    window.location.reload();
  }

  if (!announcement || dismissed) return null;

  const lines = announcement.message.split("\n").filter((l) => l.trim() !== "");

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-edge bg-panel shadow-2xl transition-all duration-300 ${
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan/15">
              <Rocket className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                Nexo AI New Update Available!
              </h3>
              {announcement.version && (
                <span className="font-mono text-xs text-cyan">
                  Version {announcement.version}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <div className="px-6 pt-5 pb-2">
          <h2 className="font-display text-xl font-bold leading-snug text-ink">
            {announcement.title}
          </h2>
        </div>

        {/* Body — features as bullet points */}
        <div className="px-6 py-3 space-y-2">
          {lines.map((line, i) => {
            const isBullet = line.trimStart().startsWith("•") || line.trimStart().startsWith("-") || line.trimStart().startsWith("*");
            const trimmed = line.trim();
            if (isBullet) {
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyan" />
                  <span className="text-sm leading-relaxed text-ink-muted">{trimmed.slice(1).trim()}</span>
                </div>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed text-ink-muted">
                {trimmed}
              </p>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 flex gap-3 border-t border-edge bg-panel px-6 py-4">
          <button
            onClick={handleUpdateNow}
            className="flex-1 rounded-xl bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim"
          >
            Update Now
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-edge py-2.5 text-sm font-medium text-ink-muted transition hover:border-cyan/40 hover:text-ink"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
