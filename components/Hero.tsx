import Link from "next/link";
import { Signal } from "./Signal";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-grid-fade">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-4 py-1.5 shadow-sm">
            <Signal size="sm" />
            <span className="font-mono text-xs tracking-wide text-cyan">
              176 WORDS / SEC · LIVE
            </span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink md:text-7xl">
            Think beyond.
            <br />
            <span className="bg-gradient-to-r from-cyan to-indigo bg-clip-text text-transparent">
              Create faster.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-muted">
            Five AI models, one signal. Sri Lanka&apos;s fastest AI platform —
            built for Sinhala, priced for everyone, powerful enough for
            anyone.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/chat"
              className="w-full rounded-full bg-cyan px-8 py-3.5 text-center font-semibold text-white shadow-sm transition hover:bg-cyan-dim sm:w-auto"
            >
              Start chatting — it&apos;s free
            </Link>
            <Link
              href="/pricing"
              className="w-full rounded-full border border-edge bg-panel px-8 py-3.5 text-center font-semibold text-ink transition hover:border-cyan/50 sm:w-auto"
            >
              See pricing
            </Link>
          </div>

          <p className="mt-5 text-xs text-ink-faint">
            No credit card required · 50 free messages daily
          </p>
        </div>

        {/* Live signal demo strip — the signature moment */}
        <div className="mx-auto mt-20 max-w-4xl rounded-2xl border border-edge bg-panel p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between border-b border-edge pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan" />
              <span className="font-mono text-xs text-ink-muted">
                nexo-galex-4.0 · streaming
              </span>
            </div>
            <Signal size="md" />
          </div>
          <div className="space-y-2 pt-4">
            <div className="h-2.5 w-[92%] animate-pulse rounded bg-edge" />
            <div className="h-2.5 w-[78%] animate-pulse rounded bg-edge/70" />
            <div className="h-2.5 w-[85%] animate-pulse rounded bg-edge/50" />
          </div>
        </div>
      </div>
    </section>
  );
}
