import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { CompanyTimeline } from "@/components/dashboard/timeline/company-timeline";
import { PhosphorClock } from "@/components/icons";

export default async function TimelinePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  const events = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <PhosphorClock className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold tracking-tight text-white">Company Timeline</h1>
          {activeOrg && (
            <span className="text-xs text-zinc-300 font-medium ml-1">
              {activeOrg.name}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          The continuous chronological memory of company decisions, milestones, projects, and activities.
        </p>
      </div>

      {activeOrg && (
        <CompanyTimeline
          events={events}
          organizationName={activeOrg.name}
        />
      )}
    </div>
  );
}
