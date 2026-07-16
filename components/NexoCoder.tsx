"use client";

import { useState } from "react";
import { Code, Play, Terminal, Layers, FileCode, Check, Copy, Maximize2 } from "lucide-react";

interface NexoCoderProps {
  code: string;
  language?: string;
  fileName?: string;
  onClose?: () => void;
}

export function NexoCoder({ code, language = "typescript", fileName = "component.tsx" }: NexoCoderProps) {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/40 backdrop-blur-xl shadow-[0_0_40px_-15px_rgba(0,229,255,0.2)] animate-fade-up transition-all duration-500 hover:shadow-[0_0_50px_-10px_rgba(0,229,255,0.3)]">
      {/* Animated Glow Border */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan/20 via-transparent to-indigo/20 opacity-30"></div>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/10 text-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Terminal className="h-4.5 w-4.5" />
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan animate-pulse"></div>
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan/80">Nexo Coder</h3>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] text-ink-muted">{fileName}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 rounded-xl bg-black/20 p-1 border border-white/5">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-bold transition-all duration-300 ${
              activeTab === "code" ? "bg-cyan text-void shadow-[0_0_20px_rgba(0,229,255,0.4)]" : "text-ink-muted hover:text-ink hover:bg-white/5"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            CODE
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-bold transition-all duration-300 ${
              activeTab === "preview" ? "bg-cyan text-void shadow-[0_0_20px_rgba(0,229,255,0.4)]" : "text-ink-muted hover:text-ink hover:bg-white/5"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            PREVIEW
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 overflow-hidden">
        {activeTab === "code" ? (
          <div className="h-full overflow-auto p-6 font-mono text-[13px] leading-relaxed selection:bg-cyan/30">
            <div className="absolute right-6 top-6 z-10 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-muted backdrop-blur-md transition-all hover:bg-white/10 hover:text-cyan hover:scale-105"
                title="Copy Code"
              >
                {copied ? <Check className="h-4 w-4 text-cyan" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-muted backdrop-blur-md transition-all hover:bg-white/10 hover:text-cyan hover:scale-105"
                title="Expand"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
            <pre className="text-ink/90">
              <code className="block whitespace-pre">{code}</code>
            </pre>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-2xl bg-cyan/20 animate-pulse"></div>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 text-cyan shadow-2xl">
                <Layers className="h-10 w-10" />
              </div>
            </div>
            <h4 className="font-display text-lg font-black tracking-tight text-ink">Nexo Sandbox Engine</h4>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-muted/80">
              Preparing a secure virtual environment to render your <span className="text-cyan font-bold">{language}</span> architecture.
            </p>
            <div className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/5 border border-white/5">
              <div className="h-full w-1/3 animate-drift bg-gradient-to-r from-cyan via-indigo to-cyan bg-[length:200%_100%]"></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Status */}
      <div className="flex items-center justify-between border-t border-white/5 bg-black/10 px-5 py-3 text-[10px] font-bold tracking-widest text-ink-muted/60">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_10px_rgba(0,229,255,0.8)]"></span>
            AGENT ACTIVE
          </span>
          <span className="uppercase text-cyan/60">{language}</span>
        </div>
        <div className="flex items-center gap-2 opacity-60">
          <FileCode className="h-3.5 w-3.5" />
          UTF-8 ENCODED
        </div>
      </div>
    </div>
  );
}
