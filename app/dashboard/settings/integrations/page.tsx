import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { isGoogleIntegrationConfigured } from "@/lib/integrations/google/config";
import { IntegrationsView } from "@/components/dashboard/settings/integrations-view";

interface IntegrationsPageProps {
  searchParams: Promise<{ status?: string; error?: string; open?: string }>;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const { status, error, open } = await searchParams;
  const activeOrg = await getActiveOrganization();
  const integrations = activeOrg ? await getOrganizationIntegrations(activeOrg.id) : [];
  const isConfigured = isGoogleIntegrationConfigured();

  return (
    <IntegrationsView
      integrations={integrations}
      isGoogleConfigured={isConfigured}
      statusParam={status}
      errorParam={error}
      initialOpenId={open}
    />
  );
}
