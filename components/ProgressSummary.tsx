"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Clock3, Loader2, X, XCircle } from "lucide-react";

import {
  PROGRESS_UI_TEXT,
  formatStepDuration,
  summarizeProgress,
  type MessageProgress,
  type ProgressStep,
} from "@/lib/progressSteps";

const SHEET_EXIT_MS = 180;

function StepDot({ step, streaming }: { step: ProgressStep; streaming: boolean }) {
  // A step that is still "running" after the reply stopped streaming was cut short.
  const running = step.status === "running" && streaming;
  const stopped = step.status === "running" && !streaming;
  if (step.status === "failed") return <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />;
  if (running) return <span className="mt-[7px] h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-cyan shadow-[0_0_10px_rgba(0,229,255,0.55)]" aria-hidden="true" />;
  if (stopped) return <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full border border-ink-faint bg-transparent" aria-hidden="true" />;
  return <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-ink-faint/80" aria-hidden="true" />;
}

function StateIcon({ state }: { state: "running" | "done" | "failed" | "stopped" }) {
  if (state === "running") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan" aria-hidden="true" />;
  if (state === "failed") return <XCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />;
  if (state === "stopped") return <Clock3 className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />;
  return <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />;
}

export function ProgressSummary({ progress, streaming }: { progress: MessageProgress; streaming: boolean }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ui = PROGRESS_UI_TEXT[progress.lang];
  const summary = summarizeProgress(progress, streaming);
  const stepCount = progress.steps.length;

  const close = useCallback(() => {
    setEntered(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, SHEET_EXIT_MS);
  }, []);

  // Slide the sheet in after it mounts, and lock page scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      closeRef.current?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Keep the newest step in view while work is still happening.
  useEffect(() => {
    if (!open || !streaming) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, streaming, stepCount]);

  if (stepCount === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ui.open}: ${summary.label}`}
        className="group/progress mb-2 flex max-w-full items-center gap-2 rounded-lg py-1 text-left text-[13px] text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
      >
        <StateIcon state={summary.state} />
        <span className="min-w-0 truncate" aria-live="polite">{summary.label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover/progress:translate-x-0.5" aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center">
            <div
              className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${entered ? "opacity-100" : "opacity-0"}`}
              onClick={close}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`relative flex max-h-[78vh] w-full max-w-lg flex-col rounded-t-[1.75rem] border border-b-0 border-edge bg-panel shadow-[0_-18px_60px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out motion-reduce:transition-none ${entered ? "translate-y-0" : "translate-y-full"}`}
            >
              <div className="mx-auto mt-2.5 h-1 w-11 shrink-0 rounded-full bg-edge" aria-hidden="true" />
              <div className="relative flex shrink-0 items-center justify-center px-5 pb-3 pt-3">
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label={ui.close}
                  className="absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-void/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
                <h2 id={titleId} className="text-base font-semibold text-ink">{ui.title}</h2>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
                <ol className="m-0 list-none p-0">
                  {progress.steps.map((step, index) => {
                    const isLast = index === progress.steps.length - 1;
                    const duration = formatStepDuration(step);
                    return (
                      <li key={step.id} className="relative flex gap-4 pb-6 last:pb-1">
                        {!isLast && <span className="absolute left-[4.5px] top-5 h-[calc(100%-0.75rem)] w-px bg-edge" aria-hidden="true" />}
                        <StepDot step={step} streaming={streaming} />
                        <div className="min-w-0 flex-1">
                          <p className={`break-words text-[17px] leading-snug ${step.status === "failed" ? "text-rose-200" : "text-ink"}`}>{step.label}</p>
                          {(step.detail || duration) && (
                            <p className="mt-1 break-words text-xs text-ink-faint">
                              {[step.detail, duration].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
