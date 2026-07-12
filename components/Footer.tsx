import Link from "next/link";
import { Signal } from "./Signal";

export function Footer() {
  return (
    <footer className="border-t border-edge bg-void py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <Signal size="sm" />
          <span className="font-display text-base font-bold text-ink">
            NEXO<span className="text-cyan">AI</span>
          </span>
        </div>
        <p className="text-xs text-ink-faint">
          Made in Sri Lanka 🇱🇰 · © {new Date().getFullYear()} NEXO AI
        </p>
        <div className="flex gap-6 text-xs text-ink-muted">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/chat" className="hover:text-ink">
            Chat
          </Link>
        </div>
      </div>
    </footer>
  );
}
