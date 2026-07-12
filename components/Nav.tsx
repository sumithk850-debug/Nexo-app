import Link from "next/link";
import { Signal } from "./Signal";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-edge/60 bg-void/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Signal size="sm" />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            NEXO<span className="text-cyan">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#models" className="text-sm text-ink-muted transition hover:text-ink">
            Models
          </Link>
          <Link href="/pricing" className="text-sm text-ink-muted transition hover:text-ink">
            Pricing
          </Link>
          <Link href="/#faq" className="text-sm text-ink-muted transition hover:text-ink">
            FAQ
          </Link>
        </nav>

        <Link
          href="/chat"
          className="rounded-full bg-cyan px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-dim"
        >
          Try NEXO free
        </Link>
      </div>
    </header>
  );
}
