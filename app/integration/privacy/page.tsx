import type { Metadata } from "next";
import IntegrationPublicPage from "@/components/IntegrationPublicPage";

export const metadata: Metadata = {
  title: "Nexo Vercel Access Privacy Policy",
  description: "Privacy information for the private Nexo Vercel Access integration.",
};

export default function IntegrationPrivacyPage() {
  return (
    <IntegrationPublicPage
      eyebrow="Nexo Vercel Access"
      title="Privacy policy"
      summary="This policy explains the limited information Nexo handles when a user authorizes the Nexo Vercel Access integration."
    >
      <h2>Information processed</h2>
      <p>
        When you connect the integration, Nexo may process your account identity, selected account or team identifiers,
        project information, deployment information, and connection status returned for the installation. This can include names,
        identifiers, status, target environment, URLs, and timestamps.
      </p>

      <h2>Authorization credentials</h2>
      <p>
        Nexo retains the authorization information needed to keep the connection active only after a user authorizes the integration.
        Any stored authorization credential is protected in transit and at rest and is used only to provide the connected workspace capability.
      </p>

      <h2>Information not requested by this integration</h2>
      <p>
        The initial integration configuration does not request access to billing information, domain administration, environment variables,
        global configuration, log drains, deployment-protection bypasses, or other permissions outside the documented read-only scope.
      </p>

      <h2>How information is used</h2>
      <p>
        Nexo uses connected information to display the workspace results you request, maintain connection status, investigate connection issues,
        and protect the security and reliability of the integration. Nexo does not use a connected installation to initiate a write action without the user&apos;s explicit approval.
      </p>

      <h2>Retention and disconnection</h2>
      <p>
        Connection information is retained only for as long as needed to provide the active connection and related workspace records.
        When you disconnect the integration, Nexo stops using its authorization credential for new requests and removes or disables connection data according to the applicable service workflow.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests related to this integration, use the support contact shown in the Nexo Vercel Access installation listing.
      </p>
    </IntegrationPublicPage>
  );
}
