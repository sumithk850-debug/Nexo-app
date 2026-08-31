"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { IntegrationsPanel as LegacyIntegrationsPanel } from "@/components/IntegrationsPanelLegacy";
import { WikipediaIntegrationPanel } from "@/components/WikipediaIntegrationPanel";

interface IntegrationsPanelProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  githubEnabled: boolean;
  onGithubEnabledChange: (enabled: boolean) => void;
}

/**
 * Compatibility wrapper: the original developer integrations remain in the
 * legacy implementation unchanged, while Wikipedia is added as a knowledge
 * provider (not an OAuth account connection).
 */
export function IntegrationsPanel(props: IntegrationsPanelProps) {
  const [wikipediaExpanded, setWikipediaExpanded] = useState(false);

  return (
    <>
      <LegacyIntegrationsPanel {...props} />

      {props.open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[116] flex justify-center px-4 sm:inset-x-auto sm:right-5 sm:justify-end sm:px-0">
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-edge bg-panel/95 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setWikipediaExpanded((value) => !value)}
              aria-expanded={wikipediaExpanded}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-void/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-edge bg-cyan/10 text-cyan">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-ink">Wikipedia</span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">Knowledge / Research · public source</span>
              </span>
              {wikipediaExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" /> : <ChevronUp className="h-4 w-4 shrink-0 text-ink-faint" />}
            </button>

            {wikipediaExpanded && (
              <div className="border-t border-edge p-3">
                <WikipediaIntegrationPanel />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
