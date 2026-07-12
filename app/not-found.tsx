import Link from "next/link";
import { Signal } from "@/components/Signal";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void px-6 text-center">
      <Signal size="lg" />
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">
        Signal lost
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        This page doesn&apos;t exist. Let&apos;s get you back on the grid.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-cyan px-6 py-2.5 text-sm font-semibold text-void transition hover:bg-cyan-glow"
      >
        Back to NEXO
      </Link>
    </main>
  );
}
