"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Clock3, Loader2, Play, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { authenticatedFetch } from "@/lib/authFetch";

type MissionStep = { title: string; instruction: string };
type StepResult = { title: string; output: string; completedAt: string };
type Mission = {
  id: string;
  title: string;
  prompt: string;
  status: "queued" | "running" | "retry_wait" | "completed" | "failed" | "cancelled";
  plan: MissionStep[];
  current_step: number;
  step_results: StepResult[];
  result: string | null;
  verification: { status?: string; checks?: Array<{ name: string; passed: boolean }>; note?: string } | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const ACTIVE = new Set(["queued", "running", "retry_wait"]);

function statusLabel(status: Mission["status"]) {
  switch (status) {
    case "queued": return "Queued";
    case "running": return "Working";
    case "retry_wait": return "Recovering";
    case "completed": return "Completed";
    case "failed": return "Needs attention";
    case "cancelled": return "Cancelled";
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function MissionCenter() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const hasActiveMissions = useMemo(() => missions.some((mission) => ACTIVE.has(mission.status)), [missions]);

  const loadMissions = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await authenticatedFetch("/api/missions", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!quiet) setError(payload.error || "Could not load mission history.");
        return;
      }
      setMissions(Array.isArray(payload.missions) ? payload.missions as Mission[] : []);
      setError("");
    } catch {
      if (!quiet) setError("Connection problem. Your saved missions are still safe; try refreshing.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  useEffect(() => {
    if (!hasActiveMissions) return;
    const timer = window.setInterval(() => { void loadMissions(true); }, 12000);
    return () => window.clearInterval(timer);
  }, [hasActiveMissions, loadMissions]);

  async function submitMission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || submitting) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch("/api/missions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ title: title.trim(), prompt: cleanPrompt }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Could not queue this mission.");
        return;
      }
      setMissions((current) => {
        const created = payload.mission as Mission;
        return [created, ...current.filter((mission) => mission.id !== created.id)].slice(0, 30);
      });
      setTitle("");
      setPrompt("");
      setNotice("Mission saved to the durable queue. It will keep progressing even if you close this page.");
    } catch {
      setError("Could not reach the mission service. Please retry; the request is protected against duplicate submissions.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelMission(mission: Mission) {
    if (busyId) return;
    setBusyId(mission.id);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api/missions/${mission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Could not cancel this mission.");
        return;
      }
      setNotice(payload.cancelRequested ? "Cancellation requested. The worker will stop at its next safe checkpoint." : "Mission cancelled.");
      await loadMissions(true);
    } catch {
      setError("Could not reach the mission service to cancel this task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-muted transition hover:bg-panel hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-edge bg-panel shadow-[0_20px_80px_rgba(0,0,0,0.12)]">
          <div className="border-b border-edge bg-gradient-to-br from-cyan/10 via-panel to-panel px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan">
                  <Play className="h-3.5 w-3.5" /> Mission Agent
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Work that survives a closed tab.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted sm:text-base">
                  Give KYVORIX a substantial task. It saves a plan, works one bounded step at a time, checkpoints each result, retries temporary failures, and keeps the finished deliverable here.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-edge bg-panel px-3 py-2 text-xs text-ink-muted">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Durable queue
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { title: "Saved checkpoints", detail: "Progress survives refreshes and disconnects." },
                { title: "Bounded execution", detail: "Each worker call stays below the request ceiling." },
                { title: "Evidence-aware finish", detail: "Completion checks are saved with the result." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-edge bg-panel/80 p-3">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-ink-muted">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submitMission} className="space-y-4 p-5 sm:p-8">
            <div>
              <label htmlFor="mission-title" className="mb-1.5 block text-sm font-medium">Mission title <span className="font-normal text-ink-muted">(optional)</span></label>
              <input
                id="mission-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="e.g. Prepare a complete launch plan"
                className="w-full rounded-xl border border-edge bg-canvas px-4 py-3 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-cyan"
              />
            </div>
            <div>
              <label htmlFor="mission-prompt" className="mb-1.5 block text-sm font-medium">What should KYVORIX work on?</label>
              <textarea
                id="mission-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={12000}
                required
                rows={5}
                placeholder="Describe the goal, constraints, expected output, and what a successful result should include…"
                className="w-full resize-y rounded-xl border border-edge bg-canvas px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-ink-muted/70 focus:border-cyan"
              />
              <div className="mt-1 text-right text-xs text-ink-muted">{prompt.length.toLocaleString()} / 12,000</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-xs leading-5 text-ink-muted">This worker currently produces AI deliverables from the supplied context. It does not browse live websites, run repository tests, or deploy changes.</p>
              <button
                type="submit"
                disabled={!prompt.trim() || submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {submitting ? "Saving mission…" : "Start durable mission"}
              </button>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Mission history</h2>
              <p className="mt-1 text-sm text-ink-muted">The database is the source of truth, not this browser tab.</p>
            </div>
            <button onClick={() => void loadMissions()} className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink-muted transition hover:text-ink" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {loading && missions.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-edge bg-panel p-6 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved missions…</div>
          ) : missions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edge bg-panel/60 p-8 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-ink-muted" />
              <p className="mt-3 font-medium">No missions yet</p>
              <p className="mt-1 text-sm text-ink-muted">Your first durable task will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {missions.map((mission) => {
                const doneSteps = Math.min(mission.current_step || 0, mission.plan?.length || 0);
                const progress = mission.plan?.length ? Math.round((doneSteps / mission.plan.length) * 100) : 0;
                const active = ACTIVE.has(mission.status);
                return (
                  <article key={mission.id} className="overflow-hidden rounded-2xl border border-edge bg-panel">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-semibold">{mission.title}</h3>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                              mission.status === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
                              mission.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-300" :
                              mission.status === "cancelled" ? "border-edge bg-canvas text-ink-muted" :
                              "border-cyan/30 bg-cyan/10 text-cyan"
                            }`}>{statusLabel(mission.status)}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-muted">Created {formatDate(mission.created_at)}</p>
                        </div>
                        {active && (
                          <button onClick={() => void cancelMission(mission)} disabled={busyId === mission.id || mission.cancel_requested} className="inline-flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs text-ink-muted transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50">
                            {busyId === mission.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            {mission.cancel_requested ? "Stopping…" : "Cancel"}
                          </button>
                        )}
                      </div>

                      {mission.plan?.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                            <span>{doneSteps} of {mission.plan.length} steps saved</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                            <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <ol className="mt-4 space-y-2">
                            {mission.plan.map((step, index) => (
                              <li key={`${mission.id}-${index}`} className="flex items-start gap-2.5 text-sm">
                                {index < doneSteps ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : index === doneSteps && active ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan" /> : <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-edge" />}
                                <span className={index < doneSteps ? "text-ink" : "text-ink-muted"}>{step.title}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {mission.status === "retry_wait" && <p className="mt-3 text-xs text-amber-300">A temporary error occurred. The worker will retry automatically (attempt {mission.attempt_count + 1} of {mission.max_attempts || 3}).</p>}
                      {mission.status === "failed" && mission.last_error && <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{mission.last_error}</p>}
                      {mission.status === "completed" && mission.verification && (
                        <div className="mt-4 rounded-xl border border-edge bg-canvas/60 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            Output checks: {mission.verification.status === "passed" ? "Passed" : "Review recommended"}
                          </div>
                          {mission.verification.checks?.map((check) => (
                            <div key={check.name} className="mt-2 flex items-start gap-2 text-xs text-ink-muted">
                              {check.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 text-amber-400" />}
                              {check.name}
                            </div>
                          ))}
                          {mission.verification.note && <p className="mt-3 text-xs leading-5 text-ink-muted">{mission.verification.note}</p>}
                        </div>
                      )}
                      {mission.result && (
                        <details className="mt-4 rounded-xl border border-edge bg-canvas/50">
                          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Open completed deliverable</summary>
                          <div className="border-t border-edge px-4 py-4">
                            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">{mission.result}</pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
