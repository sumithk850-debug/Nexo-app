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

      <div className="nexo-splash-content relative z-10 flex w-full max-w-sm flex-col items-center text-center sm:max-w-md">
        <div className="nexo-splash-mark flex h-28 w-28 items-center justify-center rounded-[1.75rem] border border-cyan/30 bg-panel/70 p-3 shadow-[0_0_80px_rgb(var(--color-cyan)/0.18)] backdrop-blur-xl sm:h-32 sm:w-32 sm:rounded-[2rem]">
          <Signal size="lg" className="h-full w-full" />
        </div>
        <div className="nexo-splash-wordmark relative mt-7 flex items-center justify-center sm:mt-8">
          <span className="font-display text-3xl font-black tracking-[0.22em] text-ink sm:text-4xl sm:tracking-[0.28em]">NEXO</span>
          <span className="absolute -right-4 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-cyan shadow-[0_0_18px_rgb(var(--color-cyan))] sm:-right-5" aria-hidden="true" />
        </div>
        <p className="mt-3 px-2 font-mono text-[9px] uppercase tracking-[0.24em] text-ink-muted sm:text-[10px] sm:tracking-[0.34em]">
          Think beyond. Create faster.
        </p>
      </div>
    </main>
  );
}
