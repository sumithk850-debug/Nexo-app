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
import { authenticatedFetch } from "@/lib/authFetch";

interface IntegrationStatus {
  github: {
    connected: boolean;
    username: string | null;
    canWrite: boolean;
    selectedRepo: string | null;
  };
  vercel: { connected: boolean; username: string | null };
  supabase: { connected: boolean; username: string | null };
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
  vercel: { connected: false, username: null },
  supabase: { connected: false, username: null },
};

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  productionUrl: string | null;
}

interface VercelDeployment {
  id: string;
  url: string;
  readyState: string;
  createdAt: number | string;
  meta: { gitCommitMessage: string | null } | null;
  isProduction: boolean;
  projectId: string;
  ready: boolean | null;
}

interface SupabaseProject {
  id: string;
  name: string;
  region: string | null;
}

interface ApprovalState {
  kind: "vercel-promote" | "supabase-sql";
  projectId: string;
  projectName: string;
  deploymentId?: string;
  deploymentUrl?: string;
  sql?: string;
  busy: boolean;
  error: string | null;
}

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

function vercelCallbackError(reason: string | null): string {
  switch (reason) {
    case "save_failed":
      return "The connection could not be saved. Please check the Integrations page and try connecting again.";
    case "token_exchange_failed":
      return "Vercel did not return a valid access token. Please check your Vercel OAuth app credentials and try again.";
    case "missing_code":
      return "The Vercel authorization did not complete. Please try connecting again.";
    case "not_configured":
      return "Vercel OAuth credentials are not configured on the server.";
    default:
      return "Connecting to Vercel failed. Please try again.";
  }
}

