"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Pencil, RefreshCw, Check, X } from "lucide-react";
import type { ArtifactDescriptor } from "@/lib/artifactTypes";

export function ArtifactCard({ artifact }: { artifact: ArtifactDescriptor }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  function download() {
    const binary = atob(artifact.fileBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-cyan/25 bg-panel shadow-[0_18px_50px_rgba(0,0,0,0.16)]" aria-label={`${artifact.title} artifact`}>
      <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-300">Excel Workbook</p><h3 className="truncate font-display text-base font-bold text-ink">{artifact.title}</h3></div>
        </div>
        <span className="flex-none rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-semibold text-cyan">Ready</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2 text-[11px] text-ink-muted"><span>{artifact.sheets.length} sheets</span><span>·</span><span>{Math.max(1, Math.round(artifact.sizeBytes / 1024))} KB</span><span>·</span><span>{new Date(artifact.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
        <div className="grid gap-2 sm:grid-cols-2">{artifact.highlights.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-void/45 px-3 py-2 text-xs text-ink-muted"><Check className="h-3.5 w-3.5 text-emerald-500" />{item}</div>)}</div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setPreviewOpen((value) => !value)} className="rounded-xl border border-edge bg-void/40 px-3 py-2 text-xs font-semibold text-ink transition hover:border-cyan/40">{previewOpen ? "Hide preview" : "Preview data"}</button><button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-cyan px-3 py-2 text-xs font-bold text-void transition hover:brightness-105 active:scale-[.98]"><Download className="h-3.5 w-3.5" />{downloaded ? "Downloaded" : "Download .xlsx"}</button><button onClick={() => setEditOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-edge px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink"><Pencil className="h-3.5 w-3.5" />Ask to edit</button></div>
        {previewOpen && <div className="overflow-x-auto rounded-xl border border-edge"><table className="min-w-[520px] w-full text-left text-xs"><thead className="bg-cyan/10 text-[10px] uppercase tracking-wider text-cyan"><tr>{artifact.preview.columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}</tr></thead><tbody>{artifact.preview.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-edge/70 odd:bg-void/20">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 text-ink-muted">{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>}
        {editOpen && <div className="rounded-xl border border-cyan/20 bg-cyan/[.04] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-ink">Edit instructions</p><button onClick={() => setEditOpen(false)} aria-label="Close edit instructions"><X className="h-4 w-4 text-ink-faint" /></button></div><textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={2} placeholder="Example: Add a tax column and a monthly chart" className="w-full resize-none rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-ink outline-none focus:border-cyan/50" /><button disabled={!editText.trim()} onClick={() => setEditText("")} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-panel px-3 py-2 text-[11px] font-semibold text-cyan disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />Regenerate from instruction</button><p className="mt-2 text-[10px] text-ink-faint">Editing is prepared in this foundation build; the next iteration will apply a minimal workbook patch.</p></div>}
      </div>
    </section>
  );
}
