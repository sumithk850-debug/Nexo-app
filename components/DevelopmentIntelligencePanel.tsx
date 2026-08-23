"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Code2,
  Loader2,
  Plus,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authFetch";

type Brain = {
  id: string;
  name: string;
  description: string;
  conventions: string;
  goals: string;
  is_active: boolean;
};

type BrainTask = {
  id: string;
  project_brain_id: string | null;
  title: string;
  detail: string;
  status: "planned" | "in_progress" | "blocked" | "completed";
  priority: "low" | "medium" | "high";
};

type Preference = {
  instruction: string;
  detail_level: "concise" | "balanced" | "detailed";
  preferred_language: "auto" | "english" | "sinhala";
};

type KnowledgeEntry = { id: string; title: string; content: string; tags: string[] };
type ReleaseBrief = { id: string; title: string; version: string; summary: string; status: "draft" | "ready" };
type Recipe = { id: string; name: string; description: string; recipe_type: string; enabled: boolean };
type RecipePreview = { recipeId: string; name: string; description: string; recipeType: string; enabled: boolean; steps: string[]; mutationPolicy: string };
type Report = { id: string; title: string; overall_status: "ready" | "attention" | "blocked"; summary: string };
type RepositoryAnalysis = {
  repository: string;
  defaultBranch: string;
  private: boolean;
  writeAvailable: boolean;
  primaryLanguage: string | null;
  totalFiles: number;
  sourceFiles: number;
  topLevel: string[];
  manifests: string[];
  workflows: string[];
  testFiles: string[];
  workflowHealth: {
    availability: "available" | "unavailable";
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
    latest: Array<{ id: number; name: string; status: string; conclusion: string | null; updatedAt: string | null; branch: string | null; event: string | null }>;
  };
  impact: { path: string; directory: string; nearbyFiles: string[]; relatedTests: string[]; concerns: string[] } | null;
};

type Workspace = {
  brains: Brain[];
  tasks: BrainTask[];
  preferences: Preference | null;
  knowledgeEntries: KnowledgeEntry[];
  regressionReports: Report[];
  releaseBriefs: ReleaseBrief[];
  recipes: Recipe[];
};

const EMPTY: Workspace = {
  brains: [], tasks: [], preferences: null, knowledgeEntries: [], regressionReports: [], releaseBriefs: [], recipes: [],
};