function supabaseCallbackError(reason: string | null): string {
  switch (reason) {
    case "save_failed":
      return "The connection could not be saved. Please check the Integrations page and try connecting again.";
    case "token_exchange_failed":
      return "Supabase did not return a valid access token. Please try connecting again.";
    case "missing_code":
      return "The Supabase authorization did not complete. Please try connecting again.";
    default:
      return "Connecting to Supabase failed. Please try again.";
  }
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
  const [connectionMessage, setConnectionMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [vercelDisconnectConfirm, setVercelDisconnectConfirm] = useState(false);
  const [supabaseDisconnectConfirm, setSupabaseDisconnectConfirm] = useState(false);
  const [supabaseConnecting, setSupabaseConnecting] = useState(false);
  const [personalTokenMode, setPersonalTokenMode] = useState(false);
  const [personalToken, setPersonalToken] = useState("");
  const [secretDetected, setSecretDetected] = useState(false);
  const [patSaving, setPatSaving] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);

  // Vercel live data
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [vercelDeployments, setVercelDeployments] = useState<Record<string, VercelDeployment[]>>({});
  const [vercelDataLoading, setVercelDataLoading] = useState(false);
  const [vercelDataError, setVercelDataError] = useState<string | null>(null);
  const [vercelExpanded, setVercelExpanded] = useState(false);

  // Supabase live data
  const [supabaseProjectId, setSupabaseProjectId] = useState<string | null>(null);
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseProject[]>([]);
  const [supabaseTables, setSupabaseTables] = useState<unknown[]>([]);
  const [supabaseColumns, setSupabaseColumns] = useState<unknown[]>([]);
  const [supabaseDataLoading, setSupabaseDataLoading] = useState(false);
  const [supabaseDataError, setSupabaseDataError] = useState<string | null>(null);
  const [supabaseExpanded, setSupabaseExpanded] = useState(false);
  const [supabaseSql, setSupabaseSql] = useState("");
  const [supabaseSqlResult, setSupabaseSqlResult] = useState<string | null>(null);

  // Approval card state
  const [approval, setApproval] = useState<ApprovalState | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const response = await authenticatedFetch(`/api/integrations/status${query}`, { cache: "no-store" });
      if (response.ok) setStatus(await response.json());
    } catch {
      setStatus(INITIAL_STATUS);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadVercelData = useCallback(async () => {
    if (!userId) return;
    setVercelDataLoading(true);
    setVercelDataError(null);
    try {
      const response = await authenticatedFetch(`/api/vercel/deployments?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setVercelDataError(data.error ?? "Could not load Vercel data.");
        return;
      }
      setVercelProjects(data.projects ?? []);
      setVercelDeployments(data.deployments ?? {});
    } catch {
      setVercelDataError("Could not load Vercel data.");
    } finally {
      setVercelDataLoading(false);
    }
  }, [userId]);

  // Remember the last Supabase project the user browsed so the schema viewer
  // and SQL console do not depend on a hardcoded project id.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("nexo:supabaseProjectId") : null;
    if (saved) setSupabaseProjectId(saved);
  }, []);

  useEffect(() => {
    if (open) void loadStatus();
  }, [open, loadStatus]);

  useEffect(() => {
    if (supabaseProjectId) {
      localStorage.setItem("nexo:supabaseProjectId", supabaseProjectId);
    }
  }, [supabaseProjectId]);

  // Handle OAuth callback redirects: ?vercel=connected|error&reason=... and
  // ?supabase=connected|error&reason=... so the user sees a clear outcome
  // instead of an ambiguous state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const vercelState = params.get("vercel");
    const supabaseState = params.get("supabase");
    const githubState = params.get("github");
    const githubUpgrade = params.get("github_upgrade");
    if (githubState === "connected") {
      setConnectionMessage({ kind: "success", text: `GitHub connected successfully${params.get("mode") === "app" ? " with App installation permissions" : ""}.` });
    } else if (githubState === "error") {
      setConnectionMessage({ kind: "error", text: `GitHub connection failed: ${params.get("reason") ?? "unknown error"}` });
    } else if (vercelState === "connected") {
      setConnectionMessage({ kind: "success", text: `Vercel connected${params.get("user") ? ` as ${params.get("user")}` : ""}.` });
    } else if (vercelState === "error") {
      setConnectionMessage({ kind: "error", text: vercelCallbackError(params.get("reason")) });
    } else if (supabaseState === "connected") {
      setConnectionMessage({ kind: "success", text: `Supabase connected${params.get("user") ? ` as ${params.get("user")}` : ""}.` });
    } else if (supabaseState === "error") {
      setConnectionMessage({ kind: "error", text: supabaseCallbackError(params.get("reason")) });
    }
    if (vercelState || supabaseState || githubState || githubUpgrade) {
      params.delete("vercel");
      params.delete("supabase");
      params.delete("github");
      params.delete("github_upgrade");
      params.delete("mode");
      params.delete("setup");
      params.delete("user");
      params.delete("reason");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Refresh Vercel viewer data whenever the connection state changes.
  useEffect(() => {
    if (open && status.vercel.connected) void loadVercelData();
  }, [open, status.vercel.connected, loadVercelData]);

  async function beginOAuth(path: "/api/github/login" | "/api/github/app-install" | "/api/vercel/login" | "/api/supabase/login") {
    const response = await authenticatedFetch(path, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.authorizationUrl !== "string") {
      throw new Error(data.error ?? "Could not start the secure connection flow.");
    }
    window.location.assign(data.authorizationUrl);
  }

  function connectGithub() {
    if (!userId) return;
    void beginOAuth("/api/github/login").catch((error) => console.error("[github] OAuth start failed:", error));
  }

  function upgradeGithubWriteAccess() {
    if (!userId) return;
    setConnectionMessage(null);
    void beginOAuth("/api/github/app-install").catch((error) => {
      setConnectionMessage({ kind: "error", text: error instanceof Error ? error.message : "GitHub App upgrade could not start." });
    });
  }

  // ---- Vercel ----

  function connectVercel() {
    if (!userId) return;
    void beginOAuth("/api/vercel/login").catch((error) => console.error("[vercel] OAuth start failed:", error));
  }

  async function disconnectVercel() {
    if (!userId) return;
    await authenticatedFetch(`/api/vercel/status?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setVercelExpanded(false);
    setVercelProjects([]);
    setVercelDeployments({});
    setVercelDisconnectConfirm(false);
    await loadStatus();
  }

  function confirmVercelPromote(projectName: string, projectId: string, deploymentId: string, deploymentUrl?: string) {
    setApproval({
      kind: "vercel-promote",
      projectId,
      projectName,
      deploymentId,
      deploymentUrl,
      busy: false,
      error: null,
    });
  }

  async function executeApproval() {
    if (!approval || !userId) return;
    setApproval({ ...approval, busy: true, error: null });
    try {
      if (approval.kind === "vercel-promote" && approval.deploymentId) {
        const response = await authenticatedFetch(`/api/vercel/action?userId=${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "promote",
            payload: { projectId: approval.projectId, deploymentId: approval.deploymentId },
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setApproval((current) => (current ? { ...current, busy: false, error: data.error ?? "Action failed." } : current));
          return;
        }
      } else if (approval.kind === "supabase-sql" && approval.sql) {
        const response = await authenticatedFetch(`/api/supabase/action?userId=${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sql",
            payload: { projectId: approval.projectId, sql: approval.sql },
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setApproval((current) => (current ? { ...current, busy: false, error: data.error ?? "SQL execution failed." } : current));
          return;
        }
        setSupabaseSqlResult(JSON.stringify(data.result ?? data, null, 2).slice(0, 4000));
      }
      setApproval(null);
      await loadStatus();
    } catch {
      setApproval((current) => (current ? { ...current, busy: false, error: "Something went wrong. Please try again." } : current));
    }
  }

  // ---- Supabase ----

  function connectSupabase() {
    if (!userId) return;
    setSupabaseConnecting(true);
    // Supabase OAuth flow: sign in with the user's Supabase account. The
    // callback stores encrypted per-user tokens, so the panel flips to
    // connected immediately after returning to the app.
    void beginOAuth("/api/supabase/login").catch((error) => {
      setSupabaseConnecting(false);
      console.error("[supabase] OAuth start failed:", error);
    });
  }

  async function disconnectSupabase() {
    if (!userId) return;
    await authenticatedFetch(`/api/supabase/status?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setSupabaseExpanded(false);
    setSupabaseProjects([]);
    setSupabaseProjectId(null);
    setSupabaseTables([]);
    setSupabaseColumns([]);
    setSupabaseSqlResult(null);
    setSupabaseDisconnectConfirm(false);
    await loadStatus();
  }

  const loadSupabaseSchema = useCallback(async (projectId: string) => {
    if (!userId) return;
    setSupabaseDataLoading(true);
    setSupabaseDataError(null);
    setSupabaseSqlResult(null);
    try {
      const response = await fetch(
        `/api/supabase/schema?userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        setSupabaseDataError(data.error ?? "Could not load schema.");
        return;
      }
      setSupabaseProjectId(projectId);
      setSupabaseTables(data.tables ?? []);
      setSupabaseColumns([]);
      setConnectionMessage(null);
    } catch {
      setSupabaseDataError("Could not load schema.");
    } finally {
      setSupabaseDataLoading(false);
    }
  }, [userId]);

  const loadSupabaseProjects = useCallback(async () => {
    if (!userId) return;
    setSupabaseDataLoading(true);
    setSupabaseDataError(null);
    try {
      const response = await authenticatedFetch(`/api/supabase/projects?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setSupabaseDataError(data.error ?? "Could not load Supabase projects.");
        return;
      }
      const projects = (data.projects ?? []) as SupabaseProject[];
      setSupabaseProjects(projects);
      const savedProjectId = typeof window !== "undefined" ? localStorage.getItem("nexo:supabaseProjectId") : null;
      const selectedProjectId = projects.some((project) => project.id === savedProjectId)
        ? savedProjectId
        : projects[0]?.id ?? null;
      if (selectedProjectId) {
        setSupabaseProjectId(selectedProjectId);
        await loadSupabaseSchema(selectedProjectId);
      } else {
        setSupabaseProjectId(null);
        setSupabaseTables([]);
      }
    } catch {
      setSupabaseDataError("Could not load Supabase projects.");
    } finally {
      setSupabaseDataLoading(false);
    }
  }, [userId, loadSupabaseSchema]);

  // Resolve the selected project from the connected account. A project ID is
  // never guessed or substituted with a platform default.
  useEffect(() => {
    if (!open || !userId) return;
    void loadSupabaseProjects();
  }, [open, userId, loadSupabaseProjects]);

  async function loadTableColumns(projectId: string, tableName: string) {
    if (!userId) return;
    setSupabaseDataLoading(true);
    setSupabaseDataError(null);
    try {
      const response = await fetch(
        `/api/supabase/schema?userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}&table=${encodeURIComponent(tableName)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        setSupabaseDataError(data.error ?? "Could not load columns.");
        return;
      }
      setSupabaseColumns(data.columns ?? []);
    } catch {
      setSupabaseDataError("Could not load columns.");
    } finally {
      setSupabaseDataLoading(false);
    }
  }

  function confirmSupabaseSql(projectId: string, projectName: string, sql: string) {
    setApproval({ kind: "supabase-sql", projectId, projectName, sql, busy: false, error: null });
  }

  async function disconnectGithub() {
    if (!userId) return;
    await authenticatedFetch(`/api/github/status?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    onGithubEnabledChange(false);
    setDisconnectConfirm(false);
    await loadStatus();
  }

  async function savePersonalToken() {
    if (!userId || !personalToken.trim()) return;
    setPatSaving(true);
    setPatError(null);
    try {
      const response = await authenticatedFetch("/api/github/personal-token", {
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
          {connectionMessage && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                connectionMessage.kind === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              <span className="flex-1 leading-relaxed">{connectionMessage.text}</span>
              <button
                type="button"
                onClick={() => setConnectionMessage(null)}
                className="shrink-0 text-ink-faint hover:text-ink"
                aria-label="Dismiss message"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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

            {status.github.connected && !status.github.canWrite && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-amber-300">Read-only connection active</div>
                  <button
                    type="button"
                    onClick={upgradeGithubWriteAccess}
                    className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-void transition hover:bg-amber-400"
                  >
                    Enable Read & Write Access
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-amber-200/80">
                  Upgrade your GitHub connection to install the Nexo App and grant repository write permissions for commits and file edits.
                </p>
              </div>
            )}
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
                  <StatusBadge connected={status.vercel.connected} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Deployments, build output, and project status from your Vercel account. Promotion to production requires approval.
                </p>
                {status.vercel.connected && (
                  <p className="mt-2 truncate font-mono text-[11px] text-ink-faint" title={status.vercel.username ?? undefined}>
                    {status.vercel.username}
                  </p>
                )}
              </div>
            </div>

            {status.vercel.connected ? (
              <>
                <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
                  <button
                    type="button"
                    onClick={() => setVercelExpanded((expanded) => !expanded)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink transition hover:text-cyan"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {vercelExpanded ? "Hide deployments" : "View projects & deployments"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadVercelData()}
                    disabled={vercelDataLoading}
                    className="rounded-md px-2 py-1 text-[11px] text-ink-muted transition hover:bg-panel hover:text-ink disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {vercelExpanded && (
                  <div className="mt-3 space-y-3">
                    {vercelDataLoading && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-ink-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading Vercel…
                      </div>
                    )}
                    {vercelDataError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                        {vercelDataError}
                        <button
                          type="button"
                          onClick={() => void loadVercelData()}
                          className="ml-2 font-semibold text-red-200 hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {!vercelDataLoading && !vercelDataError && vercelProjects.length === 0 && (
                      <p className="rounded-lg border border-edge px-3 py-2 text-[11px] text-ink-faint">
                        No projects found on this Vercel account.
                      </p>
                    )}
                    {vercelProjects.map((project) => {
                      const deployments = vercelDeployments[project.id] ?? [];
                      return (
                        <section key={project.id} className="rounded-xl border border-edge bg-panel/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="truncate text-xs font-semibold text-ink" title={project.productionUrl ?? project.name}>
                              {project.name}
                            </h4>
                            {project.productionUrl ? (
                              <a
                                href={project.productionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-[11px] font-medium text-cyan hover:underline"
                              >
                                Live ↗
                              </a>
                            ) : null}
                          </div>
                          {project.framework && (
                            <p className="mt-0.5 text-[11px] text-ink-faint">{project.framework}</p>
                          )}
                          <div className="mt-2 space-y-1.5">
                            {deployments.slice(0, 6).map((deployment) => {
                              const commitMessage = deployment.meta?.gitCommitMessage;
                              return (
                                <div
                                  key={deployment.id}
                                  className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-edge/70 bg-void/40 px-2.5 py-1.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-medium text-ink-faint" title={commitMessage ?? deployment.url}>
                                      {commitMessage ?? deployment.url}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint/70">
                                      {deployment.readyState}{deployment.isProduction ? " · production" : ""}
                                    </p>
                                  </div>
                                  {!deployment.isProduction && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        confirmVercelPromote(project.name, project.id, deployment.id, deployment.url)
                                      }
                                      className="shrink-0 rounded-md border border-cyan/40 px-2 py-1 text-[10px] font-semibold text-cyan transition hover:bg-cyan/10"
                                    >
                                      Promote
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {deployments.length === 0 && (
                              <p className="text-[11px] text-ink-faint">No deployments yet.</p>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {vercelDisconnectConfirm ? (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-xs text-red-300">Disconnect Vercel? Read access and deployment actions will stop until you connect again.</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setVercelDisconnectConfirm(false)} className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-panel">Cancel</button>
                      <button onClick={() => void disconnectVercel()} className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white">Disconnect</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setVercelDisconnectConfirm(true)} className="mt-3 text-xs font-medium text-red-400 hover:underline">Disconnect Vercel</button>
                )}
              </>
            ) : (
              <button
                onClick={connectVercel}
                disabled={!userId}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan/10 py-2 text-xs font-semibold text-cyan transition hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn className="h-3.5 w-3.5" /> Connect Vercel account
              </button>
            )}
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
                  Browse your project schema and tables. Every SQL statement requires your explicit approval before running.
                </p>
                {status.supabase.connected && (
                  <p className="mt-2 truncate font-mono text-[11px] text-ink-faint" title={status.supabase.username ?? undefined}>
                    {status.supabase.username}
                  </p>
                )}
              </div>
            </div>

            {status.supabase.connected ? (
              <>
                <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
                  <button
                    type="button"
                    onClick={() => setSupabaseExpanded((expanded) => !expanded)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink transition hover:text-emerald-400"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {supabaseExpanded ? "Hide database" : "View schema & SQL console"}
                  </button>
                </div>

                {supabaseExpanded && (
                  <div className="mt-3 space-y-3">
                    <section className="rounded-xl border border-edge bg-panel/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-ink">Verified project</h4>
                        <button
                          type="button"
                          onClick={() => void loadSupabaseProjects()}
                          className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          Refresh projects
                        </button>
                      </div>
                      <select
                        value={supabaseProjectId ?? ""}
                        onChange={(event) => {
                          const projectId = event.target.value;
                          if (projectId) void loadSupabaseSchema(projectId);
                        }}
                        disabled={supabaseProjects.length === 0 || supabaseDataLoading}
                        className="mt-2 w-full rounded-lg border border-edge bg-void/60 px-2.5 py-2 text-xs text-ink outline-none transition focus:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {supabaseProjects.length === 0 ? (
                          <option value="">No verified project available</option>
                        ) : (
                          supabaseProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}{project.region ? ` · ${project.region}` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </section>
                    {supabaseDataLoading && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-ink-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading schema…
                      </div>
                    )}
                    {supabaseDataError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                        {supabaseDataError}
                        <button
                          type="button"
                          onClick={() => supabaseProjectId ? void loadSupabaseSchema(supabaseProjectId) : undefined}
                          className="ml-2 font-semibold text-red-200 hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {supabaseSqlResult && (
                      <pre className="max-h-40 overflow-auto rounded-lg border border-edge bg-void p-2.5 text-[10px] leading-relaxed text-ink-faint">
                        {supabaseSqlResult}
                      </pre>
                    )}
                    {!supabaseDataLoading && !supabaseDataError && supabaseTables.length > 0 && (
                      <section className="rounded-xl border border-edge bg-panel/60 p-3">
                        <h4 className="text-xs font-semibold text-ink">Tables</h4>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {(supabaseTables as Array<{ name: string; table_schema?: string }>).map((table) => (
                            <button
                              key={`${table.table_schema ?? "public"}.${table.name}`}
                              type="button"
                              onClick={() => supabaseProjectId ? void loadTableColumns(supabaseProjectId, table.name) : undefined}
                              className="truncate rounded-lg border border-edge/70 bg-void/40 px-2.5 py-1.5 text-left text-[11px] font-medium text-ink-faint transition hover:border-emerald-500/40 hover:text-ink"
                              title={`${table.table_schema ?? "public"}.${table.name}`}
                            >
                              {table.name}
                            </button>
                          ))}
                        </div>
                        {supabaseColumns.length > 0 && (
                          <div className="mt-2.5 overflow-hidden rounded-lg border border-edge bg-void/40">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-panel/80 text-ink-muted">
                                <tr>
                                  <th className="px-2 py-1.5 font-medium">Column</th>
                                  <th className="px-2 py-1.5 font-medium">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(supabaseColumns as Array<{ name: string; data_type?: string }>).map((column) => (
                                  <tr key={column.name} className="border-t border-edge/70 text-ink-faint">
                                    <td className="px-2 py-1.5">{column.name}</td>
                                    <td className="px-2 py-1.5 font-mono text-[10px]">{column.data_type ?? ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}
                    <section className="rounded-xl border border-edge bg-panel/60 p-3">
                      <h4 className="text-xs font-semibold text-ink">SQL Console</h4>
                      <textarea
                        value={supabaseSql}
                        onChange={(event) => setSupabaseSql(event.target.value)}
                        rows={4}
                        spellCheck={false}
                        placeholder={"SELECT * FROM announcements LIMIT 5;"}
                        className="mt-2 w-full rounded-lg border border-edge bg-void/60 px-2.5 py-2 font-mono text-[11px] text-ink outline-none transition focus:border-emerald-500/40"
                      />
                      <p className="mt-1 text-[10px] text-ink-faint">
                        Only read-only queries are recommended. Destructive schema operations are blocked.
                      </p>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={!supabaseSql.trim() || !supabaseProjectId}
                          onClick={() => {
                            if (!supabaseProjectId) return;
                            const projectName = supabaseProjects.find((project) => project.id === supabaseProjectId)?.name ?? "Selected project";
                            void confirmSupabaseSql(supabaseProjectId, projectName, supabaseSql);
                          }}
                          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Run SQL
                        </button>
                      </div>
                    </section>
                  </div>
                )}

                {supabaseDisconnectConfirm ? (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-xs text-red-300">Disconnect Supabase? Schema access and SQL actions will stop until you connect again.</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setSupabaseDisconnectConfirm(false)} className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-panel">Cancel</button>
                      <button onClick={() => void disconnectSupabase()} className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white">Disconnect</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setSupabaseDisconnectConfirm(true)} className="mt-3 text-xs font-medium text-red-400 hover:underline">Disconnect Supabase</button>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                  Supabase access is automatically active through your own nexo-app database — no token is ever required or stored. Schema inspection is read-only, and every SQL statement needs your approval first.
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-ink-faint">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  All SQL runs only after you approve it on an approval card
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => void connectSupabase()}
                    disabled={!userId || supabaseConnecting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-panel py-2 text-xs font-semibold text-ink transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {supabaseConnecting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…
                      </>
                    ) : (
                      <>
                        <LogIn className="h-3.5 w-3.5" /> Connect Supabase
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </article>

          {/* Approval card overlay */}
          {approval && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-edge bg-panel p-5 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display text-sm font-semibold text-ink">
                      {approval.kind === "vercel-promote" ? "Confirm deployment promotion" : "Confirm SQL execution"}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {approval.kind === "vercel-promote"
                        ? `This will promote a deployment of "${approval.projectName}" to production. Anyone visiting the production URL will see the change immediately.`
                        : `This will execute the following statement against the "${approval.projectName}" project:`}
                    </p>
                    {approval.kind === "supabase-sql" && approval.sql && (
                      <pre className="mt-2 max-h-36 overflow-auto rounded-lg border border-edge bg-void p-2.5 font-mono text-[11px] leading-relaxed text-ink-faint">
                        {approval.sql}
                      </pre>
                    )}
                    {approval.kind === "vercel-promote" && approval.deploymentUrl && (
                      <a
                        href={approval.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-mono text-[11px] text-cyan hover:underline"
                      >
                        {approval.deploymentUrl}
                      </a>
                    )}
                    {approval.error && (
                      <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">{approval.error}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setApproval(null)}
                    disabled={approval.busy}
                    className="rounded-md px-3 py-1.5 text-xs text-ink-muted transition hover:bg-panel disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void executeApproval()}
                    disabled={approval.busy}
                    className="flex items-center gap-1.5 rounded-md bg-cyan px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approval.busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                      </>
                    ) : approval.kind === "vercel-promote" ? (
                      "Approve & promote"
                    ) : (
                      "Approve & run"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking connections…</div>}
        </div>
      </section>
    </div>
  );
}
