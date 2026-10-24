import { getActiveOrganization } from "@/lib/organizations/queries";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { createClient } from "@/lib/supabase/server";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
} from "@/lib/integrations/stripe/analytics";
import { getUserOnboardingState } from "@/lib/onboarding/queries";
import { getCompanyGraphData } from "@/lib/connections/queries";
import { CompanyGraphData } from "@/lib/connections/types";
import {
  ExecutiveHomeDashboard,
  DecisionItem,
  ProjectItem,
  PageItem,
} from "@/components/dashboard/home/executive-home-dashboard";

export default async function DashboardOverviewPage() {
  const activeOrg = await getActiveOrganization();
  const timelineEvents = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];
  const onboardingState = await getUserOnboardingState();

  let decisionsCount = 0;
  let projectsCount = 0;
  let pagesCount = 0;
  let membersCount = 1;
  let recentPages: PageItem[] = [];
  let recentDecisions: DecisionItem[] = [];
  let recentProjects: ProjectItem[] = [];
  let graphData: CompanyGraphData = { nodes: [], edges: [], totalConnections: 0 };
  let stripeSnapshot: StripeFinancialSnapshot | null = null;
  let stripeStatus: MetricFreshnessStatus = "fresh";
  let isStripeConnected = false;
  let stripeAccountId: string | undefined;

  if (activeOrg) {
    const supabase = await createClient();

    const [
      decCountRes,
      decListRes,
      projCountRes,
      projListRes,
      pageCountRes,
      memberRes,
      recentPagesRes,
      stripeIntRes,
      companyGraph,
    ] = await Promise.all([
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "decision"),
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "decision")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "project"),
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "project")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id),
      supabase
        .from("pages")
        .select("id, title, icon, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("organization_integrations")
        .select("provider_account_id, status")
        .eq("organization_id", activeOrg.id)
        .eq("provider", "stripe")
        .eq("status", "connected")
        .order("updated_at", { ascending: false })
        .limit(1),
      getCompanyGraphData(activeOrg.id).catch(() => ({
        nodes: [],
        edges: [],
        totalConnections: 0,
      })),
    ]);

    decisionsCount = decCountRes.count || 0;
    recentDecisions = (decListRes.data as DecisionItem[]) || [];
    projectsCount = projCountRes.count || 0;
    recentProjects = (projListRes.data as ProjectItem[]) || [];
    pagesCount = pageCountRes.count || 0;
    membersCount = memberRes.count || 1;
    recentPages = (recentPagesRes.data as PageItem[]) || [];
    graphData = companyGraph;

    const stripeRecord = (stripeIntRes.data as Array<{ provider_account_id: string; status: string }> | null)?.[0];
    if (stripeRecord && stripeRecord.status === "connected") {
      isStripeConnected = true;
      stripeAccountId = stripeRecord.provider_account_id;
      const snapshotResult = await getOrFetchStripeFinancialSnapshot(supabase, activeOrg.id);
      stripeSnapshot = snapshotResult.snapshot;
      stripeStatus = snapshotResult.status;
    }
  }

  return (
    <ExecutiveHomeDashboard
      organizationId={activeOrg?.id ?? ""}
      organizationName={activeOrg?.name ?? "Organização"}
      userRole={activeOrg?.role ?? "member"}
      graphData={graphData}
      decisions={recentDecisions}
      decisionsCount={decisionsCount}
      projects={recentProjects}
      projectsCount={projectsCount}
      pages={recentPages}
      pagesCount={pagesCount}
      membersCount={membersCount}
      timelineEvents={timelineEvents}
      stripeSnapshot={stripeSnapshot}
      stripeStatus={stripeStatus}
      isStripeConnected={isStripeConnected}
      stripeAccountId={stripeAccountId}
      checklistState={onboardingState?.checklistState}
    />
  );
}
