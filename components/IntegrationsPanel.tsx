"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Github,
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
      className={`relative h-6 w-11 rounded-full transition ${
        enabled ? "bg-cyan" : "bg-ink-faint/30"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      title={enabled ? "Turn integration off" : "Turn integration on"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
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
              <button onClick={connectGithub} disabled={!userId} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-panel py-2 text-xs font-semibold text-ink transition hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-50">
                <LogIn className="h-3.5 w-3.5" /> Connect GitHub
              </button>
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
                  <StatusBadge connected={status.vercel.connected} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Deployment status, build output, and runtime logs. Deployment actions will always ask for approval.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-[11px] text-ink-faint">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan" />
              {status.vercel.connected ? "Read-only connection ready" : "Connect credentials when you are ready"}
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
                  <StatusBadge connected={status.supabase.connected} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Database schema, table inspection, and project data. SQL writes and migrations will always ask for approval.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-[11px] text-ink-faint">
              <Link2 className="h-3.5 w-3.5 text-emerald-400" />
              {status.supabase.connected ? "App database connection ready" : "Supabase credentials are not configured"}
            </div>
          </article>

          {loading && <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking connections…</div>}
        </div>
      </section>
    </div>
  );
}
