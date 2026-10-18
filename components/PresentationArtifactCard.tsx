"use client";

import { useState } from "react";
import { Download, Presentation, ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { PresentationDescriptor } from "@/lib/presentationTypes";

export function PresentationArtifactCard({ artifact }: { artifact: PresentationDescriptor }) {
  const [active, setActive] = useState(0);
  const slide = artifact.slides[active];

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
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-violet-400/25 bg-panel shadow-[0_18px_50px_rgba(0,0,0,0.16)]" aria-label={`${artifact.title} presentation artifact`}>
      <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-4">
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Presentation className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-500">Presentation</p><h3 className="truncate font-display text-base font-bold text-ink">{artifact.title}</h3></div></div>
        <span className="flex-none rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-500">Ready</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-edge bg-[#0B1020] p-5" style={{ borderTopColor: `#${slide?.accent ?? "06B6D4"}` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: `#${slide?.accent ?? "06B6D4"}` }}>KYVORIX</p><h4 className="mt-5 max-w-[90%] font-display text-xl font-bold leading-tight text-slate-50 md:text-2xl">{slide?.title}</h4><ul className="mt-4 space-y-1.5">{slide?.body.slice(0, 3).map((line) => <li key={line} className="flex items-start gap-2 text-[10px] text-slate-300"><span className="mt-1 h-1 w-1 flex-none rounded-full bg-cyan-300" />{line}</li>)}</ul><span className="absolute bottom-3 right-4 text-[10px] text-slate-500">{active + 1} / {artifact.slides.length}</span>
            <div className="absolute right-6 top-8 h-20 w-20 rounded-full border-2 opacity-40" style={{ borderColor: `#${slide?.accent ?? "06B6D4"}` }} />
          </div>
          <div className="flex gap-2 overflow-x-auto md:block md:space-y-2 md:overflow-visible">{artifact.slides.map((item, index) => <button key={item.id} onClick={() => setActive(index)} className={`flex h-16 min-w-[92px] flex-col justify-between rounded-lg border p-2 text-left transition md:h-[50px] md:w-full ${index === active ? "border-cyan bg-cyan/10" : "border-edge bg-void/30 hover:border-cyan/40"}`}><span className="line-clamp-2 text-[10px] font-semibold text-ink">{item.title}</span><span className="text-[9px] text-ink-faint">Slide {index + 1}</span></button>)}</div>
        </div>
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1"><button onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0} className="rounded-lg border border-edge p-2 text-ink-muted disabled:opacity-30" aria-label="Previous slide"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setActive((value) => Math.min(artifact.slides.length - 1, value + 1))} disabled={active === artifact.slides.length - 1} className="rounded-lg border border-edge p-2 text-ink-muted disabled:opacity-30" aria-label="Next slide"><ChevronRight className="h-4 w-4" /></button></div><button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-bold text-white transition hover:brightness-105 active:scale-[.98]"><Download className="h-3.5 w-3.5" />Download .pptx</button></div>
        <div className="grid gap-2 sm:grid-cols-2">{artifact.highlights.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-void/45 px-3 py-2 text-xs text-ink-muted"><Check className="h-3.5 w-3.5 text-violet-500" />{item}</div>)}</div>
      </div>
    </section>
  );
}
