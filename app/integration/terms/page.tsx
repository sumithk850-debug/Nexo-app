import type { Metadata } from "next";
import IntegrationPublicPage from "@/components/IntegrationPublicPage";

export const metadata: Metadata = {
  title: "Nexo Vercel Access Terms",
  description: "Terms governing the private Nexo Vercel Access integration.",
};

export default function IntegrationTermsPage() {
  return (
    <IntegrationPublicPage
      eyebrow="Nexo Vercel Access"
      title="End-user terms"
      summary="These terms describe the limited authorization and safe-use expectations for the Nexo Vercel Access integration."
    >
      <h2>Acceptance and scope</h2>
      <p>
        By installing or using Nexo Vercel Access, you confirm that you are authorized to connect the selected account or team and agree to these terms.
        The integration is provided only for the project and deployment workflows available in Nexo.
      </p>

      <h2>Your authorization</h2>
      <p>
        You authorize Nexo to request and use only the permissions you approve during installation. You remain responsible for choosing the correct account or team,
        protecting your Nexo account, and removing the connection when it is no longer needed.
      </p>

      <h2>Approval before write actions</h2>
      <p>
        A connected integration does not grant Nexo blanket authority to change your resources. Where a Nexo feature supports a write operation,
        Nexo will present the proposed action for your explicit approval before sending it. You are responsible for reviewing the action details before approval.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You must not use the integration to access resources you are not permitted to manage, circumvent access controls, disrupt services, or violate applicable laws,
        contractual obligations, or third-party platform terms.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The integration may be updated, limited, suspended, or discontinued when needed for security, reliability, legal compliance, or product maintenance.
        These terms may be updated when the integration changes materially.
      </p>

      <h2>Support</h2>
      <p>
        For questions about this integration, use the support contact shown in the Nexo Vercel Access installation listing.
      </p>
    </IntegrationPublicPage>
  );
}
