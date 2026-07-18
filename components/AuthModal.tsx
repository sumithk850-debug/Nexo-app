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
    if (data.session) {
      onSuccess(true);
      handleClose();
      return;
    }
    if (data.user) {
      setError(
        "Account created! Please check your email to confirm your address, then sign in.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void px-4 overflow-hidden">
      {/* Animated Background Bubbles */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-cyan/10 blur-[120px] animate-drift"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[120px] animate-drift [animation-delay:4s]"></div>
        <div className="absolute top-[20%] right-[10%] h-[30%] w-[30%] rounded-full bg-cyan/5 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[20%] left-[10%] h-[30%] w-[30%] rounded-full bg-indigo-500/5 blur-[100px] animate-pulse [animation-delay:2s]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-edge bg-panel/80 p-8 shadow-2xl backdrop-blur-xl animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {mode === "signup" && step !== "credentials" && (
              <button
                onClick={() => setStep(step === "confirm" ? "profile" : "credentials")}
                className="text-ink-faint hover:text-ink transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Signal size="sm" />
            <span className="font-display text-lg font-black tracking-tight text-ink">
              NEXO<span className="text-cyan">AI</span>
            </span>
          </div>
          {!mandatory && (
            <button onClick={handleClose} className="text-ink-faint hover:text-ink transition-colors" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {mode === "login" ? (
          <>
            <h2 className="mt-6 font-display text-2xl font-black text-ink tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm font-medium text-ink-muted leading-relaxed">Sign in to continue your journey with NEXO.</p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50 focus-within:ring-1 focus-within:ring-cyan/50">
                <Mail className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
              <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50 focus-within:ring-1 focus-within:ring-cyan/50">
                <Lock className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>

              {error && <p className="text-xs font-bold text-red-500 animate-pulse">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan py-3.5 text-sm font-black uppercase tracking-widest text-void transition-all hover:bg-cyan-dim hover:shadow-lg hover:shadow-cyan/20 active:scale-95 disabled:opacity-60"
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
                <h2 className="mt-6 font-display text-2xl font-black text-ink tracking-tight">Create account</h2>
                <p className="mt-1.5 text-sm font-medium text-ink-muted leading-relaxed">Phase 1 — Setup your secure credentials</p>

                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan/20 bg-cyan/5 p-4">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan" />
                  <p className="text-[11px] font-medium leading-relaxed text-ink-muted">
                    Security protocol: Use a <span className="font-bold text-ink underline decoration-cyan/30">unique password</span> for NEXO AI. Do not reuse your email password.
                  </p>
                </div>

                <form onSubmit={handleCredentialsNext} className="mt-5 space-y-4">
                  <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50">
                    <Mail className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                    <input
                      type="email"
                      required
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>
                  <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50">
                    <Lock className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>

                  {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                  <button
                    type="submit"
                    className="w-full rounded-full bg-cyan py-3.5 text-sm font-black uppercase tracking-widest text-void transition-all hover:bg-cyan-dim hover:shadow-lg active:scale-95"
                  >
                    Continue
                  </button>
                </form>
              </>
            )}

            {step === "profile" && (
              <>
                <h2 className="mt-6 font-display text-2xl font-black text-ink tracking-tight">Tell us more</h2>
                <p className="mt-1.5 text-sm font-medium text-ink-muted leading-relaxed">Phase 2 — Personalize your experience</p>

                <form onSubmit={handleProfileNext} className="mt-5 space-y-4">
                  <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50">
                    <User className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>
                  <div className="group flex items-center gap-3 rounded-2xl border border-edge bg-void/50 px-4 py-3.5 transition-all focus-within:border-cyan/50">
                    <Cake className="h-4 w-4 text-ink-faint group-focus-within:text-cyan transition-colors" />
                    <input
                      type="date"
                      required
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
                    />
                  </div>

                  {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                  <button
                    type="submit"
                    className="w-full rounded-full bg-cyan py-3.5 text-sm font-black uppercase tracking-widest text-void transition-all hover:bg-cyan-dim hover:shadow-lg active:scale-95"
                  >
                    Continue
                  </button>
                </form>
              </>
            )}

            {step === "confirm" && (
              <>
                <h2 className="mt-6 font-display text-2xl font-black text-ink tracking-tight">Review details</h2>
                <p className="mt-1.5 text-sm font-medium text-ink-muted leading-relaxed">Phase 3 — Confirm before initialization</p>

                <div className="mt-5 space-y-3 rounded-2xl border border-edge bg-void/50 p-5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Email</span>
                    <span className="font-bold text-ink">{email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Identity</span>
                    <span className="font-bold text-ink">{fullName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Origin</span>
                    <span className="font-bold text-ink">{birthday}</span>
                  </div>
                </div>

                {error && <p className="mt-4 text-xs font-bold text-red-500 animate-pulse">{error}</p>}

                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cyan py-3.5 text-sm font-black uppercase tracking-widest text-void transition-all hover:bg-cyan-dim hover:shadow-lg active:scale-95 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </button>
              </>
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs font-bold text-ink-muted">
          {mode === "signup" ? "Already a member?" : "New to the nexus?"}{" "}
          <button
            onClick={() => {
              resetAll();
              setMode(mode === "signup" ? "login" : "signup");
            }}
            className="text-cyan hover:underline decoration-cyan/30 underline-offset-4"
          >
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
