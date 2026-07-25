"use client";

import { useState } from "react";
import { Code2, Copy, Check, FileCode, Monitor, Layout, Database, Sparkles, Terminal, ChevronRight, Zap, Download, FolderTree } from "lucide-react";

interface CoderFile {
  code: string;
  lang: string;
  file: string;
}

export function NexoCoder({ 
  code, 
  language = "typescript", 
  fileName = "component.tsx",
  files,
}: { 
  code: string; 
  language?: string; 
  fileName?: string;
  files?: CoderFile[];
}) {
  const workspaceFiles = files?.length ? files : [{ code, lang: language, file: fileName }];
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [activeFileIndex, setActiveFileIndex] = useState(Math.max(0, workspaceFiles.length - 1));
  const [copied, setCopied] = useState(false);
  const activeFile = workspaceFiles[Math.min(activeFileIndex, workspaceFiles.length - 1)];

  function handleCopy() {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const bundle = workspaceFiles
      .map((file) => `// ${file.file}\n${file.code}`)
      .join("\n\n/* ---------- */\n\n");
    const blob = new Blob([bundle], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = workspaceFiles.length === 1 ? activeFile.file : "nexo-workspace.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-edge bg-void/40 shadow-2xl backdrop-blur-2xl animate-fade-up ring-1 ring-cyan/20">
      {/* Premium Header */}
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
              <FileCode className="h-3 w-3" /> {activeFile.file}
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

      {/* Code / Preview Area */}
      <div className="relative flex-1 overflow-hidden bg-void/20">
        {activeTab === "code" ? (
          <div className="flex h-full overflow-hidden">
            <aside className="hidden w-44 shrink-0 border-r border-edge bg-panel/20 p-3 md:block">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-ink-faint">
                <FolderTree className="h-3.5 w-3.5 text-cyan" /> Workspace
              </div>
              <div className="space-y-1">
                {workspaceFiles.map((file, index) => (
                  <button
                    key={`${file.file}-${index}`}
                    onClick={() => setActiveFileIndex(index)}
                    className={`w-full truncate rounded-xl px-3 py-2 text-left text-[11px] font-bold transition ${
                      index === activeFileIndex ? "bg-cyan text-void" : "text-ink-muted hover:bg-panel hover:text-ink"
                    }`}
                  >
                    {file.file}
                  </button>
                ))}
              </div>
            </aside>
            <div className="h-full flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar">
            <div className="flex justify-between items-start mb-4">
               <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/50"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/50"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/50"></div>
               </div>
               <button
                onClick={handleDownload}
                className="mr-2 flex items-center gap-2 rounded-lg bg-cyan/10 px-3 py-1.5 text-[10px] font-bold text-cyan transition-all hover:bg-cyan hover:text-void border border-cyan/30"
              >
                <Download className="h-3 w-3" /> EXPORT
              </button>
               <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-lg bg-panel/50 px-3 py-1.5 text-[10px] font-bold text-ink-muted transition-all hover:bg-panel hover:text-cyan border border-edge"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "COPIED" : "COPY CODE"}
              </button>
            </div>
            <pre className="text-ink/90 selection:bg-cyan/30">
              <code>{activeFile.code}</code>
            </pre>
            </div>
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

      {/* Footer Info */}
      <div className="border-t border-edge bg-panel/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-ink-faint uppercase tracking-[0.15em]">
              <Sparkles className="h-3 w-3 text-cyan" /> Advanced AI Architect
            </div>
            <div className="h-1 w-1 rounded-full bg-edge"></div>
            <div className="text-[10px] font-black text-ink-faint uppercase tracking-[0.15em]">
              {activeFile.lang}
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
