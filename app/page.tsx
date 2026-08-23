"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Signal } from "@/components/Signal";
import { NexoSplash } from "@/components/NexoSplash";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { AuthModal } from "@/components/AuthModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SearchModal } from "@/components/SearchModal";
import { NexoCoder } from "@/components/NexoCoder";
import { ApprovalCard } from "@/components/ApprovalCard";
import { LiveStatusBar } from "@/components/LiveStatusBar";
import RateLimitationPanel from "@/components/RateLimitationPanel";
import { SessionResumeCard } from "@/components/SessionResumeCard";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { DevelopmentIntelligencePanel } from "@/components/DevelopmentIntelligencePanel";
import { CoderModelSelector } from "@/components/CoderModelSelector";
import type { CoderModelId } from "@/lib/providers.server";
import { SecretDetectedModal } from "@/components/SecretDetectedModal";
import { parseCraftResponse, parseCraftSegments, applyDiff, type FileAction } from "@/lib/craftParser";
import { canAutomaticallyContinue, consumeResponseContinuationMarker } from "@/lib/responseContinuation";
import { getPublicModel, type NexoModelId } from "@/lib/models";
import type { ChatMessage } from "@/lib/types";
import type { SupabaseTask } from "@/lib/supabaseTaskParser";
import { createSupabaseReadBlock, type SupabaseReadCardData } from "@/lib/supabaseReadParser";
import { parseSupabaseReadToolIntents, stripSupabaseReadToolBlocks, type SupabaseReadToolIntent } from "@/lib/supabaseToolParser";
import { createVercelReadBlock, type VercelReadCardData } from "@/lib/vercelReadParser";
import { parseVercelReadToolIntents, stripVercelReadToolBlocks, type VercelReadToolIntent } from "@/lib/vercelToolParser";
import { getSessionId } from "@/lib/session";
import { supabase, type DbChat } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authFetch";
import { getCurrentUser, onAuthStateChange, signOut, type AuthUser } from "@/lib/auth";
import { MAX_ATTACHMENTS_PER_MESSAGE, prepareAttachmentsForVision } from "@/lib/attachmentProcessing";
import { Settings, Code2, Sparkles, Zap, Plus, Search, Layers, Briefcase, Database, Layout, Menu, BarChart3, Brain, FileText, Loader2 } from "lucide-react";

// All five routed profiles use zero-cost provider paths and must remain selectable.
const UNLOCKED_TIERS = ["Free", "Galex", "Brainex", "Craft"];

// Coder sub-model persistence key — keeps the selected Coder engine (Lite) stable
// across page reloads inside Nexo Coder Agent mode.
const CODER_MODEL_STORAGE_KEY = "nexo.coderModel";

// Drafts are intentionally stored only in this browser and scoped to NEXO's
// existing session ID. Attachments are never persisted because File objects
// may contain private data and cannot be restored reliably after a reload.
const DRAFT_STORAGE_PREFIX = "nexo.chatDrafts:";
const NEW_CHAT_DRAFT_ID = "__new__";
const MAX_DRAFT_LENGTH = 100_000;

type DraftStore = Record<string, string>;

function getDraftStorageKey(sessionId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${sessionId}`;
}

function readDraftStore(sessionId: string): DraftStore {
  if (typeof window === "undefined" || !sessionId) return {};
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(sessionId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === "string" && typeof value === "string" && value.length <= MAX_DRAFT_LENGTH
      )
    );
  } catch {
    // localStorage can be unavailable or contain malformed data; drafts are
    // best-effort and must never block the chat UI.
    return {};
  }
}

function writeDraftStore(sessionId: string, drafts: DraftStore): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(getDraftStorageKey(sessionId));
    } else {
      window.localStorage.setItem(getDraftStorageKey(sessionId), JSON.stringify(drafts));
    }
  } catch {
    // Quota/private-mode failures must not affect sending messages.
  }
}

function removeDraft(sessionId: string, draftId: string): void {
  const drafts = readDraftStore(sessionId);
  if (!(draftId in drafts)) return;
  delete drafts[draftId];
  writeDraftStore(sessionId, drafts);
}

function containsGithubToken(value: string): boolean {
  return /(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})/.test(value);
}

interface PendingApproval {
  messageId: string;
  actions: FileAction[];
  commitMessage: string;
  status: "pending" | "approving" | "approved" | "rejected" | "error";
}

type AttachmentPreparation = {
  names: string[];
  state: "preparing" | "error";
  message?: string;
};

function readVerifiedPaths(response: Response): string[] {
  const raw = response.headers.get("X-Nexo-Verified-Reads");
  if (!raw) return [];
  try {
    const paths = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(paths)
      ? paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeRepositoryReadClaims(content: string, verifiedPaths: string[]): string {
  const verified = new Set(verifiedPaths);
  const withoutUnverifiedMarkers = content.replace(
    /^\[READING FILE\]\s*([^\n]+)$/gim,
    (marker, rawPath: string) => {
      const path = rawPath.trim();
      return verified.has(path)
        ? marker
        : `Repository read not verified for \`${path}\`. No file findings are shown for it.`;
    }
  );

  // A model-generated summary is allowed to describe changes, but its read
  // inventory must be grounded in files the server actually fetched this turn.
  return withoutUnverifiedMarkers.replace(/```task-summary\n([\s\S]*?)```/gi, (_block, details: string) => {
    const normalizedDetails = details
      .split("\n")
      .map((line) => line.trimStart().toLowerCase().startsWith("files read:")
        ? `files read: ${verifiedPaths.join(", ")}`
        : line
      )
      .join("\n");
    return `\`\`\`task-summary\n${normalizedDetails}\n\`\`\``;
  });
}

