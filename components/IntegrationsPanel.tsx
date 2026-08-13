"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Github,
  KeyRound,
  Link2,
  Loader2,
  LogIn,
  Plug,
  Power,
  ShieldCheck,
  Triangle,
  X,
} from "lucide-react";

interface IntegrationStatus {
  github: {
    connected: boolean;
    username: string | null;
    canWrite: boolean;
    selectedRepo: string | null;
  };
  vercel: { connected: boolean };
  supabase: { connected: boolean };
}

interface IntegrationsPanelProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  githubEnabled: boolean;
  onGithubEnabledChange: (enabled: boolean) => void;
}

const INITIAL_STATUS: IntegrationStatus = {
  github: { connected: false, username: null, canWrite: false, selectedRepo: null },
  vercel: { connected: false },
  supabase: { connected: false },
};

function StatusBadge({ connected, enabled }: { connected: boolean; enabled?: boolean }) {
  const isOn = connected && enabled !== false;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isOn ? "bg-emerald-500/10 text-emerald-400" : "bg-ink-faint/10 text-ink-muted"
      }`}
    >
      {isOn ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {isOn ? "Connected" : connected ? "Paused" : "Not connected"}
    </span>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-7 w-12 rounded-full p-[3px] shadow-inner transition-colors ${
        enabled ? "bg-cyan" : "bg-ink-faint/30"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      title={enabled ? "Turn integration off" : "Turn integration on"}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
          enabled ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Coming soon
    </span>
  );
}

export function IntegrationsPanel({
  open,
  onClose,
  userId,
  githubEnabled,
  onGithubEnabledChange,
}: IntegrationsPanelProps) {
  const [status, setStatus] = useState<IntegrationStatus>(INITIAL_STATUS);
  const [loading, setLoading] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [personalTokenMode, setPersonalTokenMode] = useState(false);
  const [personalToken, setPersonalToken] = useState("");
  const [secretDetected, setSecretDetected] = useState(false);
  const [patSaving, setPatSaving] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const response = await fetch(`/api/integrations/status${query}`, { cache: "no-store" });
      if (response.ok) setStatus(await response.json());
    } catch {
      setStatus(INITIAL_STATUS);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) void loadStatus();
  }, [open, loadStatus]);

  function connectGithub() {
    if (!userId) return;
    window.location.href = `/api/github/login?userId=${encodeURIComponent(userId)}`;
  }

  async function disconnectGithub() {
    if (!userId) return;
    await fetch(`/api/github/status?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    onGithubEnabledChange(false);
    setDisconnectConfirm(false);
    await loadStatus();
  }

  async function savePersonalToken() {
    if (!userId || !personalToken.trim()) return;
    setPatSaving(true);
    setPatError(null);
    try {
      const response = await fetch("/api/github/personal-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token: personalToken.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPatError(data.error ?? "Could not validate this GitHub secret.");
        return;
      }
      // Clear the browser value immediately after the server accepts it.
      setPersonalToken("");
      setSecretDetected(false);
      setPersonalTokenMode(false);
      onGithubEnabledChange(true);
      await loadStatus();
    } catch {
      setPatError("Could not connect GitHub. Please try again.");
    } finally {
      setPatSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <section
        className="h-full w-full max-w-sm overflow-y-auto border-l border-edge bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        aria-label="Integrations"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-panel px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
              <Plug className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Integrations</h2>
              <p className="text-[11px] text-ink-muted">Control connected developer services</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint transition hover:bg-void hover:text-ink" aria-label="Close integrations">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-ink-muted">
            Connections are read-only by default. Any repository write, deployment, SQL write, or migration will require explicit approval before it runs.
          </p>

          <article className="rounded-2xl border border-edge bg-void/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-ink">
                <Github className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-ink">GitHub</h3>
                  <StatusBadge connected={status.github.connected} enabled={githubEnabled} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Repository context, file proposals, approval cards, and commits.
                </p>
                {status.github.connected && (
                  <p className="mt-2 truncate font-mono text-[11px] text-ink-faint" title={status.github.selectedRepo ?? undefined}>
                    @{status.github.username}{status.github.selectedRepo ? ` · ${status.github.selectedRepo}` : " · no repository selected"}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Power className="h-3.5 w-3.5" />
                Enable GitHub
              </div>
              <Toggle enabled={githubEnabled} onChange={onGithubEnabledChange} disabled={!status.github.connected} />
            </div>

            {!status.github.connected ? (
              personalTokenMode ? (
                <div className="mt-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <KeyRound className="h-3.5 w-3.5 text-cyan" /> Personal Access Token
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                    Paste a GitHub token here only. It is detected as a secret, encrypted on the server, and never displayed in chat or sent to the AI model.
                  </p>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={personalToken}
                    onPaste={() => setSecretDetected(true)}
                    onChange={(event) => {
                      setPersonalToken(event.target.value);
                      setSecretDetected(Boolean(event.target.value));
                    }}
                    placeholder="Paste secret token"
                    className="mt-3 w-full rounded-lg border border-edge bg-void px-3 py-2 font-mono text-xs text-ink outline-none transition focus:border-cyan/60"
                    aria-label="GitHub Personal Access Token secret"
                  />
                  {secretDetected && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                      <ShieldCheck className="h-3.5 w-3.5" /> Secret detected — this value will be stored as a protected connection secret.
                    </div>
                  )}
                  {patError && <p className="mt-2 text-[11px] text-red-400">{patError}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setPersonalToken("");
                        setSecretDetected(false);
                        setPatError(null);
                        setPersonalTokenMode(false);
                      }}
                      className="rounded-md px-2.5 py-1.5 text-xs text-ink-muted transition hover:bg-panel hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePersonalToken}
                      disabled={!userId || !personalToken.trim() || patSaving}
                      className="flex items-center gap-1.5 rounded-md bg-cyan px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {patSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Save secret
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={connectGithub} disabled={!userId} className="flex items-center justify-center gap-2 rounded-lg border border-edge bg-panel py-2 text-xs font-semibold text-ink transition hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-50">
                    <LogIn className="h-3.5 w-3.5" /> OAuth
                  </button>
                  <button onClick={() => setPersonalTokenMode(true)} disabled={!userId} className="flex items-center justify-center gap-2 rounded-lg border border-edge bg-panel py-2 text-xs font-semibold text-ink transition hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-50">
                    <KeyRound className="h-3.5 w-3.5" /> Use token
                  </button>
                </div>
              )
            ) : disconnectConfirm ? (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs text-red-300">Disconnect GitHub? Nexo will lose repository access until you connect again.</p>
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setDisconnectConfirm(false)} className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-panel">Cancel</button>
                  <button onClick={disconnectGithub} className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white">Disconnect</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setDisconnectConfirm(true)} className="mt-3 text-xs font-medium text-red-400 hover:underline">Disconnect GitHub</button>
            )}
          </article>

          <article className="rounded-2xl border border-edge bg-void/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-ink">
                <Triangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-ink">Vercel</h3>
                  <ComingSoonBadge />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Deployment status, build output, and runtime logs will be available in a future update.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-[11px] text-ink-faint">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
              Vercel integration is coming soon
            </div>
          </article>

          <article className="rounded-2xl border border-edge bg-void/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Database className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-ink">Supabase</h3>
                  <ComingSoonBadge />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Database schema, table inspection, and project actions will be available in a future update.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-[11px] text-ink-faint">
              <Link2 className="h-3.5 w-3.5 text-amber-300" />
              Supabase integration is coming soon
            </div>
          </article>

          {loading && <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking connections…</div>}
        </div>
      </section>
    </div>
  );
}
