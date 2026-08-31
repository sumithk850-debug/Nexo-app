"use client";

import { IntegrationsPanel as LegacyIntegrationsPanel } from "@/components/IntegrationsPanelLegacy";
import { WikipediaIntegrationPanel } from "@/components/WikipediaIntegrationPanel";

interface IntegrationsPanelProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  githubEnabled: boolean;
  onGithubEnabledChange: (enabled: boolean) => void;
}

export function IntegrationsPanel(props: IntegrationsPanelProps) {
  return (
    <>
      <LegacyIntegrationsPanel {...props} />
      {props.open && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[115] w-[calc(100%-2rem)] max-w-sm sm:right-5 sm:w-[22rem]">
          <div className="pointer-events-auto max-h-[min(70vh,620px)] overflow-y-auto rounded-2xl border border-edge bg-panel/95 p-3 shadow-2xl backdrop-blur-xl">
            <WikipediaIntegrationPanel />
          </div>
        </div>
      )}
    </>
  );
}
