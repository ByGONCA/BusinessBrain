import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { CalendarView } from "@/components/dashboard/calendar/calendar-view";

export default async function CalendarPage() {
  const activeOrg = await getActiveOrganization();
  const integrations = activeOrg ? await getOrganizationIntegrations(activeOrg.id) : [];

  return <CalendarView integrations={integrations} />;
}
