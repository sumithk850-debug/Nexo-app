"use client";

import { useState, useEffect } from "react";
import { Code, Play, Terminal, Layers, FileCode, Check, Copy } from "lucide-react";

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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-edge bg-panel-raised shadow-2xl animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge bg-panel px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink">Nexo Coder</h3>
            <p className="font-mono text-[10px] text-ink-faint">{fileName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 rounded-lg bg-void p-1">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-medium transition ${
              activeTab === "code" ? "bg-panel text-cyan shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Code className="h-3 w-3" />
            Code
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-medium transition ${
              activeTab === "preview" ? "bg-panel text-cyan shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Play className="h-3 w-3" />
            Preview
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 overflow-hidden bg-void">
        {activeTab === "code" ? (
          <div className="h-full overflow-auto p-4 font-mono text-sm">
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={handleCopy}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel text-ink-muted transition hover:text-cyan"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <pre className="text-ink">
              <code>{code}</code>
            </pre>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan/5 text-cyan/40">
              <Layers className="h-8 w-8" />
            </div>
            <h4 className="font-display text-sm font-bold text-ink">Live Preview Engine</h4>
            <p className="mt-2 max-w-xs text-xs text-ink-muted">
              Nexo is preparing the sandbox environment to render your {language} code.
            </p>
            <div className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-edge">
              <div className="h-full w-1/2 animate-drift bg-cyan"></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Status */}
      <div className="flex items-center justify-between border-t border-edge bg-panel px-4 py-2 text-[10px] font-mono text-ink-faint">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            Agent Ready
          </span>
          <span className="uppercase">{language}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileCode className="h-3 w-3" />
          UTF-8
        </div>
      </div>
    </div>
  );
}
