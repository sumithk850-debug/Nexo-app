"use client";

import { useState } from "react";
import { X, Mail, Lock, Loader2, User, Cake, ArrowLeft, ShieldAlert } from "lucide-react";
import { signIn, signUp } from "@/lib/auth";
import { Signal } from "./Signal";

type Mode = "login" | "signup";
type SignupStep = "credentials" | "profile" | "confirm";

export function AuthModal({
  open,
  onClose,
  onSuccess,
  mandatory = false,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (isNewUser: boolean) => void;
  mandatory?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [step, setStep] = useState<SignupStep>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function resetAll() {
    setMode("signup");
    setStep("credentials");
    setEmail("");
    setPassword("");
    setFullName("");
    setBirthday("");
    setError("");
  }

  function handleClose() {
    if (mandatory) return;
    resetAll();
    onClose();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    if (data.user) {
      onSuccess(false);
      handleClose();
    }
  }

  function handleCredentialsNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setStep("profile");
  }

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!birthday) {
      setError("Please enter your birthday.");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setError("");
    setLoading(true);
    const { data, error: signUpError } = await signUp({
      email,
      password,
      fullName: fullName.trim(),
      birthday,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.user) {
      onSuccess(true);
      handleClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-panel p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "signup" && step !== "credentials" && (
              <button
                onClick={() => setStep(step === "confirm" ? "profile" : "credentials")}
                className="text-ink-faint hover:text-ink"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Signal size="sm" />
            <span className="font-display text-base font-bold text-ink">
              NEXO<span className="text-cyan">AI</span>
            </span>
          </div>
          {!mandatory && (
            <button onClick={handleClose} className="text-ink-faint hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {mode === "login" ? (
          <>
            <h2 className="mt-5 font-display text-xl font-bold text-ink">Welcome back</h2>
            <p className="mt-1 text-sm text-ink-muted">Sign in to continue where you left off.</p>

            <form onSubmit={handleLogin} className="mt-5 space-y-3">
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
                Sign in
              </button>
            </form>
          </>
        ) : (
          <>
            {step === "credentials" && (
              <>
                <h2 className="mt-5 font-display text-xl font-bold text-ink">Create your account</h2>
                <p className="mt-1 text-sm text-ink-muted">Step 1 of 3 — your login details</p>

                <div className="mt-3 flex items-start gap-2 rounded-lg border border-cyan/30 bg-cyan/10 p-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                  <p className="text-xs text-ink-muted">
                    Please create a <span className="font-semibold text-ink">new password just for NEXO AI</span> — don&apos;t reuse your email account password.
                  </p>
                </div>

                <form onSubmit={handleCredentialsNext} className="mt-4 space-y-3">
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
                      placeholder="Create a NEXO password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <button
                    type="submit"
                    className="w-full rounded-full bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim"
                  >
                    Continue
                  </button>
                </form>
              </>
            )}

            {step === "profile" && (
              <>
                <h2 className="mt-5 font-display text-xl font-bold text-ink">Tell us about you</h2>
                <p className="mt-1 text-sm text-ink-muted">Step 2 of 3 — your name and birthday</p>

                <form onSubmit={handleProfileNext} className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-edge bg-void px-3 py-2.5">
                    <User className="h-4 w-4 text-ink-faint" />
                    <input
                      type="text"
                      required
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-edge bg-void px-3 py-2.5">
                    <Cake className="h-4 w-4 text-ink-faint" />
                    <input
                      type="date"
                      required
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full bg-transparent text-sm text-ink focus:outline-none"
                    />
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <button
                    type="submit"
                    className="w-full rounded-full bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim"
                  >
                    Continue
                  </button>
                </form>
              </>
            )}

            {step === "confirm" && (
              <>
                <h2 className="mt-5 font-display text-xl font-bold text-ink">Confirm your details</h2>
                <p className="mt-1 text-sm text-ink-muted">Step 3 of 3 — review before creating your account</p>

                <div className="mt-4 space-y-2 rounded-lg border border-edge bg-void p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Email</span>
                    <span className="font-medium text-ink">{email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Name</span>
                    <span className="font-medium text-ink">{fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Birthday</span>
                    <span className="font-medium text-ink">{birthday}</span>
                  </div>
                </div>

                {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cyan py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-dim disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </button>
              </>
            )}
          </>
        )}

        <p className="mt-4 text-center text-xs text-ink-muted">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              resetAll();
              setMode(mode === "signup" ? "login" : "signup");
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
