"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Cpu, Zap, Rocket, LockIcon, Check, Crown, X } from "lucide-react";
import { CODER_MODELS, type CoderModelId } from "@/lib/providers.server";

interface CoderModelSelectorProps {
  selected: CoderModelId;
  onSelect: (id: CoderModelId) => void;
}

// Coder sub-model selector — only renders inside Nexo Coder Agent mode.
// Craft V3 Lite runs on the same free Craft routes with a deeper prompt.
// Craft V3 and Craft V4 are visually locked (paid tiers).
export function CoderModelSelector({ selected, onSelect }: CoderModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [upgradeModel, setUpgradeModel] = useState<(typeof CODER_MODELS)[number] | null>(null);
  const [upgradeInterestShown, setUpgradeInterestShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!upgradeModel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUpgradeModel(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [upgradeModel]);

  const activeInfo = CODER_MODELS.find((m) => m.id === selected) ?? CODER_MODELS[0];
  const ActiveIcon = activeInfo.id === "craft-v3-lite" ? Zap : LockIcon;
  const upgradeBenefits = upgradeModel?.id === "craft-v4"
    ? [
        "Next-generation architecture planning",
        "Complex multi-file task orchestration",
        "Extended project context for larger builds",
        "Priority access for advanced coding runs",
      ]
    : [
        "Deeper repository and code reasoning",
        "Larger task and code context",
        "Priority coding runs for demanding projects",
        "Advanced change planning before edits",
      ];

  function closeUpgradePopup() {
    setUpgradeModel(null);
    setUpgradeInterestShown(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-edge bg-panel/60 pl-2.5 pr-1.5 text-xs font-semibold text-ink transition hover:border-cyan/50 hover:bg-panel"
        aria-label="Coder model selector"
        title="Nexo Coder engine"
      >
        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded bg-cyan/15 p-0.5">
          <Cpu className="h-3.5 w-3.5 text-cyan" />
        </span>
        <span className="max-w-20 truncate text-ink">{activeInfo.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide ${
            activeInfo.badge === "LITE" ? "bg-cyan/15 text-cyan" : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {activeInfo.badge}
        </span>
        <svg
          className={`h-3 w-3 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-edge bg-panel shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-fade-up">
          <div className="border-b border-edge/50 px-3.5 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-ink-muted">
              Coding Engine
            </p>
          </div>
          <div className="p-1.5">
            {CODER_MODELS.map((m) => {
              const isActive = m.id === selected;
              const Icon =
                m.id === "craft-v3-lite" ? Zap : m.id === "craft-v3" ? Rocket : Rocket;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.locked) {
                      setOpen(false);
                      setUpgradeInterestShown(false);
                      setUpgradeModel(m);
                      return;
                    }
                    onSelect(m.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    m.locked
                      ? "cursor-not-allowed opacity-70 hover:bg-ink/5"
                      : isActive
                        ? "bg-cyan/10"
                        : "hover:bg-ink/5"
                  }`}
                  aria-label={m.name}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      m.locked ? "bg-ink/5" : "bg-cyan/15"
                    }`}
                  >
                    {m.locked ? (
                      <Lock className="h-3.5 w-3.5 text-ink-muted" />
                    ) : (
                      <Icon className="h-4 w-4 text-cyan" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-ink">{m.name}</span>
                      <span
                        className={`rounded px-1.5 py-px text-[9px] font-black tracking-wide ${
                          m.badge === "LITE" ? "bg-cyan/15 text-cyan" : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {m.badge}
                      </span>
                      {isActive && !m.locked && (
                        <span className="text-[9px] font-black text-cyan">ACTIVE</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                      {m.id === "craft-v3-lite"
                        ? "Deep-engine prompt · Free tier"
                        : m.id === "craft-v3"
                          ? "Elite 550B engine · Paid upgrade"
                          : "Next-gen architecture engine · Paid upgrade"}
                    </span>
                  </span>
                  {m.locked ? (
                    <span className="shrink-0 text-[10px] font-semibold text-amber-400/80">
                      Upgrade
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-edge/50 px-3.5 py-2.5 text-center">
            <p className="text-[10px] font-medium text-ink-muted">
              Craft V3 & V4 are locked — unlock them with a{" "}
              <span className="font-bold text-cyan">Pro</span> upgrade.
            </p>
          </div>
        </div>
      )}

      {upgradeModel && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUpgradePopup();
          }}
        >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="nexo-pro-upgrade-title"
              aria-describedby="nexo-pro-upgrade-description"
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-cyan/25 bg-panel text-ink shadow-[0_24px_70px_rgba(0,0,0,0.65)] animate-fade-up"
            >
              <div className="flex items-start justify-between border-b border-edge/70 px-5 pb-4 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
                  <Crown className="h-5 w-5 text-amber-500 dark:text-amber-300" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan">Unlock Nexo Pro</p>
                  <h2 id="nexo-pro-upgrade-title" className="mt-0.5 text-base font-bold text-ink">
                    Unlock {upgradeModel.name}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUpgradePopup}
                className="rounded-lg p-1.5 text-ink-muted transition hover:bg-ink/5 hover:text-ink"
                aria-label="Close upgrade popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p id="nexo-pro-upgrade-description" className="text-sm leading-6 text-ink">
                {upgradeModel.id === "craft-v4"
                  ? "A next-generation coding engine for planning and coordinating larger software builds."
                  : "Elite coding intelligence for deeper repository work and demanding engineering tasks."}
              </p>

              <div className="rounded-xl border border-edge/80 bg-edge/30 px-3.5 py-3">
                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-ink-muted">Included with Pro</p>
                <ul className="space-y-2">
                  {upgradeBenefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-xs leading-5 text-ink">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-edge/70 bg-edge/20 px-3.5 py-3 text-xs">
                <div>
                  <p className="font-semibold text-ink">Current engine</p>
                  <p className="mt-0.5 text-ink-muted">Craft V3 Lite · Free</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-600 dark:text-amber-300">Required plan</p>
                  <p className="mt-0.5 text-ink-muted">Nexo Pro</p>
                </div>
              </div>

              {upgradeInterestShown && (
                <p className="rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-2 text-center text-xs leading-5 text-cyan" role="status">
                  Nexo Pro upgrades will be available here soon. Craft V3 Lite remains active for your current work.
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-edge/70 bg-black/10 px-5 py-4">
              <button
                type="button"
                onClick={closeUpgradePopup}
                className="flex-1 rounded-xl border border-edge bg-panel px-3 py-2.5 text-xs font-bold text-ink transition hover:border-cyan/35 hover:text-cyan"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => setUpgradeInterestShown(true)}
                className="flex-1 rounded-xl bg-cyan px-3 py-2.5 text-xs font-black text-black transition hover:bg-cyan/90"
              >
                Explore Nexo Pro
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
