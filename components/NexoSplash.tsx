import { Signal } from "@/components/Signal";

export function NexoSplash() {
  return (
    <main
      className="nexo-splash relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-6"
      role="status"
      aria-label="Loading Nexo AI"
    >
      <div className="nexo-splash-grid absolute inset-0" aria-hidden="true" />
      <div className="nexo-splash-orb nexo-splash-orb-left absolute" aria-hidden="true" />
      <div className="nexo-splash-orb nexo-splash-orb-right absolute" aria-hidden="true" />

      <div className="nexo-splash-content relative z-10 flex flex-col items-center text-center">
        <div className="nexo-splash-mark flex items-center justify-center rounded-[2rem] border border-cyan/30 bg-panel/70 p-7 shadow-[0_0_80px_rgb(var(--color-cyan)/0.18)] backdrop-blur-xl">
          <Signal size="lg" className="scale-[1.8]" />
        </div>
        <div className="nexo-splash-wordmark relative mt-8 flex items-center justify-center">
          <span className="font-display text-4xl font-black tracking-[0.28em] text-ink">NEXO</span>
          <span className="absolute -right-5 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-cyan shadow-[0_0_18px_rgb(var(--color-cyan))]" aria-hidden="true" />
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.34em] text-ink-muted">
          Think beyond. Create faster.
        </p>
        <div className="mt-8 flex items-center gap-2" aria-hidden="true">
          <span className="nexo-splash-dot" />
          <span className="nexo-splash-dot nexo-splash-dot-delay-1" />
          <span className="nexo-splash-dot nexo-splash-dot-delay-2" />
        </div>
      </div>
    </main>
  );
}