const TABS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "brain", label: "Project Brain", icon: Brain },
  { id: "plan", label: "Planner", icon: ClipboardList },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "release", label: "Release", icon: Rocket },
  { id: "recipes", label: "Recipes", icon: WandSparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

function statusTone(status: string) {
  if (status === "completed" || status === "ready") return "bg-emerald-400/10 text-emerald-300";
  if (status === "blocked") return "bg-rose-400/10 text-rose-300";
  if (status === "in_progress" || status === "attention") return "bg-amber-400/10 text-amber-200";
  return "bg-ink-faint/20 text-ink-muted";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-ink-muted"><span>{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-ink-faint/10 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition focus:border-cyan/70 focus:ring-2 focus:ring-cyan/10";

export function DevelopmentIntelligencePanel({ open, onClose, userId }: { open: boolean; onClose: () => void; userId?: string }) {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("brain");
  const [showNewBrain, setShowNewBrain] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewKnowledge, setShowNewKnowledge] = useState(false);
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [showNewRecipe, setShowNewRecipe] = useState(false);
  const [brainDraft, setBrainDraft] = useState({ name: "", description: "", conventions: "", goals: "", is_active: true });
  const [taskDraft, setTaskDraft] = useState({ title: "", detail: "", priority: "medium", project_brain_id: "" });
  const [knowledgeDraft, setKnowledgeDraft] = useState({ title: "", content: "", tags: "" });
  const [releaseDraft, setReleaseDraft] = useState({ title: "", version: "", summary: "" });
  const [recipeDraft, setRecipeDraft] = useState({ name: "", description: "", recipe_type: "review_repository" });
  const [preferenceDraft, setPreferenceDraft] = useState<Preference>({ instruction: "", detail_level: "balanced", preferred_language: "auto" });
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [analysisPath, setAnalysisPath] = useState("");
  const [analyzingRepository, setAnalyzingRepository] = useState(false);
  const [recipePreview, setRecipePreview] = useState<RecipePreview | null>(null);
  const [previewingRecipeId, setPreviewingRecipeId] = useState<string | null>(null);

  const activeBrain = useMemo(() => workspace.brains.find((brain) => brain.is_active) ?? workspace.brains[0] ?? null, [workspace.brains]);
  const intelligenceSummary = useMemo(() => {
    const inProgress = workspace.tasks.filter((task) => task.status === "in_progress").length;
    const blocked = workspace.tasks.filter((task) => task.status === "blocked").length;
    const planned = workspace.tasks.filter((task) => task.status === "planned").length;
    const latestReport = workspace.regressionReports[0] ?? null;
    const readiness = blocked > 0 || latestReport?.overall_status === "blocked"
      ? "blocked"
      : inProgress > 0 || latestReport?.overall_status === "attention"
        ? "attention"
        : "ready";
    const nextStep = blocked > 0
      ? "Resolve the current blocked task before preparing a release."
      : inProgress > 0
        ? "Continue the active task and save a regression snapshot when it is ready for review."
        : planned > 0
          ? "Move the highest-priority planned task into progress when you are ready to begin."
          : "Create a project task or release brief to start building a focused execution plan.";
    return { inProgress, blocked, planned, latestReport, readiness, nextStep };
  }, [workspace]);

  const load = useCallback(async () => {
    if (!userId) { setWorkspace(EMPTY); return; }
    setLoading(true); setError(null);
    try {
      const response = await authenticatedFetch("/api/development-intelligence", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load your private workspace.");
      setWorkspace({ ...EMPTY, ...data });
      const saved = data.preferences as Preference | null;
      if (saved) setPreferenceDraft(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your private workspace.");
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function create(action: string, payload: Record<string, unknown>) {
    setSaving(true); setError(null);
    try {
      const response = await authenticatedFetch("/api/development-intelligence", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this workspace item.");
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this workspace item.");
      return false;
    } finally { setSaving(false); }
  }

  async function patch(resource: string, id: string, payload: Record<string, unknown>) {
    setSaving(true); setError(null);
    try {
      const response = await authenticatedFetch("/api/development-intelligence", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, id, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update this workspace item.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this workspace item."); }
    finally { setSaving(false); }
  }

  async function remove(resource: string, id: string) {
    if (!window.confirm("Remove this private workspace item?")) return;
    setSaving(true); setError(null);
    try {
      const response = await authenticatedFetch(`/api/development-intelligence?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove this workspace item.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this workspace item."); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const addBrain = async () => {
    if (await create("brain", brainDraft)) { setBrainDraft({ name: "", description: "", conventions: "", goals: "", is_active: true }); setShowNewBrain(false); }
  };
  const addTask = async () => {
    if (await create("task", { ...taskDraft, project_brain_id: taskDraft.project_brain_id || activeBrain?.id || "" })) { setTaskDraft({ title: "", detail: "", priority: "medium", project_brain_id: "" }); setShowNewTask(false); }
  };
  const addKnowledge = async () => {
    if (await create("knowledge", { ...knowledgeDraft, tags: knowledgeDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) })) { setKnowledgeDraft({ title: "", content: "", tags: "" }); setShowNewKnowledge(false); }
  };
  const addRelease = async () => {
    if (await create("release", releaseDraft)) { setReleaseDraft({ title: "", version: "", summary: "" }); setShowNewRelease(false); }
  };
  const addRecipe = async () => {
    if (await create("recipe", recipeDraft)) { setRecipeDraft({ name: "", description: "", recipe_type: "review_repository" }); setShowNewRecipe(false); }
  };
  const analyzeRepository = async () => {
    setAnalyzingRepository(true); setError(null);
    try {
      const query = analysisPath.trim() ? `?path=${encodeURIComponent(analysisPath.trim())}` : "";
      const response = await authenticatedFetch(`/api/development-intelligence/repository-analysis${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not analyze the selected repository.");
      setAnalysis(data.analysis as RepositoryAnalysis);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not analyze the selected repository."); }
    finally { setAnalyzingRepository(false); }
  };

  const previewRecipe = async (recipeId: string) => {
    setPreviewingRecipeId(recipeId); setError(null);
    try {
      const response = await authenticatedFetch("/api/development-intelligence", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recipe_preview", recipe_id: recipeId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not prepare the recipe preview.");
      setRecipePreview(data.preview as RecipePreview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the recipe preview."); }
    finally { setPreviewingRecipeId(null); }
  };

  const saveRegressionSnapshot = async () => {
    if (!analysis) return;
    const workflow = analysis.workflowHealth;
    const overallStatus = workflow.availability === "unavailable" || workflow.failed > 0 ? "attention" : workflow.inProgress > 0 ? "attention" : "ready";
    const summary = workflow.availability === "unavailable"
      ? `${analysis.repository}: repository structure checked. Workflow health is unavailable for this connection.`
      : `${analysis.repository}: ${analysis.totalFiles} files reviewed; latest workflows: ${workflow.successful} successful, ${workflow.failed} needing attention, ${workflow.inProgress} in progress.`;
    await create("report", { title: `Regression snapshot — ${analysis.repository}`, overall_status: overallStatus, summary });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button aria-label="Close Development Intelligence" className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#07111f] shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex gap-3">
            <div className="rounded-2xl bg-cyan/10 p-2.5 text-cyan"><Brain className="h-6 w-6" /></div>
            <div><h2 className="text-lg font-bold text-ink">Development Intelligence</h2><p className="mt-0.5 text-sm text-ink-muted">Private project context, planning, and safe release preparation.</p></div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-xl p-2 text-ink-muted transition hover:bg-white/5 hover:text-ink"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-white/10 px-4 pt-3 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-3">
            {TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${activeTab === tab.id ? "bg-cyan/10 text-cyan" : "text-ink-muted hover:bg-white/5 hover:text-ink"}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>; })}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {!userId ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">Sign in to use your private development workspace.</div> : loading ? <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading workspace…</div> : <>
            {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

            {activeTab === "overview" && <section className="space-y-5">
              <div className="rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/[0.09] to-transparent p-5">
                <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan">Project intelligence</p><h3 className="mt-2 text-xl font-bold text-ink">{activeBrain ? activeBrain.name : "Set your project direction"}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">{activeBrain?.description || "Create a Project Brain to keep your goals, conventions, and planning context organized in one private workspace."}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(intelligenceSummary.readiness)}`}>{intelligenceSummary.readiness}</span></div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-[#07111f]/55 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">In progress</p><p className="mt-1 text-2xl font-bold text-ink">{intelligenceSummary.inProgress}</p></div><div className="rounded-xl border border-white/10 bg-[#07111f]/55 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Planned</p><p className="mt-1 text-2xl font-bold text-ink">{intelligenceSummary.planned}</p></div><div className="rounded-xl border border-white/10 bg-[#07111f]/55 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Private notes</p><p className="mt-1 text-2xl font-bold text-ink">{workspace.knowledgeEntries.length}</p></div></div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex gap-3"><ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-cyan" /><div><h3 className="font-semibold text-ink">Recommended next step</h3><p className="mt-1 text-sm leading-6 text-ink-muted">{intelligenceSummary.nextStep}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setActiveTab("plan")} className="rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan">Open planner</button><button type="button" onClick={() => setActiveTab("release")} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-ink-muted transition hover:text-ink">Review release readiness</button></div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-ink">Latest regression snapshot</h3><p className="mt-1 text-sm text-ink-muted">{intelligenceSummary.latestReport ? intelligenceSummary.latestReport.summary || "No summary was recorded." : "No regression snapshot has been saved yet."}</p></div>{intelligenceSummary.latestReport && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(intelligenceSummary.latestReport.overall_status)}`}>{intelligenceSummary.latestReport.overall_status}</span>}</div></div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.045] p-4 text-sm leading-6 text-amber-100"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>This overview prepares context and highlights follow-up work only. It never changes code, data, deployments, or external services automatically.</p></div></div>
            </section>}

            {activeTab === "brain" && <section className="space-y-5">
              <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan" /><div><h3 className="font-semibold text-ink">Private by design</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Only your active project summary, goals, conventions, and open tasks guide Nexo. No credentials, repository source files, tool output, or private knowledge notes are added to model context.</p></div></div></div>
              <div className="flex items-center justify-between"><div><h3 className="font-semibold text-ink">Project Brains</h3><p className="text-sm text-ink-muted">Keep one workspace active for focused conversations.</p></div><button onClick={() => setShowNewBrain(!showNewBrain)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031]"><Plus className="h-4 w-4" /> New Brain</button></div>
              {showNewBrain && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><Field label="Project name"><input className={inputClass} value={brainDraft.name} onChange={(e) => setBrainDraft({ ...brainDraft, name: e.target.value })} placeholder="Nexo platform" /></Field><Field label="Description"><textarea className={inputClass} rows={2} value={brainDraft.description} onChange={(e) => setBrainDraft({ ...brainDraft, description: e.target.value })} placeholder="What this project is for" /></Field><Field label="Conventions"><textarea className={inputClass} rows={2} value={brainDraft.conventions} onChange={(e) => setBrainDraft({ ...brainDraft, conventions: e.target.value })} placeholder="Rules Nexo should respect" /></Field><Field label="Goals"><textarea className={inputClass} rows={2} value={brainDraft.goals} onChange={(e) => setBrainDraft({ ...brainDraft, goals: e.target.value })} placeholder="Current priorities" /></Field><button disabled={saving || !brainDraft.name.trim()} onClick={() => void addBrain()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save Project Brain</button></div>}
              {workspace.brains.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-ink-muted">Create a Project Brain to give Nexo private, concise project direction.</div> : workspace.brains.map((brain) => <div key={brain.id} className={`rounded-2xl border p-4 ${brain.is_active ? "border-cyan/35 bg-cyan/[0.045]" : "border-white/10 bg-white/[0.02]"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-ink">{brain.name}</h4>{brain.is_active && <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-bold text-cyan">ACTIVE</span>}</div><p className="mt-1 text-sm text-ink-muted">{brain.description || "No description yet."}</p>{brain.goals && <p className="mt-2 text-xs text-ink-muted"><b className="text-ink">Goals:</b> {brain.goals}</p>}</div><div className="flex gap-1"><button title="Make active" onClick={() => void patch("brain", brain.id, { is_active: true })} className="rounded-lg p-2 text-cyan hover:bg-cyan/10"><CheckCircle2 className="h-4 w-4" /></button><button title="Delete" onClick={() => void remove("brain", brain.id)} className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div></div></div>)}
              <div className="border-t border-white/10 pt-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-ink">Response preferences</h3><p className="text-sm text-ink-muted">User-controlled preferences, never inferred silently.</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Detail level"><select className={inputClass} value={preferenceDraft.detail_level} onChange={(e) => setPreferenceDraft({ ...preferenceDraft, detail_level: e.target.value as Preference["detail_level"] })}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></Field><Field label="Preferred response language"><select className={inputClass} value={preferenceDraft.preferred_language} onChange={(e) => setPreferenceDraft({ ...preferenceDraft, preferred_language: e.target.value as Preference["preferred_language"] })}><option value="auto">Auto</option><option value="english">English</option><option value="sinhala">Sinhala</option></select></Field></div><Field label="Additional instruction"><textarea className={`${inputClass} mt-1.5`} rows={2} value={preferenceDraft.instruction} onChange={(e) => setPreferenceDraft({ ...preferenceDraft, instruction: e.target.value })} placeholder="For example: lead with the conclusion, then explain the reasoning." /></Field><button disabled={saving} onClick={() => void create("preference", preferenceDraft)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save preferences</button></div>
            </section>}

            {activeTab === "plan" && <section className="space-y-5"><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-cyan" /><div><h3 className="font-semibold text-ink">Task Planner & Checkpoints</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Track project work, blockers, and next steps. Tasks guide planning only; they never trigger code, database, repository, or deployment changes.</p></div></div></div><div className="flex items-center justify-between"><div><h3 className="font-semibold text-ink">Tasks</h3><p className="text-sm text-ink-muted">{activeBrain ? `Linked to ${activeBrain.name}` : "Create a Project Brain first, or keep tasks independent."}</p></div><button onClick={() => setShowNewTask(!showNewTask)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031]"><Plus className="h-4 w-4" /> New task</button></div>{showNewTask && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><Field label="Task"><input className={inputClass} value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="Review release checklist" /></Field><Field label="Detail"><textarea className={inputClass} rows={2} value={taskDraft.detail} onChange={(e) => setTaskDraft({ ...taskDraft, detail: e.target.value })} placeholder="Optional context" /></Field><Field label="Priority"><select className={inputClass} value={taskDraft.priority} onChange={(e) => setTaskDraft({ ...taskDraft, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field><button disabled={saving || !taskDraft.title.trim()} onClick={() => void addTask()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save task</button></div>}{workspace.tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-ink-muted">No tasks yet.</div> : workspace.tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"><button title="Advance task status" onClick={() => void patch("task", task.id, { status: task.status === "planned" ? "in_progress" : task.status === "in_progress" ? "completed" : "planned" })} className="rounded-lg p-1 text-cyan hover:bg-cyan/10"><CheckCircle2 className="h-5 w-5" /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-ink">{task.title}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(task.status)}`}>{task.status.replace("_", " ")}</span><span className="text-[10px] font-semibold uppercase text-ink-muted">{task.priority}</span></div>{task.detail && <p className="mt-1 text-sm text-ink-muted">{task.detail}</p>}</div><button title="Delete" onClick={() => void remove("task", task.id)} className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div>)}</section>}

            {activeTab === "knowledge" && <section className="space-y-5"><div className="rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4"><div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5 text-cyan" /><div><h3 className="font-semibold text-ink">Private Knowledge Workspace</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Save concise notes you control. Notes remain private and are not automatically placed in AI prompts; remove them at any time.</p></div></div></div><div className="flex items-center justify-between"><h3 className="font-semibold text-ink">Knowledge notes</h3><button onClick={() => setShowNewKnowledge(!showNewKnowledge)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031]"><Plus className="h-4 w-4" /> New note</button></div>{showNewKnowledge && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><Field label="Title"><input className={inputClass} value={knowledgeDraft.title} onChange={(e) => setKnowledgeDraft({ ...knowledgeDraft, title: e.target.value })} placeholder="Architecture decision" /></Field><Field label="Note"><textarea className={inputClass} rows={5} value={knowledgeDraft.content} onChange={(e) => setKnowledgeDraft({ ...knowledgeDraft, content: e.target.value })} placeholder="Your private note" /></Field><Field label="Tags (comma separated)"><input className={inputClass} value={knowledgeDraft.tags} onChange={(e) => setKnowledgeDraft({ ...knowledgeDraft, tags: e.target.value })} placeholder="architecture, release" /></Field><button disabled={saving || !knowledgeDraft.title.trim() || !knowledgeDraft.content.trim()} onClick={() => void addKnowledge()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save note</button></div>}{workspace.knowledgeEntries.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-ink-muted">No private notes saved.</div> : workspace.knowledgeEntries.map((entry) => <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex justify-between gap-3"><div><h4 className="font-semibold text-ink">{entry.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{entry.content}</p>{entry.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{entry.tags.map((tag) => <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-ink-muted">{tag}</span>)}</div>}</div><button title="Delete" onClick={() => void remove("knowledge", entry.id)} className="h-fit rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div></article>)}</section>}

            {activeTab === "release" && <section className="space-y-5"><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex gap-3"><Code2 className="mt-0.5 h-5 w-5 text-cyan" /><div><h3 className="font-semibold text-ink">Codebase & Change Impact</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Inspect the selected GitHub repository on demand. Nexo reads file paths and metadata only, does not modify files, and does not retain repository output.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><input className={inputClass} value={analysisPath} onChange={(e) => setAnalysisPath(e.target.value)} placeholder="Optional file path to assess, e.g. app/api/chat/route.ts" /><button disabled={analyzingRepository} onClick={() => void analyzeRepository()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan disabled:opacity-50">{analyzingRepository ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Code2 className="h-3.5 w-3.5" />} Analyze repository</button></div>{analysis && <div className="mt-4 space-y-3 rounded-xl border border-cyan/15 bg-cyan/[0.035] p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{analysis.repository}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-ink-muted">{analysis.defaultBranch}</span><span className="text-xs text-ink-muted">{analysis.totalFiles} files · {analysis.sourceFiles} source files</span></div>{analysis.topLevel.length > 0 && <p className="text-xs leading-5 text-ink-muted"><b className="text-ink">Top level:</b> {analysis.topLevel.join(", ")}</p>}{analysis.manifests.length > 0 && <p className="text-xs leading-5 text-ink-muted"><b className="text-ink">Runtime files:</b> {analysis.manifests.join(", ")}</p>}{analysis.workflows.length > 0 && <p className="text-xs leading-5 text-ink-muted"><b className="text-ink">Workflows:</b> {analysis.workflows.join(", ")}</p>}{analysis.impact && <div className="border-t border-white/10 pt-3"><p className="font-medium text-ink">Impact for {analysis.impact.path}</p><p className="mt-1 text-xs text-ink-muted">Nearby: {analysis.impact.nearbyFiles.slice(0, 8).join(", ") || "No nearby files identified"}</p>{analysis.impact.relatedTests.length > 0 && <p className="mt-1 text-xs text-ink-muted">Related tests: {analysis.impact.relatedTests.join(", ")}</p>}<ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100">{analysis.impact.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul></div>}{analysis.workflowHealth.availability === "available" ? <div className="border-t border-white/10 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink">Recent workflow health</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${analysis.workflowHealth.failed > 0 ? statusTone("attention") : statusTone("ready")}`}>{analysis.workflowHealth.successful} passed · {analysis.workflowHealth.failed} attention · {analysis.workflowHealth.inProgress} running</span></div>{analysis.workflowHealth.latest.slice(0, 5).map((run) => <p key={run.id} className="mt-1 text-xs text-ink-muted">{run.name} — {run.conclusion ?? run.status}{run.branch ? ` · ${run.branch}` : ""}</p>)}</div> : <p className="border-t border-white/10 pt-3 text-xs text-ink-muted">Workflow health is unavailable for this repository connection. Repository analysis is still read-only.</p>}<button disabled={saving} onClick={() => void saveRegressionSnapshot()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save regression snapshot</button></div>}</div><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-cyan" /><div><h3 className="font-semibold text-ink">Regression Sentinel</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Use Nexo to prepare checks and save their outcome. It never pushes, deploys, runs migrations, or changes a database automatically.</p></div></div></div><div className="flex items-center justify-between"><h3 className="font-semibold text-ink">Release briefs</h3><button onClick={() => setShowNewRelease(!showNewRelease)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031]"><Plus className="h-4 w-4" /> New brief</button></div>{showNewRelease && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><Field label="Release title"><input className={inputClass} value={releaseDraft.title} onChange={(e) => setReleaseDraft({ ...releaseDraft, title: e.target.value })} placeholder="Nexo 4.1" /></Field><Field label="Version"><input className={inputClass} value={releaseDraft.version} onChange={(e) => setReleaseDraft({ ...releaseDraft, version: e.target.value })} placeholder="4.1.0" /></Field><Field label="Summary and rollout notes"><textarea className={inputClass} rows={4} value={releaseDraft.summary} onChange={(e) => setReleaseDraft({ ...releaseDraft, summary: e.target.value })} placeholder="Changes, checks, risks, rollback notes" /></Field><button disabled={saving || !releaseDraft.title.trim()} onClick={() => void addRelease()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save brief</button></div>}{workspace.releaseBriefs.map((brief) => <div key={brief.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-ink">{brief.title}</h4>{brief.version && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-ink-muted">v{brief.version}</span>}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(brief.status)}`}>{brief.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{brief.summary || "No rollout notes yet."}</p></div><button title="Delete" onClick={() => void remove("release", brief.id)} className="h-fit rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div></div>)}{workspace.regressionReports.length > 0 && <div><h3 className="mb-3 font-semibold text-ink">Saved regression reports</h3>{workspace.regressionReports.map((report) => <div key={report.id} className="mb-2 rounded-xl border border-white/10 p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(report.overall_status)}`}>{report.overall_status}</span><span className="text-sm font-medium text-ink">{report.title}</span></div>{report.summary && <p className="mt-1 text-xs text-ink-muted">{report.summary}</p>}</div>)}</div>}</section>}

            {activeTab === "recipes" && <section className="space-y-5"><div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.045] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-200" /><div><h3 className="font-semibold text-ink">Safe automation recipes</h3><p className="mt-1 text-sm leading-6 text-ink-muted">Recipes prepare and organize work only. They cannot automatically write to a repository, run SQL, migrate a database, promote a deployment, or send external changes. Every future mutation must stop for a separate approval card.</p></div></div></div>{recipePreview && <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.045] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">Prepared plan — {recipePreview.name}</h3><p className="mt-1 text-xs leading-5 text-ink-muted">{recipePreview.description || recipePreview.recipeType.replaceAll("_", " ")}</p></div><button type="button" onClick={() => setRecipePreview(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink" aria-label="Close recipe preview"><X className="h-4 w-4" /></button></div><ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-ink-muted">{recipePreview.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-2.5 text-xs leading-5 text-amber-100">{recipePreview.mutationPolicy}</p></div>}<div className="flex items-center justify-between"><h3 className="font-semibold text-ink">Recipes</h3><button onClick={() => setShowNewRecipe(!showNewRecipe)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031]"><Plus className="h-4 w-4" /> New recipe</button></div>{showNewRecipe && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><Field label="Recipe name"><input className={inputClass} value={recipeDraft.name} onChange={(e) => setRecipeDraft({ ...recipeDraft, name: e.target.value })} placeholder="Review release readiness" /></Field><Field label="Recipe type"><select className={inputClass} value={recipeDraft.recipe_type} onChange={(e) => setRecipeDraft({ ...recipeDraft, recipe_type: e.target.value })}><option value="review_repository">Review repository</option><option value="audit_schema">Audit schema</option><option value="prepare_release">Prepare release</option><option value="check_deployment">Check deployment</option></select></Field><Field label="Description"><textarea className={inputClass} rows={3} value={recipeDraft.description} onChange={(e) => setRecipeDraft({ ...recipeDraft, description: e.target.value })} placeholder="What should this safe preparation workflow cover?" /></Field><button disabled={saving || !recipeDraft.name.trim()} onClick={() => void addRecipe()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-[#062031] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save recipe</button></div>}{workspace.recipes.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-ink-muted">No recipes saved.</div> : workspace.recipes.map((recipe) => <div key={recipe.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"><WandSparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan" /><div className="min-w-0 flex-1"><h4 className="font-semibold text-ink">{recipe.name}</h4><p className="mt-1 text-sm text-ink-muted">{recipe.description || recipe.recipe_type.replaceAll("_", " ")}</p><span className="mt-2 inline-block rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">APPROVAL REQUIRED FOR WRITES</span></div><div className="flex gap-1"><button type="button" title="Preview safe plan" disabled={previewingRecipeId === recipe.id} onClick={() => void previewRecipe(recipe.id)} className="rounded-lg p-2 text-cyan hover:bg-cyan/10 disabled:opacity-50">{previewingRecipeId === recipe.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}</button><button title="Delete" onClick={() => void remove("recipe", recipe.id)} className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div></div>)}</section>}
          </>}
        </main>
      </aside>
    </div>
  );
}
