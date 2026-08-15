"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Brain, ScreenShare, MessageSquareText, Languages, Cpu, Trash2, Save, Check, Github, LogIn, Globe, Code2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NEXO_MODELS, type NexoModelId } from "@/lib/models";
import { RepoSelector } from "./RepoSelector";

const GITHUB_CLIENT_ID = "Ov23liJrA0MJjDwCADrB";

interface UserSettings {
  custom_persona: string;
  memory_content: string;
  screen_share_enabled: boolean;
  search_grounding_enabled: boolean;
  code_review_enabled: boolean;
  response_length: "short" | "balanced" | "detailed";
  language_preference: "auto" | "sinhala" | "english";
  default_model: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  custom_persona: "",
  memory_content: "",
  screen_share_enabled: false,
  search_grounding_enabled: true,
  code_review_enabled: false,
  response_length: "balanced",
  language_preference: "auto",
  default_model: "nexio-1.1",
};

export function SettingsPanel({
  open,
  onClose,
  sessionId,
  userId,
  onClearHistory,
  onSettingsChange,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  userId?: string;
  onClearHistory: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [personaDraft, setPersonaDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memorySaveState, setMemorySaveState] = useState<"idle" | "saved" | "error">("idle");
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);

  const loadGithubConnection = useCallback(async () => {
    if (!userId) return;
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github/status?userId=${userId}`);
      const data = await res.json();
      setGithubUsername(data.connected ? data.githubUsername : null);
    } catch {
      setGithubUsername(null);
    } finally {
      setGithubLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;

    // Long-term settings belong to the authenticated user, not to the browser
    // session. This lets the same saved memory follow the user across devices.
    if (userId) {
      void loadSettings(userId);
      void loadGithubConnection();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setMemoryDraft("");
      setPersonaDraft("");
      setLoading(false);
    }
  }, [open, userId, loadGithubConnection]);

  async function loadSettings(settingsUserId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", settingsUserId)
      .maybeSingle();

    if (error) {
      console.error("[settings] Could not load user settings:", error.message);
    }

    if (data) {
      const loaded = {
        memory_content: data.memory_content ?? "",
        screen_share_enabled: data.screen_share_enabled ?? false,
        search_grounding_enabled: data.search_grounding_enabled ?? true,
        code_review_enabled: data.code_review_enabled ?? false,
        response_length: data.response_length ?? "balanced",
        language_preference: data.language_preference ?? "auto",
        default_model: data.default_model ?? "nexio-1.1",
        custom_persona: data.custom_persona ?? "",
      };
      setSettings(loaded);
      setMemoryDraft(loaded.memory_content);
      setPersonaDraft(loaded.custom_persona);
    }
    setLoading(false);
  }

  function handleConnectGithub() {
    if (!userId) {
      alert("Please wait a moment and try again — your account is still loading.");
      return;
    }
    const redirectUri = `${window.location.origin}/api/github/callback`;
    // Request 'repo' scope for private repos + 'read:user' for profile info
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%20read:user&state=${userId}`;
    window.location.href = authUrl;
  }

  async function handleDisconnectGithub() {
    if (!userId) return;
    await fetch(`/api/github/status?userId=${userId}`, { method: "DELETE" });
    setGithubUsername(null);
  }

  async function saveSettings(
    next: UserSettings,
    optimistic = true
  ): Promise<{ success: boolean; error?: string }> {
    // Toggles and preference buttons must respond immediately to a touch. Their
    // local state is applied first while the database write continues in the
    // background; a failed write never makes the control feel unresponsive.
    const applyLocalSettings = () => {
      setSettings(next);
      onSettingsChange?.(next);
    };

    if (optimistic) applyLocalSettings();

    if (!userId) {
      const error = "Sign in is required before saving long-term memory.";
      console.warn("[settings]", error);
      return { success: false, error };
    }

    const values = { ...next, updated_at: new Date().toISOString() };

    // First update the user's existing row. If this is the first saved memory,
    // insert a new row instead. This does not depend on a user_id unique-index
    // conflict target and works with the user_id table already in production.
    const { data: updated, error: updateError } = await supabase
      .from("user_settings")
      .update(values)
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (updateError) {
      console.error("[settings] Could not update user settings:", updateError.message);
      return { success: false, error: updateError.message };
    }

    if (!updated) {
      const { error: insertError } = await supabase
        .from("user_settings")
        .insert({ user_id: userId, ...values });

      if (insertError) {
        console.error("[settings] Could not create user settings:", insertError.message);
        return { success: false, error: insertError.message };
      }
    }

    if (!optimistic) applyLocalSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    return { success: true };
  }

  
  async function handleSavePersona() {
    setMemorySaving(true);
    await saveSettings({ ...settings, custom_persona: personaDraft }, false);
    setMemorySaving(false);
  }

  async function handleSaveMemory() {
    setMemorySaving(true);
    setMemorySaveState("idle");
    try {
      const result = await saveSettings({ ...settings, memory_content: memoryDraft }, false);
      setMemorySaveState(result.success ? "saved" : "error");
    } finally {
      setMemorySaving(false);
    }
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

  const personaDirty = personaDraft !== settings.custom_persona;


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
            {/* GitHub Connection */}
            <section>
              <div className="flex items-center gap-2 text-ink">
                <Github className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">GitHub</h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Connect your GitHub account so NEXO Craft V3 can read your repositories and propose code changes for your approval.
              </p>

              {!userId ? (
                <p className="mt-2 text-xs text-ink-faint">Sign in to your NEXO account first to connect GitHub.</p>
              ) : githubLoading ? (
                <p className="mt-2 text-xs text-ink-faint">Checking connection…</p>
              ) : githubUsername ? (
                <>
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-edge bg-void px-3 py-2.5">
                    <span className="text-sm text-ink">
                      Connected as <span className="font-semibold">@{githubUsername}</span>
                    </span>
                    <button
                      onClick={handleDisconnectGithub}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                  {userId && <RepoSelector userId={userId} />}
                </>
              ) : (
                <button
                  onClick={handleConnectGithub}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-void py-2.5 text-sm font-medium text-ink transition hover:border-cyan/40"
                >
                  <LogIn className="h-4 w-4" />
                  Connect GitHub
                </button>
              )}
            </section>

            {/* Long-term Memory */}
            <section className="border-t border-edge pt-5">
              <div className="flex items-center gap-2 text-ink">
                <Brain className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold">Long-term Memory</h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Add anything you want NEXO to always remember about you — your name, preferences, or context. Tap Save to store it permanently.
              </p>
              <textarea
                value={memoryDraft}
                onChange={(e) => {
                  setMemoryDraft(e.target.value);
                  setMemorySaveState("idle");
                }}
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
                {memorySaving
                  ? "Saving…"
                  : memorySaveState === "error"
                  ? "Save failed — retry"
                  : memorySaveState === "saved" || !memoryDirty
                  ? "Saved"
                  : "Save memory"}
              </button>
            </section>

            {/* Web Search Grounding */}
            <section className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">Web Search Grounding</h3>
                  <p className="text-xs text-ink-muted">Allow NEXO to search the web for fresh, up-to-date information when answering your questions.</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, search_grounding_enabled: !settings.search_grounding_enabled })}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                  settings.search_grounding_enabled ? "bg-cyan" : "bg-edge"
                }`}
                aria-label="Toggle web search grounding"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    settings.search_grounding_enabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </section>

            {/* Code Review Mode */}
            <section className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <Code2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">Code Review Mode</h3>
                  <p className="text-xs text-ink-muted">When enabled, Craft V3 will provide deep code analysis — reviewing quality, bugs, and suggesting improvements for any code you share.</p>
                </div>
              </div>
              <button
                onClick={() => saveSettings({ ...settings, code_review_enabled: !settings.code_review_enabled })}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                  settings.code_review_enabled ? "bg-cyan" : "bg-edge"
                }`}
                aria-label="Toggle code review mode"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    settings.code_review_enabled ? "left-5" : "left-0.5"
                  }`}
                />
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
