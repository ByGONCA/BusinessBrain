import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { EmailView } from "@/components/dashboard/email/email-view";

export default async function EmailPage() {
  const activeOrg = await getActiveOrganization();
  const integrations = activeOrg ? await getOrganizationIntegrations(activeOrg.id) : [];

  return <EmailView integrations={integrations} />;
}
