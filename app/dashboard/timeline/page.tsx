import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { CompanyTimeline } from "@/components/dashboard/timeline/company-timeline";
import { TimelineHeader } from "@/components/dashboard/timeline/timeline-header";

export default async function TimelinePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  const events = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];

  return (
    <div className="space-y-4 max-w-7xl">
      <TimelineHeader />

      {activeOrg && (
        <CompanyTimeline
          events={events}
          organizationName={activeOrg.name}
        />
      )}
    </div>
  );
}
