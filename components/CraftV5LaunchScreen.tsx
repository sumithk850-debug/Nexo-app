"use client";

import { ArrowRight, Check, Clock3, Code2, GitBranch, ShieldCheck, Sparkles, Zap } from "lucide-react";

export interface CraftV5TrialView {
  startedAt: string;
  expiresAt: string;
  active: boolean;
  remainingMs: number;
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

export function CraftV5LaunchScreen({
  trial,
  onStart,
}: {
  trial: CraftV5TrialView;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#070a13] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-24 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -right-24 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,.16)]"><Sparkles className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">KYVORIX AI</p><p className="mt-1 text-xs text-white/50">Coding intelligence release</p></div>
          </div>
          <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">TRIAL CARD V5</span>
        </header>

        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:py-16">
          <div>
            <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /> New coding experience</p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Craft V5<br /><span className="bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-transparent">has arrived.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">A more deliberate, repository-aware coding experience from Kyvorix AI. Craft V5 plans before it edits, protects your project state, and verifies the work before it calls a task complete.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><button type="button" onClick={onStart} className="group inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#041017] shadow-[0_10px_35px_rgba(34,211,238,.25)] transition hover:bg-cyan-200 active:scale-[.98]">Start building with Craft V5 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button><span className="flex items-center gap-1.5 text-xs text-white/45"><Clock3 className="h-3.5 w-3.5" /> {formatRemaining(trial.remainingMs)} remaining</span></div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_25px_100px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-7">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-400/15 blur-3xl" />
            <div className="relative"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-cyan-200" /><span className="text-xs font-bold text-white/80">Craft V5 workspace</span></div><Zap className="h-4 w-4 text-violet-200" /></div><div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Active trial window</p><p className="mt-3 text-3xl font-black tracking-tight text-white">{formatRemaining(trial.remainingMs)}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[92%] rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" /></div></div><div className="mt-5 space-y-3"><Feature icon={GitBranch} text="Repository-aware task planning" /><Feature icon={ShieldCheck} text="Verified changes before approval" /><Feature icon={Check} text="Build and regression awareness" /></div></div>
          </div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.14em] text-white/35"><span>Powered by the existing Kyvorix coding engine</span><span>48-hour access · one trial per account</span></footer>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Check; text: string }) {
  return <div className="flex items-center gap-3 text-xs text-white/65"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/10 text-cyan-200"><Icon className="h-3.5 w-3.5" /></span><span>{text}</span></div>;
}
