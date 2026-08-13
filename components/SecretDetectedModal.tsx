"use client";

import { KeyRound, Loader2, ShieldCheck, X } from "lucide-react";

export function SecretDetectedModal({
  open,
  saving,
  error,
  signedIn,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  signedIn: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Secret detected">
      <section className="w-full max-w-sm rounded-2xl border border-cyan/25 bg-panel p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
            <KeyRound className="h-5 w-5" />
          </div>
          <button onClick={onCancel} disabled={saving} className="rounded-lg p-1 text-ink-faint transition hover:bg-void hover:text-ink disabled:opacity-50" aria-label="Close secret dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-lg font-bold text-ink">Secret detected</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          A GitHub Personal Access Token was pasted into chat. It was blocked before it could be sent to NEXO, saved in chat history, or shown to the AI model.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-edge bg-void/60 p-3 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
          <span>Save it as an encrypted GitHub Integration secret instead? NEXO can then use it for repository reads and approval-based commits, without ever displaying the token.</span>
        </div>
        {!signedIn && <p className="mt-3 text-xs text-amber-300">Sign in to your NEXO account before saving a GitHub secret.</p>}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-void hover:text-ink disabled:opacity-50">
            Remove secret
          </button>
          <button onClick={onConfirm} disabled={!signedIn || saving} className="flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-dim disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Save securely
          </button>
        </div>
      </section>
    </div>
  );
}
