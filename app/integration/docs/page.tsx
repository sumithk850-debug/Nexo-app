import type { Metadata } from "next";
import IntegrationPublicPage from "@/components/IntegrationPublicPage";

export const metadata: Metadata = {
  title: "Nexo Vercel Access Documentation",
  description: "Documentation for the private Nexo Vercel Access integration.",
};

export default function IntegrationDocumentationPage() {
  return (
    <IntegrationPublicPage
      eyebrow="Nexo Vercel Access"
      title="Integration documentation"
      summary="A private connection that lets an authorized Nexo user review project and deployment information from the account or team they choose."
    >
      <h2>What this integration does</h2>
      <p>
        Nexo Vercel Access connects an installation selected by the user to the Nexo workspace. It is intended for viewing
        project and deployment information, including status and basic metadata, after the account owner has authorized the connection.
      </p>

      <h2>Connection and authorization</h2>
      <ol>
        <li>Open the Integrations area in Nexo and choose to connect the deployment workspace.</li>
        <li>Review the requested permissions and select the Vercel account or team to authorize.</li>
        <li>Return to Nexo, where the connection is shown only after the authorization is validated.</li>
      </ol>
      <p>
        The connection is limited to the account or team selected during installation. A user can disconnect it from Nexo at any time.
      </p>

      <h2>Permissions and safeguards</h2>
      <p>
        The initial integration configuration requests only read access to the current user, teams, projects, and deployments.
        It does not request access to billing, domains, environment variables, global configuration, log drains, or deployment-protection bypasses.
      </p>
      <p>
        If a future feature needs a write operation, Nexo presents the requested action for explicit approval before it is sent.
        Nexo does not perform a write solely because a connection exists.
      </p>

      <h2>Data shown in Nexo</h2>
      <p>
        Nexo may display the connected account identity, team names, project names, deployment status, target environment,
        deployment URLs, and timestamps returned for the authorized installation. Displayed information is limited to what is needed for the requested workspace task.
      </p>

      <h2>Connection issues</h2>
      <p>
        If no projects are visible, first confirm that the correct account or team was selected during installation and that the installation remains active.
        Reconnect the integration if access was revoked or the selected account changes.
      </p>
    </IntegrationPublicPage>
  );
}
