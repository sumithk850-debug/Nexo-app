"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IntegrationsPanel as ExistingIntegrationsPanel } from "./IntegrationsPanel";
import { WikipediaIntegrationPanel } from "./WikipediaIntegrationPanel";

type ExistingProps = React.ComponentProps<typeof ExistingIntegrationsPanel>;

/**
 * Compatibility adapter for the existing integrations panel.
 *
 * The original GitHub/Vercel/Supabase panel remains untouched. This adapter
 * mounts the Wikipedia card into the panel's existing content area so the
 * feature can be added without rewriting the large production component.
 */
export function IntegrationsPanelWithWikipedia(props: ExistingProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) {
      setHost(null);
      return;
    }

    const content = document.querySelector<HTMLElement>(
      'section[aria-label="Integrations"] > div'
    );
    if (!content) return;

    const mount = document.createElement("div");
    mount.className = "rounded-2xl border border-edge bg-void/40 p-4";
    mount.setAttribute("data-nexo-wikipedia-integration", "true");
    content.appendChild(mount);
    setHost(mount);

    return () => {
      mount.remove();
      setHost(null);
    };
  }, [props.open]);

  return (
    <>
      <ExistingIntegrationsPanel {...props} />
      {host
        ? createPortal(
            <WikipediaIntegrationPanel />,
            host
          )
        : null}
    </>
  );
}
