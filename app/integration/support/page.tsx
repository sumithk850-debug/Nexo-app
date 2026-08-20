import type { Metadata } from "next";
import IntegrationPublicPage from "@/components/IntegrationPublicPage";

export const metadata: Metadata = {
  title: "Nexo Vercel Access Support",
  description: "Support information for the private Nexo Vercel Access integration.",
};

export default function IntegrationSupportPage() {
  return (
    <IntegrationPublicPage
      eyebrow="Nexo Vercel Access"
      title="Integration support"
      summary="Use the support contact listed in the Nexo Vercel Access installation to get help with an authorized connection."
    >
      <h2>Before contacting support</h2>
      <p>
        Confirm that the intended account or team was selected during installation, the installation remains active,
        and Nexo shows the connection as active. If the selected account changed or access was revoked, reconnect the integration from Nexo.
      </p>

      <h2>What to include</h2>
      <p>
        To help investigate a connection issue, include the approximate time of the issue, the affected account or team name,
        the project name if relevant, and a description or screenshot of the visible error. Do not send passwords, personal access tokens,
        environment-variable values, or other secrets.
      </p>

      <h2>Security reports</h2>
      <p>
        If you believe the integration connection has been accessed without your authorization, disconnect it from Nexo immediately and report the issue through the support contact listed on the integration.
      </p>
    </IntegrationPublicPage>
  );
}
