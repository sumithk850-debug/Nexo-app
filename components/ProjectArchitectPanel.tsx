"use client";

import { useState } from "react";
import { ArrowRight, Layers, ShieldCheck, Sparkles, X } from "lucide-react";

type ProjectArchitectPanelProps = {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
};

const PROJECT_TYPES = [
  "Full-stack web app",
  "Website / landing page",
  "Dashboard / admin panel",
  "Mobile-friendly web app",
  "API / backend service",
  "Developer tool",
  "Other",
];

const STACKS = [
  "Use the existing repository stack",
  "Next.js + TypeScript + Tailwind CSS",
  "React + TypeScript",
  "Node.js API",
  "Python",
  "Recommend a suitable stack",
];

export function ProjectArchitectPanel({ open, onClose, onUsePrompt }: ProjectArchitectPanelProps) {
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [stack, setStack] = useState(STACKS[0]);
  const [constraints, setConstraints] = useState("Mobile-friendly, accessible, secure, and easy to maintain.");

  if (!open) return null;

  function handleSubmit() {
    const name = projectName.trim() || "New project";
    const brief = [
      "KYVORIX AI — PROJECT BUILDER BRIEF",
      "",
      `Project name: ${name}`,
      `Project type: ${projectType}`,
      `Preferred technology: ${stack}`,
      "",
      "Project goal:",
      description.trim() || "Clarify the goal from the project context before implementation.",
      "",
      "Core features:",
      features.trim() || "Propose a practical first version with clearly scoped features.",
      "",
      "Requirements and constraints:",
      constraints.trim() || "Follow secure, maintainable, mobile-friendly defaults.",
      "",
      "WORKFLOW RULES:",
      "1. Inspect the connected repository and relevant files before changing existing code. If no repository is connected, state that clearly.",
      "2. Start with a concise architecture and implementation plan, including the proposed file tree and important decisions.",
      "3. Implement the plan as coherent multi-file changes. Reuse existing conventions and dependencies; do not replace unrelated files or remove existing features.",
      "4. For existing files, read the current contents and make focused edits. Never claim a file was read unless the repository tools confirmed it.",
      "5. Prepare all related file changes as one reviewable proposal. Show the affected paths, change types, and meaningful diffs before any GitHub write.",
      "6. Never push or commit automatically. Wait for the user's explicit approval in the GitHub change review.",
      "7. Run the relevant tests, lint, and build when available; report exactly what passed, failed, or could not be run.",
      "8. Keep each step bounded and report progress/results clearly; do not claim completion when work is partial.",
      "",
      "Begin by inspecting the project and returning the architecture plan. Then proceed with implementation in reviewable stages."
    ].join("\n");

    onUsePrompt(brief);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="project-architect-title">
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-cyan/25 bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:max-h-[90dvh] sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-edge bg-panel-raised/70 px-4 py-4 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan/25 bg-cyan/10 text-cyan">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan">KYVORIX AI · Coder Mode</p>
            <h2 id="project-architect-title" className="mt-1 text-lg font-semibold text-ink sm:text-xl">Project Builder</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted sm:text-sm">Turn an idea into a structured project brief, architecture plan, and reviewable multi-file implementation.</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition hover:bg-panel hover:text-ink" aria-label="Close Project Builder">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-ink-muted">
              Project name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={100} placeholder="e.g. Study Planner" className="mt-1.5 h-10 w-full rounded-xl border border-edge bg-void/70 px-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-cyan/50" />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Project type
              <select value={projectType} onChange={(event) => setProjectType(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-edge bg-void/70 px-3 text-sm text-ink outline-none focus:border-cyan/50">
                {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium text-ink-muted">
            What should it do?
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={5000} placeholder="Describe the problem, who will use it, and what a successful result looks like…" className="mt-1.5 w-full resize-y rounded-xl border border-edge bg-void/70 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-cyan/50" />
          </label>

          <label className="block text-xs font-medium text-ink-muted">
            Core features
            <textarea value={features} onChange={(event) => setFeatures(event.target.value)} rows={3} maxLength={5000} placeholder="One feature per line, e.g. user dashboard, search, saved projects…" className="mt-1.5 w-full resize-y rounded-xl border border-edge bg-void/70 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-cyan/50" />
          </label>

          <label className="block text-xs font-medium text-ink-muted">
            Technology preference
            <select value={stack} onChange={(event) => setStack(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-edge bg-void/70 px-3 text-sm text-ink outline-none focus:border-cyan/50">
              {STACKS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block text-xs font-medium text-ink-muted">
            Extra requirements
            <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={2} maxLength={3000} className="mt-1.5 w-full resize-y rounded-xl border border-edge bg-void/70 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-cyan/50" />
          </label>

          <div className="flex items-start gap-2 rounded-xl border border-cyan/20 bg-cyan/5 p-3 text-xs leading-relaxed text-ink-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
            <p><span className="font-semibold text-ink">You stay in control.</span> This prepares a brief for Coder Mode. It does not write to GitHub. File changes must still be reviewed and explicitly approved before pushing.</p>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-edge bg-panel-raised/50 p-4 sm:flex-row sm:justify-end sm:px-6">
          <button onClick={onClose} className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-panel">Cancel</button>
          <button onClick={handleSubmit} className="flex items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110">
            <Sparkles className="h-4 w-4" />
            Use brief in Coder Mode
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  );
}
