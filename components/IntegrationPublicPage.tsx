import Link from "next/link";
import type { ReactNode } from "react";

type IntegrationPublicPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export default function IntegrationPublicPage({
  eyebrow,
  title,
  summary,
  children,
}: IntegrationPublicPageProps) {
  return (
    <main className="min-h-screen bg-[rgb(var(--color-void))] text-[rgb(var(--color-ink))]">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-backdrop opacity-30" />
      <div className="mx-auto flex w-full max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-[rgb(var(--color-edge))] pb-6">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-[0.24em] text-[rgb(var(--color-cyan))]"
            aria-label="Go to Nexo"
          >
            NEXO
          </Link>
          <span className="rounded-full border border-[rgb(var(--color-edge))] bg-[rgb(var(--color-panel))] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--color-ink-muted))]">
            Public information
          </span>
        </header>

        <section className="mt-12 rounded-3xl border border-[rgb(var(--color-edge))] bg-[rgb(var(--color-panel))] p-6 shadow-[0_24px_90px_rgb(var(--color-void)/0.22)] sm:p-10">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--color-cyan))]">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[rgb(var(--color-ink-muted))] sm:text-lg">
            {summary}
          </p>
          <div className="prose-nexo mt-10 max-w-none text-[rgb(var(--color-ink-muted))]">{children}</div>
        </section>

        <footer className="mt-6 flex flex-col gap-3 border-t border-[rgb(var(--color-edge))] pt-6 font-mono text-xs text-[rgb(var(--color-ink-muted))] sm:flex-row sm:items-center sm:justify-between">
          <span>Last updated: August 20, 2026</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Public information navigation">
            <Link href="/integration/docs">Documentation</Link>
            <Link href="/integration/terms">Terms</Link>
            <Link href="/integration/privacy">Privacy</Link>
            <Link href="/integration/support">Support</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
