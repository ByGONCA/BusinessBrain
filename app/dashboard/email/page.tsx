import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { getEmailMessagesAction } from "@/lib/integrations/actions";
import { EmailView } from "@/components/dashboard/email/email-view";

export default async function EmailPage() {
  const activeOrg = await getActiveOrganization();
  const integrations = activeOrg ? await getOrganizationIntegrations(activeOrg.id) : [];
  const initialResult = activeOrg ? await getEmailMessagesAction() : { messages: [], isLive: false };

  return (
    <EmailView
      integrations={integrations}
      initialMessages={initialResult.messages}
      initialNextPageToken={initialResult.nextPageToken}
      isLiveConnected={initialResult.isLive}
    />
  );
}
