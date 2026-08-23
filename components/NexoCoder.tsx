"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Code2, Copy, Eye, FileCode2, FileDiff, FileText, Monitor, PanelRightClose, Play, Rows3, ShieldCheck, Sparkles, Table2 } from "lucide-react";

type WorkspaceTab = "source" | "preview" | "changes";

type WorkspaceKind = "document" | "style" | "data" | "database" | "diff" | "code";

function classifyWorkspace(language: string, fileName: string): WorkspaceKind {
  const normalized = `${language} ${fileName}`.toLowerCase();
  if (language.toLowerCase() === "diff" || fileName.toLowerCase().endsWith(".diff")) return "diff";
  if (/\b(html|htm|svg)\b/.test(normalized)) return "document";
  if (/\b(css|scss|sass|less)\b/.test(normalized)) return "style";
  if (/\b(sql|postgres|mysql|sqlite)\b/.test(normalized)) return "database";
  if (/\b(json|yaml|yml|csv)\b/.test(normalized)) return "data";
  return "code";
}

function countDiff(code: string) {
  return code.split("\n").reduce((counts, line) => ({
    additions: counts.additions + (line.startsWith("+") && !line.startsWith("+++") ? 1 : 0),
    removals: counts.removals + (line.startsWith("-") && !line.startsWith("---") ? 1 : 0),
  }), { additions: 0, removals: 0 });
}

function extractSqlTargets(code: string): string[] {
  const targets = [...code.matchAll(/(?:create|alter|drop|insert\s+into|update|delete\s+from|select\s+.+?\s+from)\s+(?:table\s+)?[\"`]?([a-zA-Z_][\w.]*)/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  return [...new Set(targets)].slice(0, 8);
}

function wrapCssPreview(code: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;min-height:100%;background:#0a0e1a;color:#e8f3ff;font-family:system-ui,sans-serif}.nexo-preview{padding:28px}.nexo-card{max-width:440px;border:1px solid rgba(148,163,184,.25);border-radius:18px;background:#111827;padding:20px;box-sizing:border-box}.nexo-kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}.nexo-title{margin:10px 0 8px;font-size:22px}.nexo-copy{margin:0;color:#a7b3c7;font-size:14px}.nexo-action{margin-top:18px;border:0;border-radius:10px;background:#06b6d4;color:#03111a;padding:10px 14px;font-weight:700}${code}</style></head><body><main class="nexo-preview"><section class="nexo-card"><div class="nexo-kicker">Style preview</div><h1 class="nexo-title">Nexo workspace</h1><p class="nexo-copy">A safe, isolated preview of the supplied stylesheet.</p><button class="nexo-action">Primary action</button></section></main></body></html>`;
}

export function NexoCoder({
  code,
  language = "typescript",
  fileName = "component.tsx",
}: {
  code: string;
  language?: string;
  fileName?: string;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("source");
  const [copied, setCopied] = useState(false);
  const kind = useMemo(() => classifyWorkspace(language, fileName), [language, fileName]);
  const diff = useMemo(() => countDiff(code), [code]);
  const sqlTargets = useMemo(() => kind === "database" ? extractSqlTargets(code) : [], [code, kind]);
  const lineCount = useMemo(() => code ? code.split("\n").length : 0, [code]);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  const isRenderable = kind === "document" || kind === "style";
  const previewSource = kind === "document" ? code : kind === "style" ? wrapCssPreview(code) : "";

  return (
    <section className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel/80 shadow-2xl ring-1 ring-cyan/15 backdrop-blur-xl" aria-label="Code workspace">
      <header className="border-b border-edge bg-panel-raised/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan">
            <FileCode2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-ink">Code workspace</h2>
              <span className="rounded-full border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cyan">Read only</span>
            </div>
            <p className="truncate font-mono text-[11px] text-ink-muted" title={fileName}>{fileName}</p>
          </div>
          <button onClick={handleCopy} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-ink-muted transition hover:border-cyan/30 hover:text-cyan" aria-label="Copy source" title="Copy source">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 rounded-lg border border-edge bg-void/40 p-1">
            {([
              ["source", Code2, "Source"],
              ["preview", Eye, "Preview"],
              ["changes", FileDiff, "Changes"],
            ] as const).map(([tab, Icon, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${activeTab === tab ? "bg-cyan text-void shadow-sm" : "text-ink-muted hover:bg-panel hover:text-ink"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <span className="shrink-0 font-mono text-[10px] text-ink-faint">{lineCount} lines</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-void/30">
        {activeTab === "source" && (
          <div className="h-full overflow-auto custom-scrollbar">
            <pre className="min-h-full p-4 font-mono text-xs leading-6 text-ink/90 selection:bg-cyan/30"><code>{code}</code></pre>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="h-full overflow-auto p-4">
            {isRenderable ? (
              <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-edge bg-white shadow-inner">
                <iframe title={`${fileName} safe preview`} srcDoc={previewSource} sandbox="" className="h-full min-h-[260px] w-full border-0" />
              </div>
            ) : kind === "database" ? (
              <div className="rounded-xl border border-edge bg-panel/70 p-4">
                <div className="flex items-center gap-2 text-cyan"><Table2 className="h-4 w-4" /><h3 className="text-sm font-semibold">Schema inspector</h3></div>
                <p className="mt-2 text-xs leading-5 text-ink-muted">This workspace keeps database statements read-only in the preview. Review the affected targets before proposing any change.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sqlTargets.length > 0 ? sqlTargets.map((target) => <span key={target} className="rounded-lg border border-edge bg-void/50 px-2 py-1 font-mono text-[11px] text-ink">{target}</span>) : <span className="text-xs text-ink-faint">No table or view target could be identified.</span>}
                </div>
              </div>
            ) : kind === "data" ? (
              <div className="rounded-xl border border-edge bg-panel/70 p-4">
                <div className="flex items-center gap-2 text-cyan"><Rows3 className="h-4 w-4" /><h3 className="text-sm font-semibold">Data inspector</h3></div>
                <p className="mt-2 text-xs leading-5 text-ink-muted">Structured data stays in source form for safe review. Copy or inspect it without running anything in your workspace.</p>
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-edge bg-void/60 p-3 font-mono text-[10px] leading-5 text-ink-muted">{code.slice(0, 2_000)}</pre>
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-edge bg-panel/40 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan/10 text-cyan"><Monitor className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-semibold text-ink">Safe preview is ready</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-ink-muted">This {language} file is shown as a source and change review to avoid executing untrusted code. HTML and stylesheets render in an isolated preview here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "changes" && (
          <div className="h-full overflow-auto p-4">
            {kind === "diff" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Additions</p><p className="mt-1 text-xl font-bold text-emerald-200">+{diff.additions}</p></div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">Removals</p><p className="mt-1 text-xl font-bold text-rose-200">-{diff.removals}</p></div>
                </div>
                <pre className="overflow-auto rounded-xl border border-edge bg-void/60 p-3 font-mono text-[10px] leading-5 text-ink-muted">{code}</pre>
              </div>
            ) : (
              <div className="rounded-xl border border-edge bg-panel/60 p-4">
                <div className="flex items-center gap-2 text-cyan"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Review-ready source</h3></div>
                <p className="mt-2 text-xs leading-5 text-ink-muted">No patch was included with this file. When a proposed edit is available, its additions and removals appear here before any approval step.</p>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-faint"><FileText className="h-3.5 w-3.5" /> {fileName} · {language}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-edge bg-panel-raised/50 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-ink-faint"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Isolated preview</div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-faint"><Sparkles className="h-3.5 w-3.5 text-cyan" /> Review before approval</div>
      </footer>
    </section>
  );
}
