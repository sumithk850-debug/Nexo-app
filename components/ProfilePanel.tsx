"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarDays, ChevronRight, Clock3, Mail, Settings, ShieldCheck, User, X, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";

type Announcement = {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
  version: string | null;
  image_url: string | null;
  video_url: string | null;
};

export function ProfilePanel({
  open,
  user,
  onClose,
  onOpenSettings,
  onSignOut,
}: {
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadAnnouncements() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("announcements")
        .select("id, title, message, is_active, created_at, version, image_url, video_url")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError("Announcements could not be loaded. Please try again later.");
        setAnnouncements([]);
      } else {
        setAnnouncements((data ?? []) as Announcement[]);
      }
      setLoading(false);
    }
    void loadAnnouncements();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "Not available";
  const displayName = user?.fullName?.trim() || "Name not added";

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <section
        id="kyvorix-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyvorix-profile-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-edge bg-panel shadow-2xl animate-fade-left"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-edge px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan"><User className="h-5 w-5" /></div>
            <div>
              <h2 id="kyvorix-profile-title" className="font-display text-lg font-bold text-ink">Your Profile</h2>
              <p className="text-xs text-ink-muted">Account details and KYVORIX updates</p>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} className="rounded-lg p-2 text-ink-faint transition hover:bg-void hover:text-ink" aria-label="Close profile"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Account information</h3>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">Signed in</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-edge bg-void/35">
              <div className="flex items-center gap-3 border-b border-edge p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan/15 text-cyan"><User className="h-5 w-5" /></div>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{displayName}</p><p className="text-xs text-ink-muted">KYVORIX AI account</p></div>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="flex min-w-0 items-start gap-2.5 border-b border-edge p-4 sm:border-r"><Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" /><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-ink-faint">Email address</p><p className="mt-1 break-all text-xs font-medium text-ink">{user?.email || "Not available"}</p></div></div>
                <div className="flex items-start gap-2.5 border-b border-edge p-4"><CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" /><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Member since</p><p className="mt-1 text-xs font-medium text-ink">{joinedDate}</p></div></div>
                <div className="flex items-start gap-2.5 border-b border-edge p-4 sm:border-b-0 sm:border-r"><Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" /><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Birthday</p><p className="mt-1 text-xs font-medium text-ink">{user?.birthday || "Not added"}</p></div></div>
                <div className="flex items-start gap-2.5 p-4"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" /><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Account</p><p className="mt-1 text-xs font-medium text-ink">Authenticated with Supabase</p></div></div>
              </div>
            </div>
            <button type="button" onClick={onOpenSettings} className="mt-3 flex w-full items-center justify-between rounded-xl border border-edge px-4 py-3 text-sm font-medium text-ink transition hover:border-cyan/35 hover:bg-void/35">
              <span className="flex items-center gap-2"><Settings className="h-4 w-4 text-cyan" />Account settings</span><ChevronRight className="h-4 w-4 text-ink-faint" />
            </button>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-cyan" /><h3 className="font-display text-sm font-bold text-ink">Announcements</h3></div>
              <span className="rounded-full border border-edge px-2 py-1 text-[10px] text-ink-muted">{announcements.length} updates</span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-ink-muted">KYVORIX product updates saved in the announcements archive, including previous releases.</p>
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-edge p-4 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin text-cyan" />Loading announcements…</div>
            ) : error ? (
              <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-xs text-rose-300">{error}</p>
            ) : announcements.length === 0 ? (
              <p className="rounded-xl border border-edge p-4 text-xs text-ink-muted">No announcements have been saved yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-edge bg-void/30">
                    <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-3">
                      <div className="min-w-0"><h4 className="text-sm font-semibold leading-snug text-ink">{item.title}</h4><p className="mt-1 text-[10px] text-ink-faint">{new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}{item.version ? ` · v${item.version}` : ""}</p></div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${item.is_active ? "bg-emerald-400/10 text-emerald-300" : "bg-edge text-ink-faint"}`}>{item.is_active ? "Current" : "Archive"}</span>
                    </div>
                    <div className="whitespace-pre-line px-4 py-4 text-xs leading-relaxed text-ink-muted">{item.message}</div>
                    {item.image_url && <div className="px-4 pb-4"><img src={item.image_url} alt={item.title} loading="lazy" className="max-h-64 w-full rounded-xl border border-edge object-contain" /></div>}
                    {item.video_url && <div className="px-4 pb-4"><video src={item.video_url} controls muted playsInline preload="metadata" className="w-full rounded-xl border border-edge bg-black" /></div>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-edge bg-panel px-5 py-4 sm:px-7">
          <button type="button" onClick={onSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge px-4 py-3 text-sm font-semibold text-ink-muted transition hover:border-rose-400/30 hover:bg-rose-400/5 hover:text-rose-300"><LogOut className="h-4 w-4" />Sign out</button>
        </footer>
      </section>
    </div>
  );
}
