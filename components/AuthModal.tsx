"use client";

import { useState } from "react";
import { X, Mail, Lock, Loader2 } from "lucide-react";
import { signIn, signUp } from "@/lib/auth";
import { Signal } from "./Signal";

export function AuthModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (isNewUser: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
        if (data.user) {
          onSuccess(true);
          onClose();
        }
      } else {
        const { data, error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
        if (data.user) {
          onSuccess(false);
          onClose();
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-panel p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Signal size="sm" />
            <span className="font-display text-base font-bold text-ink">
              NEXO<span className="text-cyan">AI</span>
            </span>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-5 font-display text-xl font-bold text-ink">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === "signup"
            ? "Save your chat history across devices."
            : "Sign in to continue where you left off."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-edge bg-void px-3 py-2.5">
            <Mail className="h-4 w-4 text-ink-faint" />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-edge bg-void px-3 py-2.5">
            <Lock className="h-4 w-4 text-ink-faint" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            className="font-semibold text-cyan hover:underline"
          >
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