function liveReadCard(card: Omit<SupabaseReadCardData, "id">) {
  return createSupabaseReadBlock(card);
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activePersona, setActivePersona] = useState("general");
  const [selectedModel, setSelectedModel] = useState<NexoModelId>("nexio-1.1");
  const [chats, setChats] = useState<DbChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachmentPreparation, setAttachmentPreparation] = useState<AttachmentPreparation | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamElapsedSeconds, setStreamElapsedSeconds] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCoderMode, setIsCoderMode] = useState(false);
  const [coderModel, setCoderModel] = useState<CoderModelId>(() => {
    if (typeof window === "undefined") return "craft-v3-lite";
    const stored = window.localStorage.getItem(CODER_MODEL_STORAGE_KEY);
    if (stored === "craft-v3-lite" || stored === "craft-v3" || stored === "craft-v4") {
      return stored;
    }
    return "craft-v3-lite";
  });
  const [lastExtractedCode, setLastExtractedCode] = useState<{code: string, lang: string, file: string} | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [commitErrorDetail, setCommitErrorDetail] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [usagePanelOpen, setUsagePanelOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [developmentIntelligenceOpen, setDevelopmentIntelligenceOpen] = useState(false);
  const [githubIntegrationEnabled, setGithubIntegrationEnabled] = useState(true);
  const [pendingGithubSecret, setPendingGithubSecret] = useState<string | null>(null);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretSaving, setSecretSaving] = useState(false);
  const [secretSaveError, setSecretSaveError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{ commitUrl?: string; prUrl?: string } | null>(null);

  // Typing speed tracking starts at the first provider text chunk, not at
  // request start. A short rolling window makes the badge responsive while
  // avoiding the long provider queue/wait time in the speed calculation.
  const [typingSpeed, setTypingSpeed] = useState(0);
  const firstTokenAtRef = useRef<number | null>(null);
  const speedSamplesRef = useRef<Array<{ at: number; chars: number }>>([]);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);
  const streamingLockRef = useRef(false);
  const attachmentPreparationLockRef = useRef(false);
  const draftHydrationKeyRef = useRef("");
  const skipNextDraftSaveRef = useRef(false);
  const draftScope = user?.id ? `user:${user.id}` : sessionId ? `session:${sessionId}` : "";
  const draftId = activeChatId ?? NEW_CHAT_DRAFT_ID;
  const draftHydrationKey = draftScope ? `${draftScope}:${draftId}` : "";

  // Restore only the draft belonging to the current account/session and chat.
  // The guard prevents the first autosave pass after a chat switch from saving
  // the previous chat's input into the newly selected chat.
  useEffect(() => {
    if (!draftScope || !draftHydrationKey) return;
    skipNextDraftSaveRef.current = true;
    const savedDraft = readDraftStore(draftScope)[draftId] ?? "";
    setInput(savedDraft);
    draftHydrationKeyRef.current = draftHydrationKey;
  }, [draftScope, draftId, draftHydrationKey]);

  // localStorage is deliberately used as a best-effort offline cache. It is
  // synchronous and small here, so every edit is saved without a debounce
  // window that could lose the last keystrokes during a sudden reload.
  useEffect(() => {
    if (!draftScope || !draftHydrationKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }
    if (draftHydrationKeyRef.current !== draftHydrationKey) return;

    if (containsGithubToken(input) || input.length > MAX_DRAFT_LENGTH) {
      removeDraft(draftScope, draftId);
      return;
    }

    const drafts = readDraftStore(draftScope);
    if (input.length === 0) {
      delete drafts[draftId];
    } else {
      drafts[draftId] = input;
    }
    writeDraftStore(draftScope, drafts);
  }, [input, draftScope, draftId, draftHydrationKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isStreaming || streamStartedAtRef.current === null) {
      setStreamElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => {
      const startedAt = streamStartedAtRef.current;
      setStreamElapsedSeconds(startedAt ? Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) : 0);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  function recordStreamText(text: string) {
    if (!text) return;
    const now = Date.now();
    if (firstTokenAtRef.current === null) firstTokenAtRef.current = now;

    speedSamplesRef.current.push({ at: now, chars: text.length });
    const windowStart = now - 2_000;
    speedSamplesRef.current = speedSamplesRef.current.filter((sample) => sample.at >= windowStart);
    const charsInWindow = speedSamplesRef.current.reduce((total, sample) => total + sample.chars, 0);
    const firstSampleAt = speedSamplesRef.current[0]?.at ?? now;
    const elapsed = Math.max((now - firstSampleAt) / 1_000, 0.25);
    setTypingSpeed(charsInWindow / elapsed);
  }

  function resetTypingSpeed() {
    firstTokenAtRef.current = null;
    speedSamplesRef.current = [];
    setTypingSpeed(0);
  }

  function startStreamingTurn(assistantId: string) {
    const controller = new AbortController();
    resetTypingSpeed();
    streamAbortControllerRef.current = controller;
    activeAssistantIdRef.current = assistantId;
    streamStartedAtRef.current = Date.now();
    streamingLockRef.current = true;
    setIsStreaming(true);
    return controller;
  }

  function finishStreamingTurn(assistantId: string) {
    if (activeAssistantIdRef.current !== assistantId) return;
    streamAbortControllerRef.current = null;
    activeAssistantIdRef.current = null;
    streamStartedAtRef.current = null;
    streamingLockRef.current = false;
    resetTypingSpeed();
    setIsStreaming(false);
  }

  function handleStopGenerating() {
    streamAbortControllerRef.current?.abort();
  }

  async function handleSupabaseApprove(task: SupabaseTask): Promise<{ ok: boolean; message?: string }> {
    const currentUserId = user?.id;
    const projectId = task.projectId || (typeof window !== "undefined" ? window.localStorage.getItem("nexo:supabaseProjectId") : null);
    if (!currentUserId) return { ok: false, message: "Sign in before running a Supabase task." };
    if (!projectId || ["unknown", "null", "n/a"].includes(projectId.toLowerCase())) {
      return { ok: false, message: "Connect Supabase and select a verified project first." };
    }

    try {
      const response = await authenticatedFetch(`/api/supabase/action?userId=${encodeURIComponent(currentUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sql", payload: { projectId, sql: task.sql } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, message: data.error ?? "Supabase task failed." };
      return { ok: true, message: `Verified Supabase result: ${JSON.stringify(data.result ?? data).slice(0, 1800)}` };
    } catch {
      return { ok: false, message: "Could not reach Supabase. Check the connection and try again." };
    }
  }

  function supabaseToolCard(intent: SupabaseReadToolIntent, state: SupabaseReadCardData["state"], message: string, data?: Record<string, unknown>) {
    const kind = intent.tool === "list_projects"
      ? "projects"
      : intent.tool === "describe_table"
        ? "columns"
        : "schema";
    const titleByTool: Record<SupabaseReadToolIntent["tool"], string> = {
      list_projects: "Reading connected Supabase projects",
      list_tables: "Reading Supabase tables",
      describe_table: `Reading ${intent.table ?? "table"} details`,
      read_rows: `Reading ${intent.table ?? "table"} rows`,
    };
    const successTitleByTool: Record<SupabaseReadToolIntent["tool"], string> = {
      list_projects: "Verified Supabase projects",
      list_tables: "Verified Supabase table result",
      describe_table: "Verified table detail result",
      read_rows: "Verified Supabase row result",
    };
    const tables = Array.isArray(data?.tables)
      ? (data.tables as Array<{ name?: string }>).map((table) => table.name).filter((name): name is string => typeof name === "string")
      : undefined;
    const columns = Array.isArray(data?.columns)
      ? data.columns as Array<{ name: string; type: string | null; nullable: boolean }>
      : undefined;
    const projects = Array.isArray(data?.projects)
      ? (data.projects as Array<{ id?: string; name?: string; region?: string | null }>)
        .filter((project): project is { id: string; name: string; region?: string | null } => typeof project.id === "string" && typeof project.name === "string")
        .slice(0, 25)
        .map((project) => ({ id: project.id, name: project.name, region: project.region ?? null }))
      : undefined;
    const policyCount = typeof data?.policyCount === "number" ? data.policyCount : undefined;

    return liveReadCard({
      state,
      kind,
      projectId: intent.projectId,
      title: state === "success" ? successTitleByTool[intent.tool] : titleByTool[intent.tool],
      message,
      tableNames: tables,
      columns,
      projects,
      policyCount,
    });
  }

  async function executeSupabaseReadTool(intent: SupabaseReadToolIntent): Promise<{ card: string; promptContext: string; ok: boolean }> {
    const currentUserId = user?.id;
    if (!currentUserId) {
      return {
        card: supabaseToolCard(intent, "needs_project", "Sign in and connect Supabase before Nexo can run a verified read."),
        promptContext: "The Supabase tool did not run because there is no signed-in user connection.",
        ok: false,
      };
    }

    try {
      const response = await authenticatedFetch(`/api/supabase/tool?userId=${encodeURIComponent(currentUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const needsConnection = response.status === 403 || response.status === 404;
        return {
          card: supabaseToolCard(intent, needsConnection ? "needs_project" : "error", data.error ?? "The live Supabase read did not return a result."),
          promptContext: `Supabase tool ${intent.tool} failed: ${data.error ?? "unknown error"}. Do not claim the request is waiting or complete.`,
          ok: false,
        };
      }

      const summary = intent.tool === "list_projects"
        ? `${Array.isArray(data.projects) ? data.projects.length : 0} connected project(s) returned.`
        : intent.tool === "list_tables"
          ? `${Array.isArray(data.tables) ? data.tables.length : 0} public table(s) returned.`
          : intent.tool === "describe_table"
            ? `${Array.isArray(data.columns) ? data.columns.length : 0} column(s) returned for ${intent.table}.`
            : `${Array.isArray(data.rows) ? data.rows.length : 0} redacted row(s) returned from ${intent.table}.`;
      const safeResult = JSON.stringify(data).slice(0, 8000);
      return {
        card: supabaseToolCard(intent, "success", summary, data),
        promptContext: `VERIFIED SUPABASE TOOL RESULT for ${intent.tool}: ${safeResult}. This tool has completed. Explain only this result; do not claim that a call is still running or waiting.`,
        ok: true,
      };
    } catch {
      return {
        card: supabaseToolCard(intent, "error", "Nexo could not reach the Supabase tool endpoint. No result is being claimed."),
        promptContext: `Supabase tool ${intent.tool} could not reach the server. Do not claim that the call is waiting or complete.`,
        ok: false,
      };
    }
  }

  function safeVercelToolData(data: Record<string, unknown>) {
    const projects = Array.isArray(data.projects)
      ? data.projects.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const project = value as Record<string, unknown>;
        if (typeof project.id !== "string" || typeof project.name !== "string") return [];
        const scope = project.scope && typeof project.scope === "object" && !Array.isArray(project.scope)
          ? project.scope as Record<string, unknown>
          : null;
        return [{
          id: project.id,
          name: project.name,
          framework: typeof project.framework === "string" ? project.framework : null,
          productionUrl: typeof project.productionUrl === "string" ? project.productionUrl : null,
          scopeLabel: typeof scope?.label === "string" ? scope.label : null,
        }];
      })
      : undefined;
    const deployments = Array.isArray(data.deployments)
      ? data.deployments.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const deployment = value as Record<string, unknown>;
        if (typeof deployment.id !== "string") return [];
        return [{
          id: deployment.id,
          url: typeof deployment.url === "string" ? deployment.url : null,
          readyState: typeof deployment.readyState === "string" ? deployment.readyState : null,
          createdAt: typeof deployment.createdAt === "number" ? deployment.createdAt : null,
          isProduction: deployment.isProduction === true,
        }];
      })
      : undefined;
    return { projects, deployments };
  }

  function vercelToolCard(intent: VercelReadToolIntent, state: VercelReadCardData["state"], message: string, data?: Record<string, unknown>) {
    const safeData = data
      ? safeVercelToolData(data)
      : { projects: undefined, deployments: undefined };
    const kind = intent.tool === "list_projects" ? "projects" : "deployments";
    const loadingTitle = intent.tool === "list_projects" ? "Reading connected Vercel projects" : "Reading recent Vercel deployments";
    const successTitle = intent.tool === "list_projects" ? "Verified Vercel project result" : "Verified Vercel deployment result";
    return createVercelReadBlock({
      state,
      kind,
      title: state === "success" ? successTitle : loadingTitle,
      message,
      projectId: intent.tool === "list_deployments" ? intent.projectId : undefined,
      projects: safeData.projects,
      deployments: safeData.deployments,
    });
  }

  async function executeVercelReadTool(intent: VercelReadToolIntent): Promise<{ card: string; promptContext: string; ok: boolean }> {
    const currentUserId = user?.id;
    if (!currentUserId) {
      return {
        card: vercelToolCard(intent, "needs_connection", "Sign in and connect Vercel before Nexo can run a verified read."),
        promptContext: "The Vercel tool did not run because there is no signed-in user connection.",
        ok: false,
      };
    }

    try {
      const response = await authenticatedFetch(`/api/vercel/tool?userId=${encodeURIComponent(currentUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const needsConnection = response.status === 403 || response.status === 404;
        return {
          card: vercelToolCard(intent, needsConnection ? "needs_connection" : "error", data.error ?? "The live Vercel read did not return a result."),
          promptContext: `Vercel tool ${intent.tool} failed: ${data.error ?? "unknown error"}. Do not claim the request is waiting or complete.`,
          ok: false,
        };
      }

      const safeData = safeVercelToolData(data);
      const summary = intent.tool === "list_projects"
        ? `${safeData.projects?.length ?? 0} project(s) returned.`
        : `${safeData.deployments?.length ?? 0} deployment(s) returned for the selected project.`;
      return {
        card: vercelToolCard(intent, "success", summary, safeData),
        promptContext: `VERIFIED VERCEL TOOL RESULT for ${intent.tool}: ${JSON.stringify(safeData).slice(0, 8000)}. This tool has completed. Explain only this result; do not claim that a call is still running or waiting.`,
        ok: true,
      };
    } catch {
      return {
        card: vercelToolCard(intent, "error", "Nexo could not reach the Vercel tool endpoint. No result is being claimed."),
        promptContext: `Vercel tool ${intent.tool} could not reach the server. Do not claim that the call is waiting or complete.`,
        ok: false,
      };
    }
  }

  // Task activity belongs to the current assistant turn only. This prevents a
  // completed read marker from becoming "Reading" again when a later turn starts.
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const activityActions: FileAction[] = (() => {
    if (!lastAssistantMsg?.content) return [];
    const segments = parseCraftSegments(lastAssistantMsg.content);
    return segments
      .filter((s): s is Extract<typeof s, { kind: "action" }> => s.kind === "action")
      .map((s) => s.action);
  })();

  // A live Google Search (Gemini built-in grounding) shows as the most recent
  // activity in the status bar — the search marker is server-injected whenever
  // the Gemini stream emits a googleSearchCall part.
  const activitySearching: ReturnType<typeof parseCraftSegments>[number] | null = (() => {
    if (!lastAssistantMsg?.content) return null;
    const segments = parseCraftSegments(lastAssistantMsg.content);
    const searches = segments.filter((s) => s.kind === "searching") as Extract<typeof segments[number], { kind: "searching" }>[];
    return searches.length > 0 ? searches[searches.length - 1] : null;
  })();

  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadSavedDefaultModel(settingsUserId: string) {
    const { data, error } = await supabase
      .from("user_settings")
      .select("default_model")
      .eq("user_id", settingsUserId)
      .maybeSingle();

    if (error) {
      console.error("[settings] Could not load default model:", error.message);
      return;
    }

    const savedModel = data?.default_model;
    if (typeof savedModel === "string" && getPublicModel(savedModel as NexoModelId)) {
      setSelectedModel(savedModel as NexoModelId);
    }
  }

  useEffect(() => {
    const savedGithubToggle = window.localStorage.getItem("nexo_github_integration_enabled");
    if (savedGithubToggle !== null) setGithubIntegrationEnabled(savedGithubToggle === "true");

    const sid = getSessionId();
    setSessionId(sid);
    if (sid) loadChats(sid);

    getCurrentUser().then((u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        loadSelectedRepo(u.id);
        void loadSavedDefaultModel(u.id);
      }
    });
    const subscription = onAuthStateChange((u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        loadSelectedRepo(u.id);
        void loadSavedDefaultModel(u.id);
      } else setSelectedRepo(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  // Extract code from messages for the side panel and parse repository actions
  // from every model so live task and approval cards work consistently.
  // live status cards and, if it proposes real changes, an approval card.
  useEffect(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg) {
      const codeBlockRegex = /```(\w+)?(?:\:([^\n`]+))?\n([\s\S]*?)```/g;
      const diffBlockRegex = /```diff\:([^\n`]+)\n([\s\S]*?)```/g;
      const diffMatches = [...lastAssistantMsg.content.matchAll(diffBlockRegex)];
      const codeMatches = [...lastAssistantMsg.content.matchAll(codeBlockRegex)];
      if (diffMatches.length > 0) {
        // Diff-based edit proposals take precedence in the preview panel so
        // the side panel shows exactly what is being changed, not a stale
        // full-file snapshot.
        const lastDiff = diffMatches[diffMatches.length - 1];
        setLastExtractedCode({
          lang: "diff",
          file: lastDiff[1] || "changes",
          code: lastDiff[2].trim()
        });
      } else if (codeMatches.length > 0) {
        const lastMatch = codeMatches[codeMatches.length - 1];
        setLastExtractedCode({
          lang: lastMatch[1] || "typescript",
          file: lastMatch[2] || "component.tsx",
          code: lastMatch[3].trim()
        });
      }

      if (lastAssistantMsg.content && !isStreaming) {
        const parsed = parseCraftResponse(lastAssistantMsg.content);
        if (parsed.hasProposal) {
          setPendingApproval((prev) => {
            // Don't recreate the card if we already have one for this message
            // (e.g. avoid resetting an in-progress approve/reject state).
            if (prev?.messageId === lastAssistantMsg.id) return prev;
            return {
              messageId: lastAssistantMsg.id,
              actions: parsed.fileActions,
              commitMessage: parsed.commitMessage || "",
              status: "pending",
            };
          });
        }
      }
    }
  }, [messages, isStreaming]);

  async function loadChats(sid: string) {
    try {
      const res = await fetch(`/api/chats?sessionId=${sid}`);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch {
      // history is a nice-to-have, not critical path
    }
  }

  async function loadSelectedRepo(userId: string) {
    try {
      const res = await authenticatedFetch(`/api/github/repos?userId=${userId}`);
      const data = await res.json();
      setSelectedRepo(data.selectedRepo ?? null);
    } catch {
      setSelectedRepo(null);
    }
  }

  async function loadMessages(chatId: string) {
    setMessagesLoading(true);
    setMessages([]);
    setPendingApproval(null);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            modelId: m.model_id,
            persisted: true,
          }))
        );
      }
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function ensureChat(): Promise<string | null> {
    if (activeChatId) return activeChatId;
    if (!sessionId) return null;

    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          title: "New chat",
          modelId: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.chat) {
        setActiveChatId(data.chat.id);
        setChats((prev) => [data.chat, ...prev]);
        return data.chat.id;
      }
    } catch {
      // fall through
    }
    return null;
  }

  async function saveMessage(chatId: string, role: "user" | "assistant", content: string, modelId?: string) {
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, modelId }),
      });
    } catch {
      // non-critical
    }
  }

  function handleAttach(files: File[]) {
    setAttachedFiles((current) => [...current, ...files].slice(0, MAX_ATTACHMENTS_PER_MESSAGE));
  }

  function handleRemoveAttachment(index: number) {
    setAttachedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function handleAuthSuccess() {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) loadSelectedRepo(currentUser.id);
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleClearHistory() {
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    setPendingApproval(null);
    try {
      for (const chat of chats) {
        await fetch(`/api/chats?id=${chat.id}`, { method: "DELETE" });
      }
    } catch {
      // best-effort cleanup
    }
    setSettingsOpen(false);
  }

  function handleSecretDetected(secret: string) {
    setPendingGithubSecret(secret);
    setSecretSaveError(null);
    setSecretModalOpen(true);
  }

  function cancelDetectedSecret() {
    setPendingGithubSecret(null);
    setSecretSaveError(null);
    setSecretModalOpen(false);
  }

  async function confirmDetectedSecret() {
    if (!user || !pendingGithubSecret) return;
    setSecretSaving(true);
    setSecretSaveError(null);
    try {
      const response = await authenticatedFetch("/api/github/personal-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, token: pendingGithubSecret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSecretSaveError(data.error ?? "Could not validate this GitHub secret.");
        return;
      }
      setGithubIntegrationEnabled(true);
      window.localStorage.setItem("nexo_github_integration_enabled", "true");
      setPendingGithubSecret(null);
      setSecretModalOpen(false);
      await loadSelectedRepo(user.id);
    } catch {
      setSecretSaveError("Could not save this GitHub secret. Please try again.");
    } finally {
      setSecretSaving(false);
    }
  }

  async function handleApproveChanges(mode: "direct" | "pr", branchName?: string) {
    if (!pendingApproval || !user) return;
    if (!githubIntegrationEnabled) {
      setCommitErrorDetail("GitHub integration is turned off. Turn it on in Integrations before approving repository changes.");
      setPendingApproval({ ...pendingApproval, status: "error" });
      return;
    }

    setPendingApproval({ ...pendingApproval, status: "approving" });

    // Resolve each approved action to its final file content:
    // - diffs: apply against the last known content of the file (fetched live
    //   from the repo, so we always patch the current version, not the stale
    //   prompt snapshot). Fallback → commit the diff's own content only.
    // - new files: use the full content block.
    const filesToCommit: { filePath: string; content: string; type: "editing" | "creating" | "deleting" }[] = [];
    const mutateActions = pendingApproval.actions.filter((a) => a.type !== "reading");

    for (const action of mutateActions) {
      // A bare marker (no diff, no content) is a real proposal: a deletion
      // removes the file from GitHub, and a bare create marker commits an
      // empty placeholder so the user can see the file appeared.
      if (!action.diffHunk && !action.newContent) {
        if (action.type === "deleting") {
          filesToCommit.push({ filePath: action.filePath, content: "", type: "deleting" });
        } else if (action.type === "creating") {
          filesToCommit.push({ filePath: action.filePath, content: "", type: "creating" });
        }
        continue;
      }
      if (action.diffHunk) {
        let original = "";
        if (user) {
          try {
            const res = await authenticatedFetch(
              `/api/github/file?userId=${user.id}&path=${encodeURIComponent(action.filePath)}`,
              { headers: { "Cache-Control": "no-store" } }
            );
            if (res.ok) {
              const json = await res.json();
              original = json.content ?? "";
            }
          } catch {
            // fall back to empty original below
          }
        }
        let content = original;
        try {
          content = original
            ? applyDiff(original, action.diffHunk)
            : action.diffHunk.add.join("\n");
        } catch {
          // Anchor line not found in the live file — the model's diff is
          // stale. Safety first: do not commit a broken file; mark error.
          setPendingApproval({ ...pendingApproval, status: "error" });
          return;
        }
        if (!content.trim()) {
          // Diff applied to an empty/unchanged result → treat as a new
          // (empty) file creation rather than silently dropping it.
          filesToCommit.push({ filePath: action.filePath, content: "", type: "creating" });
        } else {
          filesToCommit.push({ filePath: action.filePath, content, type: original ? "editing" : "creating" });
        }
      } else {
        if (action.type !== "deleting" && !action.newContent?.trim()) continue;
        filesToCommit.push({
          filePath: action.filePath,
          content: action.newContent ?? "",
          type: action.type as "editing" | "creating" | "deleting",
        });
      }
    }

    // Nothing left after dropping empty-content actions — abort before calling
    // the commit API so we never push a blank file to the repository.
    if (filesToCommit.length === 0) {
      setPendingApproval({ ...pendingApproval, status: "rejected" });
      return;
    }

    try {
      const res = await authenticatedFetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          files: filesToCommit,
          commitMessage: pendingApproval.commitMessage || "Update via NEXO Craft V3",
          mode,
          branchName,
          approvalGranted: true,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        // Surface the real failure reason instead of a generic "commit failed"
        // so the user knows whether to retry, fix the repo, or reject.
        const failed = Array.isArray(data.results)
          ? data.results.filter((r: { success: boolean }) => !r.success)
          : [];
        setCommitErrorDetail(
          failed.length > 0
            ? (failed as { filePath: string; error?: string }[]).map((r) => `${r.filePath}: ${r.error ?? "unknown error"}`).join("; ")
            : data.error ?? data.message ?? "Commit failed"
        );
        console.error("[approve] Commit failed:", data.error ?? data.message);
      } else {
        setCommitErrorDetail(null);
      }
      setPendingApproval({
        ...pendingApproval,
        status: data.success ? "approved" : "error",
      });
    } catch {
      setCommitErrorDetail("Network error — the commit request could not be sent");
      setPendingApproval({ ...pendingApproval, status: "error" });
    }
  }

  function handleRejectChanges() {
    if (!pendingApproval) return;
    setPendingApproval({ ...pendingApproval, status: "rejected" });
    setCommitErrorDetail(null);
    setCommitResult(null);
  }

  function handleRetryChanges() {
    if (!pendingApproval) return;
    setPendingApproval({ ...pendingApproval, status: "pending" });
    setCommitErrorDetail(null);
    setCommitResult(null);
  }

  async function streamResponse(
    chatId: string | null,
    conversationSoFar: ChatMessage[],
    assistantId: string,
    override?: { modelId: NexoModelId; isCoder: boolean },
    uploadedImages?: { base64Image: string }[],
    providedController?: AbortController,
    initialContent = "",
    liveToolDepth = 0,
    responseContinuationDepth = 0
  ) {
    const effectiveModel = override
      ? override.modelId
      : isCoderMode
      ? "craft-v3"
      : selectedModel;
    const effectiveCoder = Boolean(
      (override ? override.isCoder : isCoderMode) || effectiveModel === "craft-v3"
    );
    const controller = providedController ?? streamAbortControllerRef.current ?? startStreamingTurn(assistantId);
    let accumulated = initialContent;
    try {
      // Forward the signed-in user's Supabase access token only to the same
      // first-party chat route. This allows the server-side settings read to
      // respect user_id-based RLS policies without exposing any service key.
      const { data: { session: authSession } } = await supabase.auth.getSession();

      const res = await authenticatedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          modelId: effectiveModel,
          sessionId,
          // The user's real auth id, used server-side to look up their GitHub
          // connection (selected repo + access token) for Craft V3 requests.
          // Without this, /api/chat has no way to know which repo is active.
          userId: user?.id,
          userAccessToken: authSession?.access_token,
          // The signed-in display name comes from the account profile and is
          // included only in this first-party request for prompt context.
          userName: user?.fullName,
          githubEnabled: githubIntegrationEnabled,
          isCoderMode: effectiveCoder,
          // Coder sub-model selection: only honored server-side while in
          // Nexo Coder mode; the Lite engine's deeper prompt is applied there.
          coderModel: effectiveCoder ? coderModel : undefined,
          // Read-only Supabase tools need the user-selected project. The backend
          // still verifies it against this user's connected account before use.
          supabaseProjectId: typeof window !== "undefined" ? window.localStorage.getItem("nexo:supabaseProjectId") : null,
          uploadedImages,
          isAutomaticContinuation: responseContinuationDepth > 0,
          messages: conversationSoFar.map((m) => ({ role: m.role, content: m.content })),
          persona: activePersona,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);

        if (res.status === 429) {
          // Keep the active Craft task in place when its token allowance ends.
          // It must never be silently retried with another model because that
          // would break the user's coding workflow and lose model continuity.
          if (effectiveCoder && errData?.error === "coder_token_limit_reached") {
            const resumeAt = errData?.pausedUntil
              ? new Date(errData.pausedUntil).toLocaleString()
              : "exactly 24 hours after the limit was reached";
            const pausedMessage = `## NEXO Coder is paused\n\nඔබගේ Craft V3 **3,000-token** budget එක අවසන් වී ඇත. ඔබගේ වත්මන් task එක සහ chat context එක ආරක්ෂිතව save කර ඇත.\n\n**නැවත ආරම්භ කළ හැකි වේලාව:** ${resumeAt}\n\nඑම වේලාවෙන් පසු මෙම chat එකේම message එකක් යවා task එක නතර වූ තැනින් ඉදිරියට කරගෙන යා හැක.`;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: pausedMessage } : m
              )
            );
            if (chatId) {
              await saveMessage(chatId, "assistant", pausedMessage, "craft-v3");
            }
            setIsStreaming(false);
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      errData?.message ??
                      "You've reached today's message limit. Come back tomorrow, or upgrade for unlimited access.",
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        // Upstream provider error (502, 500, etc.) — show friendly message
        const friendlyMsg = errData?.message ?? "Something went wrong reaching NEXO. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: friendlyMsg, generationState: "failed" } : m
          )
        );
        setIsStreaming(false);
        return;
      }

      if (!res.body) throw new Error("No response stream");

      const verifiedReadPaths = readVerifiedPaths(res);
      if (verifiedReadPaths.length > 0) {
        accumulated = `${verifiedReadPaths.map((path) => `[READING FILE] ${path}`).join("\n")}\n\n`;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let needsAutomaticContinuation = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const streamedText = decoder.decode(value, { stream: true });
        const marker = consumeResponseContinuationMarker(streamedText);
        needsAutomaticContinuation ||= marker.shouldContinue;
        accumulated += marker.content;
        recordStreamText(marker.content);
        const displayContent = normalizeRepositoryReadClaims(accumulated, verifiedReadPaths);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: displayContent } : m))
        );
      }

      const completedMarker = consumeResponseContinuationMarker(accumulated);
      needsAutomaticContinuation ||= completedMarker.shouldContinue;
      accumulated = completedMarker.content;
      accumulated = normalizeRepositoryReadClaims(accumulated, verifiedReadPaths);

      if (
        needsAutomaticContinuation &&
        canAutomaticallyContinue(responseContinuationDepth) &&
        !controller.signal.aborted
      ) {
        const continuationContext: ChatMessage[] = [
          ...conversationSoFar,
          { id: `partial-${assistantId}-${responseContinuationDepth}`, role: "assistant", content: accumulated },
          {
            id: `continue-${assistantId}-${responseContinuationDepth}`,
            role: "user",
            content: "Continue exactly from where your previous response stopped. Return only the remaining response, without repeating any earlier text, status marker, or task summary.",
          },
        ];
        return streamResponse(
          chatId,
          continuationContext,
          assistantId,
          override,
          uploadedImages,
          controller,
          accumulated,
          liveToolDepth,
          responseContinuationDepth + 1,
        );
      }

      // A provider can occasionally end immediately after emitting a verified
      // file-status marker. Never fabricate a partial report or unrelated file
      // findings: preserve the verified marker and let the retry control re-run
      // the exact user request if no actual analysis was returned.
      const parsedTask = parseCraftResponse(accumulated);
      const readActions = parsedTask.fileActions.filter((action) => action.type === "reading");
      if (verifiedReadPaths.length > 0 && readActions.length > 0 && !parsedTask.summary) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated, generationState: "failed" } : m))
        );
      }

      const supabaseToolIntent = liveToolDepth === 0
        ? parseSupabaseReadToolIntents(accumulated)[0]
        : undefined;
      if (supabaseToolIntent) {
        const toolRequestText = stripSupabaseReadToolBlocks(accumulated).trim();
        const loadingCard = supabaseToolCard(
          supabaseToolIntent,
          "loading",
          "Nexo is validating the connection and running this read-only Supabase tool now."
        );
        setMessages((prev) => prev.map((message) => (
          message.id === assistantId ? { ...message, content: loadingCard } : message
        )));

        const verifiedTool = await executeSupabaseReadTool(supabaseToolIntent);
        const continuedConversation: ChatMessage[] = [
          ...conversationSoFar,
          { id: `supabase-tool-request-${crypto.randomUUID()}`, role: "assistant", content: toolRequestText || "Nexo requested a verified Supabase read tool." },
          { id: `supabase-tool-result-${crypto.randomUUID()}`, role: "user", content: `[Verified Supabase read executed by Nexo]\n${verifiedTool.promptContext}` },
        ];
        return streamResponse(
          chatId,
          continuedConversation,
          assistantId,
          override,
          uploadedImages,
          controller,
          verifiedTool.card,
          liveToolDepth + 1
        );
      }

      const vercelToolIntent = liveToolDepth === 0
        ? parseVercelReadToolIntents(accumulated)[0]
        : undefined;
      if (vercelToolIntent) {
        const toolRequestText = stripVercelReadToolBlocks(accumulated).trim();
        const loadingCard = vercelToolCard(
          vercelToolIntent,
          "loading",
          "Nexo is validating the connection and running this read-only Vercel tool now."
        );
        setMessages((prev) => prev.map((message) => (
          message.id === assistantId ? { ...message, content: loadingCard } : message
        )));

        const verifiedTool = await executeVercelReadTool(vercelToolIntent);
        const continuedConversation: ChatMessage[] = [
          ...conversationSoFar,
          { id: `vercel-tool-request-${crypto.randomUUID()}`, role: "assistant", content: toolRequestText || "Nexo requested a verified Vercel read tool." },
          { id: `vercel-tool-result-${crypto.randomUUID()}`, role: "user", content: `[Verified Vercel read executed by Nexo]\n${verifiedTool.promptContext}` },
        ];
        return streamResponse(
          chatId,
          continuedConversation,
          assistantId,
          override,
          uploadedImages,
          controller,
          verifiedTool.card,
          liveToolDepth + 1
        );
      }

      if (chatId && accumulated) {
        saveMessage(chatId, "assistant", accumulated, effectiveModel);
      }
    } catch {
      if (controller.signal.aborted) {
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, generationState: "stopped" } : m
        )));
        if (chatId && accumulated) saveMessage(chatId, "assistant", accumulated, effectiveModel);
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulated || "Something went wrong reaching NEXO. Please try again.", generationState: "failed" }
            : m
        )
      );
    } finally {
      if (responseContinuationDepth === 0) finishStreamingTurn(assistantId);
    }
  }

  async function handleResend(messageId: string, newContent: string) {
    // Edit the user message to newContent, drop every message after it,
    // and re-stream the assistant reply — mirroring handleRegenerate but
    // starting from an arbitrary (editable) user message.
    if (isStreaming || streamingLockRef.current) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1 || messages[idx].role !== "user" || !newContent.trim()) return;

    const chatId = await ensureChat();
    const conversationSoFar: ChatMessage[] = [
      ...messages.slice(0, idx),
      { ...messages[idx], content: newContent.trim() },
    ];

    // Remove the superseded messages from the DB (client state is dropped
    // below), so persisted history matches what we re-render.
    if (chatId) {
      const toDelete = messages.slice(idx + 1);
      await Promise.all(
        toDelete.map((m) =>
          fetch(`/api/chats/${chatId}/messages?id=${m.id}`, {
            method: "DELETE",
          }).catch(() => {})
        )
      );
      // If the edited message was a freshly created one (never saved to the
      // DB), persist it now so history keeps the edited content.
      if (!conversationSoFar[idx].persisted) {
        saveMessage(chatId, "user", conversationSoFar[idx].content);
      }
    }

    const assistantId = crypto.randomUUID();

    setPendingApproval(null);
    setMessages([
      ...conversationSoFar,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        modelId: isCoderMode ? "craft-v3" : selectedModel,
      },
    ]);
    const controller = startStreamingTurn(assistantId);
    await streamResponse(chatId, conversationSoFar, assistantId, undefined, undefined, controller);
  }

  async function handleRegenerate() {
    if (isStreaming || streamingLockRef.current || messages.length < 2) return;

    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;

    const cutIndex = messages.length - 1 - lastUserIndex;
    const conversationSoFar = messages.slice(0, cutIndex + 1);
    const assistantId = crypto.randomUUID();

    setPendingApproval(null);
    setMessages([...conversationSoFar, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    const controller = startStreamingTurn(assistantId);
    await streamResponse(activeChatId, conversationSoFar, assistantId, undefined, undefined, controller);
  }

  async function handleRetryResponse(messageId: string) {
    if (isStreaming || streamingLockRef.current) return;
    const interruptedIndex = messages.findIndex((message) => message.id === messageId && message.role === "assistant");
    if (interruptedIndex <= 0) return;
    let userIndex = -1;
    for (let index = interruptedIndex - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        userIndex = index;
        break;
      }
    }
    if (userIndex < 0) return;
    const conversationSoFar = messages.slice(0, userIndex + 1);
    const assistantId = crypto.randomUUID();
    setPendingApproval(null);
    setMessages([...messages, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    const controller = startStreamingTurn(assistantId);
    await streamResponse(activeChatId, conversationSoFar, assistantId, undefined, undefined, controller);
  }

  async function handleContinueResponse(messageId: string) {
    if (isStreaming || streamingLockRef.current) return;
    const interruptedIndex = messages.findIndex((message) => message.id === messageId && message.role === "assistant");
    if (interruptedIndex < 0) return;
    const conversationSoFar = messages.slice(0, interruptedIndex + 1);
    const continuationPrompt: ChatMessage = {
      id: `continue-${messageId}`,
      role: "user",
      content: "Continue exactly from where the previous response stopped. Do not repeat text that was already provided.",
    };
    const assistantId = crypto.randomUUID();
    setPendingApproval(null);
    setMessages([...messages, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    const controller = startStreamingTurn(assistantId);
    await streamResponse(activeChatId, [...conversationSoFar, continuationPrompt], assistantId, undefined, undefined, controller);
  }

  function persistCurrentDraft(): void {
    if (!draftScope || !draftHydrationKey || draftHydrationKeyRef.current !== draftHydrationKey) return;
    if (containsGithubToken(input) || input.length > MAX_DRAFT_LENGTH || input.length === 0) {
      removeDraft(draftScope, draftId);
      return;
    }
    const drafts = readDraftStore(draftScope);
    drafts[draftId] = input;
    writeDraftStore(draftScope, drafts);
  }

  function clearDraftForCurrentTurn(chatId?: string | null): void {
    if (!draftScope) return;
    removeDraft(draftScope, draftId);
    // When a new chat is created lazily, its unsent text lived under the
    // temporary new-chat key. Clear that key as well after the send begins.
    if (chatId && draftId === NEW_CHAT_DRAFT_ID) {
      removeDraft(draftScope, NEW_CHAT_DRAFT_ID);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isStreaming || streamingLockRef.current || attachmentPreparationLockRef.current) return;

    const attachmentNames = attachedFiles.map((file) => file.name);
    if (attachmentNames.length > 0) {
      attachmentPreparationLockRef.current = true;
      setAttachmentPreparation({ names: attachmentNames, state: "preparing" });
    }

    const chatId = await ensureChat();

    let prepared;
    try {
      prepared = await prepareAttachmentsForVision(attachedFiles);
    } catch (error) {
      attachmentPreparationLockRef.current = false;
      setAttachmentPreparation({
        names: attachmentNames,
        state: "error",
        message: error instanceof Error ? error.message : "NEXO could not prepare this attachment for analysis.",
      });
      window.setTimeout(() => setAttachmentPreparation(null), 6_000);
      return;
    }

    attachmentPreparationLockRef.current = false;
    setAttachmentPreparation(null);

    const hasAttachments = prepared.sourceNames.length > 0;
    const analysisPrompt = text || "Please analyze the attached files.";
    const enrichedPrompt = hasAttachments
      ? `${analysisPrompt}\n\n[Attached Files Prepared]\n- Files available to you: ${prepared.sourceNames.join(", ")}${prepared.extractedText ? `\n\nPrepared File Context:\n${prepared.extractedText}` : ""}`
      : analysisPrompt;
    const messageText = text || `Uploaded files: ${prepared.sourceNames.join(", ")}`;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      ...(prepared.images.length > 0 ? { imageAttachments: prepared.images } : {}),
    };
    const assistantId = crypto.randomUUID();

    const nextMessages = [...messages, userMsg];
    const conversationForApi = [...messages, { ...userMsg, content: enrichedPrompt }];
    setPendingApproval(null);

    // Do not fabricate a frontend “I will read this” reply. The selected model
    // receives prepared attachment context and produces its own acknowledgement.
    const initialAssistantContent = "";

    setMessages([
      ...nextMessages,
      {
        id: assistantId,
        role: "assistant",
        content: initialAssistantContent,
        modelId: isCoderMode ? "craft-v3" : selectedModel,
      },
    ]);
    clearDraftForCurrentTurn(chatId);
    setInput("");
    setAttachedFiles([]);
    const controller = startStreamingTurn(assistantId);

    if (chatId) {
      const persistedMessageText = `${messageText}${hasAttachments ? `\n\n[Files uploaded & prepared: ${prepared.sourceNames.join(", ")}]` : ""}`;
      saveMessage(chatId, "user", persistedMessageText);
    }

    if (chatId && messages.length === 0) {
      const words = (messageText || prepared.sourceNames[0] || "New chat").split(/\s+/).filter(Boolean);
      const title = words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
      
      fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title }),
      }).catch(() => {});

      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title } : c))
      );
    }

    await streamResponse(chatId, conversationForApi, assistantId, undefined, prepared.imagePayloads, controller, initialAssistantContent);
  }

  function handleNewChat() {
    persistCurrentDraft();
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setAttachedFiles([]);
    setPendingApproval(null);
  }

  async function handleSuggestionSelect(suggestion: string) {
    if (isStreaming || streamingLockRef.current || !suggestion.trim()) return;
    // Send the suggestion directly — same logic as handleSend but with the
    // suggestion text as the message content (no need to rely on input state).
    const chatId = await ensureChat();
    const text = suggestion.trim();

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();

    const nextMessages = [...messages, userMsg];
    setPendingApproval(null);
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "", modelId: isCoderMode ? "craft-v3" : selectedModel }]);
    clearDraftForCurrentTurn(chatId);
    setInput("");
    setAttachedFiles([]);
    const controller = startStreamingTurn(assistantId);

    if (chatId) saveMessage(chatId, "user", text);

    if (chatId && messages.length === 0) {
      const words = text.split(/\s+/).filter(Boolean);
      const title = words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
      fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title }),
      }).catch(() => {});
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    }

    await streamResponse(chatId, nextMessages, assistantId, undefined, undefined, controller);
  }

  async function handleSelectChat(chatId: string) {
    if (activeChatId === chatId) return;
    persistCurrentDraft();
    setActiveChatId(chatId);
    setSidebarOpen(false);
    await loadMessages(chatId);
  }

  async function handleDeleteChat(chatId: string) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
    try {
      await fetch(`/api/chats?id=${chatId}`, { method: "DELETE" });
    } catch {
      // list already updated optimistically
    }
  }

  async function handleRenameChat(chatId: string, newTitle: string) {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
    );
    try {
      await fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title: newTitle }),
      });
    } catch {
      // fail silently
    }
  }

  if (splashVisible) {
    return <NexoSplash />;
  }

  if (authLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-void">
        <Signal size="lg" />
        <p className="font-mono text-xs text-ink-muted">Loading NEXO AI…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-void px-6 text-center">
        <SearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        sessionId={sessionId}
        onSelectChat={handleSelectChat}
      />
      <AuthModal
          open
          mandatory
          onClose={() => {}}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  const firstName = user?.fullName?.split(" ")[0] || "there";

  return (
    <div className={`flex h-screen bg-void transition-all duration-300 ${isCoderMode ? 'ring-1 ring-inset ring-cyan/30' : ''}`}>
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        isCoderMode={isCoderMode}
        onToggleCoderMode={() => setIsCoderMode(!isCoderMode)}
        onGlobalSearch={() => setSearchModalOpen(true)}
        onOpenIntegrations={() => setIntegrationsOpen(true)}
        activePersona={activePersona}
        onSelectPersona={setActivePersona}
        onInsertTemplate={(prompt) => setInput((prev) => (prev ? prev + "\n\n" + prompt : prompt))}
      />

      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Animated Glow Border for Coder Mode */}
        {isCoderMode && (
          <div className="absolute inset-0 pointer-events-none z-50 border-[2px] border-cyan/20 rounded-none shadow-[inset_0_0_50px_rgba(0,229,255,0.1)] animate-pulse"></div>
        )}

        {/* Top bar: usage control is intentionally aligned immediately left of Settings. */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-edge/50 gap-1">
          <button
            onClick={() => setUsagePanelOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-panel hover:text-cyan"
            aria-label="Open usage dashboard"
            title="Usage Dashboard"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDevelopmentIntelligenceOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-panel hover:text-cyan"
            aria-label="Open Development Intelligence"
            title="Development Intelligence"
          >
            <Brain className="h-4 w-4" />
          </button>
          {isCoderMode && (
            <CoderModelSelector
              selected={coderModel}
              onSelect={(id) => {
                setCoderModel(id);
                try {
                  window.localStorage.setItem(CODER_MODEL_STORAGE_KEY, id);
                } catch {
                  // localStorage may be unavailable; keep the in-memory choice.
                }
              }}
            />
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-panel hover:text-ink"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>


        <AnnouncementBanner />
        <AnnouncementModal />
        <RateLimitationPanel
          sessionId={sessionId}
          theme={{ edge: "" }}
          open={usagePanelOpen}
          onClose={() => setUsagePanelOpen(false)}
        />

        {/* Session Resume Card — shows when user has recent chats and no active chat */}
        {!activeChatId && chats.length > 0 && (
          <SessionResumeCard
            recentChats={chats}
            onSelectChat={handleSelectChat}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          <div className={`flex flex-1 flex-col transition-all duration-500 ${isCoderMode && lastExtractedCode ? 'w-1/2' : 'w-full'}`}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
              <div className="mx-auto max-w-3xl px-4 py-8">
                {messages.length === 0 && !attachmentPreparation ? (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-up">
                    <Signal size="lg" className="mb-8" />
                    <h1 className="font-display text-4xl font-black tracking-tight text-ink md:text-5xl">
                      {isCoderMode ? "What will you build next," : "How can I help you,"} <span className="text-cyan">{firstName}?</span>
                    </h1>
                    <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-ink-muted">
                      {isCoderMode 
                        ? "BrainEx Engine is active. Describe the app or architecture you want to create below."
                        : "Your personal AI workspace is ready. Start a new conversation or pick up where you left off."}
                    </p>

                    {isCoderMode && !selectedRepo && (
                      <p className="mt-4 max-w-md text-xs text-amber-400">
                        No repository selected — connect GitHub and pick a repo in Settings to enable code commits.
                      </p>
                    )}
                    
                    {isCoderMode && (
                      <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-lg">
                        <button onClick={() => setInput("Build a CRM system with Next.js and Supabase")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Briefcase className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">CRM & Sales</span>
                        </button>
                        <button onClick={() => setInput("Create a booking app for a medical clinic")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Database className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Booking App</span>
                        </button>
                        <button onClick={() => setInput("Design a SaaS landing page with Tailwind CSS")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Layout className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">SaaS Layout</span>
                        </button>
                        <button onClick={() => setInput("Implement a secure authentication flow")} className="flex items-center gap-3 rounded-2xl border border-edge bg-panel/50 p-4 text-left transition hover:border-cyan/50 hover:bg-panel">
                          <Zap className="h-5 w-5 text-cyan" />
                          <span className="text-xs font-bold text-ink">Auth Logic</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pb-12">
                    {messages.map((m, i) => {
                      const isLastAssistant = m.role === "assistant" && m === messages[messages.length - 1];
                      return (
                        <div key={m.id}>
                          <MessageBubble
                            message={m}
                            isLast={isLastAssistant}
                            onEdit={handleResend}
                            isStreaming={isLastAssistant && isStreaming}
                            onRegenerate={isLastAssistant ? handleRegenerate : undefined}
                            onRetry={isLastAssistant && !isStreaming ? handleRetryResponse : undefined}
                            onContinue={isLastAssistant && !isStreaming ? handleContinueResponse : undefined}
                            coderMode={githubIntegrationEnabled && (Boolean(selectedRepo) || m.modelId === "craft-v3")}
                            repoFullName={githubIntegrationEnabled ? selectedRepo : null}
                            sessionId={sessionId}
                            userId={user?.id}
                            onSupabaseApprove={handleSupabaseApprove}
                            onSuggestionSelect={isLastAssistant && !isStreaming ? handleSuggestionSelect : undefined}
                          />
                          {pendingApproval &&
                            pendingApproval.messageId === m.id &&
                            !isStreaming && (
                              <ApprovalCard
                                actions={pendingApproval.actions}
                                commitMessage={pendingApproval.commitMessage}
                                repoFullName={selectedRepo}
                                status={pendingApproval.status}
                                errorDetail={commitErrorDetail}
                                onApprove={handleApproveChanges}
                                onReject={handleRejectChanges}
                              />
                            )}
                        </div>
                      );
                    })}
                    {attachmentPreparation && (
                      <div
                        className={`mx-4 flex max-w-xl items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                          attachmentPreparation.state === "error"
                            ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                            : "border-cyan/30 bg-panel/85 text-ink shadow-[0_10px_24px_rgba(0,229,255,0.08)]"
                        }`}
                        role="status"
                      >
                        {attachmentPreparation.state === "preparing" ? (
                          <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin text-cyan" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 flex-none" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {attachmentPreparation.state === "preparing" ? "Preparing attachment context" : "Attachment preparation failed"}
                          </p>
                          <p className="mt-0.5 truncate text-xs opacity-80" title={attachmentPreparation.names.join(", ")}>
                            {attachmentPreparation.state === "preparing"
                              ? attachmentPreparation.names.join(", ")
                              : attachmentPreparation.message}
                          </p>
                        </div>
                      </div>
                    )}
                    {isStreaming && <TypingIndicator modelId={isCoderMode ? "craft-v3" : selectedModel} />}
                  </div>
                )}
              </div>
            </div>

            <LiveStatusBar
              actions={githubIntegrationEnabled ? activityActions : []}
              streaming={isStreaming}
              repoFullName={githubIntegrationEnabled ? selectedRepo : null}
              searching={activitySearching?.action ?? null}
              charsPerSecond={typingSpeed}
            />

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isStreaming || attachmentPreparation?.state === "preparing"}
              onOpenSidebar={() => setSidebarOpen(true)}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              unlockedTiers={UNLOCKED_TIERS}
              onAttach={handleAttach}
              attachedFiles={attachedFiles}
              onRemoveAttach={handleRemoveAttachment}
              isStreaming={isStreaming}
              onStop={handleStopGenerating}
              streamElapsedSeconds={streamElapsedSeconds}
              onSecretDetected={handleSecretDetected}
            />
          </div>

          {/* Nexo Coder Side Panel */}
          {isCoderMode && lastExtractedCode && (
            <div className="w-1/2 border-l border-edge bg-void/50 p-4 animate-fade-left">
              <NexoCoder 
                code={lastExtractedCode.code}
                language={lastExtractedCode.lang}
                fileName={lastExtractedCode.file}
              />
            </div>
          )}
        </div>
      </main>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <SecretDetectedModal
        open={secretModalOpen}
        saving={secretSaving}
        error={secretSaveError}
        signedIn={Boolean(user)}
        onCancel={cancelDetectedSecret}
        onConfirm={confirmDetectedSecret}
      />

      <IntegrationsPanel
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        userId={user?.id}
        githubEnabled={githubIntegrationEnabled}
        onGithubEnabledChange={(enabled) => {
          setGithubIntegrationEnabled(enabled);
          window.localStorage.setItem("nexo_github_integration_enabled", String(enabled));
          if (!enabled) {
            setPendingApproval(null);
            setCommitErrorDetail(null);
          }
        }}
      />

      <DevelopmentIntelligencePanel
        open={developmentIntelligenceOpen}
        onClose={() => setDevelopmentIntelligenceOpen(false)}
        userId={user?.id}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // A repo picked in Settings must take effect immediately; previously
          // the chat kept the stale selection until a full page reload.
          if (user) loadSelectedRepo(user.id);
        }}
        sessionId={sessionId}
        userId={user?.id}
        onSettingsChange={(settings) => {
          const savedModel = settings.default_model as NexoModelId;
          if (getPublicModel(savedModel)) setSelectedModel(savedModel);
        }}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
            }
