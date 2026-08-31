"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IntegrationsPanel as ExistingIntegrationsPanel } from "./IntegrationsPanel";
import { WikipediaIntegrationPanel } from "./WikipediaIntegrationPanel";

type ExistingProps = React.ComponentProps<typeof ExistingIntegrationsPanel>;

export function IntegrationsPanel(props: ExistingProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) {
      setHost(null);
      return;
    }

    const content = document.querySelector<HTMLElement>('section[aria-label="Integrations"] > div');
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
      {host ? createPortal(<WikipediaIntegrationPanel userId={props.userId} />, host) : null}
    </>
  );
}
