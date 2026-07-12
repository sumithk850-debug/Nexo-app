"use client";

import { useState, useEffect } from "react";
import { X, Brain, ScreenShare, MessageSquareText, Languages, Cpu, Trash2, Save, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NEXO_MODELS, type NexoModelId } from "@/lib/models";

interface UserSettings {
  memory_content: string;
  screen_share_enabled: boolean;
  response_length: "short" | "balanced" | "detailed";
  language_preference: "auto" | "sinhala" | "english";
  default_model: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  memory_content: "",
  screen_share_enabled: false,
  response_length: "balanced",
  language_preference: "auto",
  default_model: "nexio-1.1",
};

export function SettingsPanel({
  open,
  onClose,
  sessionId,
  onClearHistory,
  onSettingsChange,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onClearHistory: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && sessionId) loadSettings();
  }, [open, sessionId]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (data) {
      const loaded = {
        memory_content: data.memory_content ?? "",
        screen_share_enabled: data.screen_share_enabled ?? false,
        response_length: data.response_length ?? "balanced",
        language_preference: data.language_preference ?? "auto",
        default_model: data.default_model ?? "nexio-1.1",
      };
      setSettings(loaded);
      setMemoryDraft(loaded.memory_content);
    }
    setLoading(false);
  }

  async function saveSettings(next: UserSettings) {
    setSettings(next);
    await supabase.from("user_settings").upsert(
      { session_id: sessionId, ...next, updated_at: new Date().toISOString() },
      { onConflict: "session_id" }
    );
    onSettingsChange?.(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleSaveMemory() {
    setMemorySaving(true);
    await saveSettings({ ...settings, memory_content: memoryDraft });
    setMemorySaving(false);
  }

  function handleClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearHistory();
    setConfirmClear(false);
  }

  if (!open) return null;

  const memoryDirty = memoryDraft !== settings.memory_content;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-sm overflow-y-auto border-l border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-edge bg-panel px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">Settings</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-ink-muted">Loading…</div>
        ) : (
          <div className="space-y-6 p-5">
            {/* Long-term Memory */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Brain className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Long-term Memory</h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Add anything you want NEXO to always remember about you — your name, preferences, or context. Tap Save to store it permanently.
              </p>
              <textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="e.g. My name is Hasith, I'm a developer from Sri Lanka…"
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-edge bg-void px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-cyan/50"
              />
              <button
                onClick={handleSaveMemory}
                disabled={!memoryDirty || memorySaving}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan py-2 text-sm font-semibold text-white transition hover:bg-cyan-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {memorySaving ? "Saving…" : memoryDirty ? "Save memory" : "Saved"}
              </button>
            </section>

            {/* Screen Share */}
            <section className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <ScreenShare className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">Share screen with NEXO</h3>
                  <p className="text-xs text-ink-muted">Allow NEXO to request screen access during chats.</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, screen_share_enabled: !settings.screen_share_enabled })}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                  settings.screen_share_enabled ? "bg-cyan" : "bg-edge"
                }`}
                aria-label="Toggle screen share permission"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    settings.screen_share_enabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </section>

            {/* Response Length */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <MessageSquareText className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Response Length</h3>
              </div>
              <div className="mt-2 flex gap-2">
                {(["short", "balanced", "detailed"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveSettings({ ...settings, response_length: opt })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                      settings.response_length === opt
                        ? "border-cyan bg-cyan/10 text-cyan"
                        : "border-edge text-ink-muted hover:border-cyan/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </section>

            {/* Language Preference */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Languages className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Language</h3>
              </div>
              <div className="mt-2 flex gap-2">
                {(["auto", "sinhala", "english"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => saveSettings({ ...settings, language_preference: opt })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                      settings.language_preference === opt
                        ? "border-cyan bg-cyan/10 text-cyan"
                        : "border-edge text-ink-muted hover:border-cyan/30"
                    }`}
                  >
                    {opt === "auto" ? "Auto" : opt}
                  </button>
                ))}
              </div>
            </section>

            {/* Default Model */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Cpu className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Default Model</h3>
              </div>
              <select
                value={settings.default_model}
                onChange={(e) => saveSettings({ ...settings, default_model: e.target.value })}
                className="mt-2 w-full rounded-lg border border-edge bg-void px-3 py-2 text-sm text-ink focus:outline-none focus:border-cyan/50"
              >
                {NEXO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </section>

            {/* Clear History */}
            <section className="border-t border-edge pt-5">
              <button
                onClick={handleClearHistory}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  confirmClear
                    ? "border-red-500 bg-red-500/10 text-red-500"
                    : "border-edge text-ink-muted hover:border-red-500/40 hover:text-red-500"
                }`}
              >
                <Trash2 className="h-4 w-4" />
                {confirmClear ? "Tap again to confirm" : "Clear all chat history"}
              </button>
            </section>

            {saved && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-cyan">
                <Check className="h-3.5 w-3.5" />
                Saved
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
