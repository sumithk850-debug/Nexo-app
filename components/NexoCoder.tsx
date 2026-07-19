"use client";

import { useState } from "react";
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  FileCode, 
  Monitor, 
  Layout, 
  Database, 
  Sparkles, 
  Terminal, 
  ChevronRight, 
  Zap,
  Briefcase,
  LineChart,
  Calendar,
  ListTodo
} from "lucide-react";

// This is the Home screen for Coder mode
export function NexoCoderHome({ 
  onAction,
  userName 
}: { 
  onAction: (action: string) => void;
  userName: string;
}) {
  const suggestions = [
    { label: "Tasks & Workflows", icon: ListTodo, color: "text-blue-400" },
    { label: "CRM & Sales", icon: LineChart, color: "text-emerald-400" },
    { label: "Content & Sites", icon: Layout, color: "text-purple-400" },
    { label: "Finance", icon: Database, color: "text-amber-400" },
    { label: "Booking", icon: Calendar, color: "text-rose-400" },
  ];

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center animate-fade-up">
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl bg-cyan/20 animate-drift"></div>
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-panel border border-edge shadow-2xl ring-1 ring-cyan/30">
          <Terminal className="h-10 w-10 text-cyan" />
        </div>
      </div>
      
      <h1 className="font-display text-4xl font-black tracking-tight text-ink md:text-5xl lg:text-6xl">
        What will you build next, <span className="text-cyan">{userName}?</span>
      </h1>
      <p className="mt-6 max-w-lg text-ink-muted font-medium">
        Describe the app you want to create and BrainEx will architect the entire system for you.
      </p>

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onAction(`Create a ${s.label} application with modern UI`)}
            className="flex items-center gap-2.5 rounded-2xl border border-edge bg-panel/50 px-5 py-3 text-sm font-bold text-ink transition-all hover:bg-panel hover:scale-105 hover:border-cyan/50 shadow-sm"
          >
            <s.icon className={`h-4 w-4 ${s.color}`} />
            {s.label}
          </button>
        ))}
        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-edge bg-panel/50 text-ink-muted transition-all hover:bg-panel hover:text-ink">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-16 text-xs font-black text-ink-faint uppercase tracking-[0.2em] flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-cyan" /> Want an agent that works on its own?
      </p>
    </div>
  );
}

// This is the Code display component
export function NexoCoderDisplay({ 
  code, 
  language = "typescript", 
  fileName = "component.tsx" 
}: { 
  code: string; 
  language?: string; 
  fileName?: string;
}) {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-edge bg-void/40 shadow-2xl backdrop-blur-2xl animate-fade-up ring-1 ring-cyan/20">
      <div className="flex items-center justify-between border-b border-edge bg-panel/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/20 to-indigo-500/20 text-cyan shadow-inner">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-ink uppercase">BrainEx Engine</span>
              <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[9px] font-bold text-cyan uppercase tracking-widest animate-pulse">Live</span>
            </div>
            <p className="text-[11px] font-bold text-ink-faint flex items-center gap-1.5">
              <FileCode className="h-3 w-3" /> {fileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-2xl bg-void/50 p-1.5 border border-edge">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ${
              activeTab === "code" 
                ? "bg-cyan text-void shadow-lg shadow-cyan/20 scale-105" 
                : "text-ink-muted hover:text-ink hover:bg-panel"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Source
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ${
              activeTab === "preview" 
                ? "bg-cyan text-void shadow-lg shadow-cyan/20 scale-105" 
                : "text-ink-muted hover:text-ink hover:bg-panel"
            }`}
          >
            <Layout className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-void/20">
        {activeTab === "code" ? (
          <div className="h-full overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar">
            <div className="flex justify-between items-start mb-4">
               <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/50"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/50"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/50"></div>
               </div>
               <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-lg bg-panel/50 px-3 py-1.5 text-[10px] font-bold text-ink-muted transition-all hover:bg-panel hover:text-cyan border border-edge"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "COPIED" : "COPY CODE"}
              </button>
            </div>
            <pre className="text-ink/90 selection:bg-cyan/30">
              <code>{code}</code>
            </pre>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade-up">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl bg-cyan/20 animate-drift"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-panel border border-edge shadow-2xl">
                <Monitor className="h-10 w-10 text-cyan" />
              </div>
            </div>
            <h3 className="text-lg font-black text-ink tracking-tight uppercase">Virtual Nexus Environment</h3>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-ink-muted">
              The BrainEx engine is simulating this architecture. Full deployment preview is currently optimized for Nexo Pro users.
            </p>
            <div className="mt-8 flex gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel/50 px-4 py-2.5 text-xs font-bold text-ink-muted">
                <Database className="h-3.5 w-3.5" /> DB Schema Valid
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel/50 px-4 py-2.5 text-xs font-bold text-ink-muted">
                <Zap className="h-3.5 w-3.5 text-cyan" /> Optimized
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-edge bg-panel/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-ink-faint uppercase tracking-[0.15em]">
              <Sparkles className="h-3 text-cyan" /> Advanced AI Architect
            </div>
            <div className="h-1 w-1 rounded-full bg-edge"></div>
            <div className="text-[10px] font-black text-ink-faint uppercase tracking-[0.15em]">
              {language}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-cyan uppercase tracking-[0.15em]">
            Processing <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
