import { getActiveOrganization } from "@/lib/organizations/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { createClient } from "@/lib/supabase/server";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
} from "@/lib/integrations/stripe/analytics";
import { getGitHubOverviewAction } from "@/lib/integrations/github/actions";
import { listGoogleCalendarEvents } from "@/lib/integrations/google/calendar";
import { getUserOnboardingState } from "@/lib/onboarding/queries";
import { CompanyGraphData } from "@/lib/connections/types";
import {
  ExecutiveHomeDashboard,
  DecisionItem,
  ProjectItem,
  PageItem,
  PriorityItem,
} from "@/components/dashboard/home/executive-home-dashboard";
import { loadDashboardLayoutAction } from "@/lib/widgets/actions";
import { getDefaultLayout } from "@/lib/widgets/layout-defaults";
import { DashboardLayoutConfig } from "@/lib/widgets/types";

export default async function DashboardOverviewPage() {
  const [activeOrg, user, onboardingState] = await Promise.all([
    getActiveOrganization(),
    getCurrentUser(),
    getUserOnboardingState().catch(() => null),
  ]);

  const timelineEvents = activeOrg
    ? await getCompanyTimelineEvents(activeOrg.id).catch(() => [])
    : [];

  let decisionsCount = 0;
  let projectsCount = 0;
  let pagesCount = 0;
  let membersCount = 1;
  let totalConnections = 0;
  let recentPages: PageItem[] = [];
  let recentDecisions: DecisionItem[] = [];
  let recentProjects: ProjectItem[] = [];
  let priorityItems: PriorityItem[] = [];
  let stripeSnapshot: StripeFinancialSnapshot | null = null;
  let stripeStatus: MetricFreshnessStatus = "fresh";
  let isStripeConnected = false;
  let stripeAccountId: string | undefined;
  let tasksCount = 0;
  let recentTasks: Array<{ id: string; title: string; status?: string; priority?: string; updated_at?: string; created_at?: string }> = [];
  let goalsCount = 0;
  let recentGoals: Array<{ id: string; title: string; status?: string; current?: number; target?: number; progress?: number; updated_at?: string }> = [];
  let calendarEvents: Array<{ id: string; title: string; startTime: string; endTime?: string; meetUrl?: string; attendeesCount?: number }> = [];
  let githubData: { prs: any[]; repos: any[] } | undefined = undefined;

  if (activeOrg) {
    const supabase = await createClient();

    // High-performance lean queries (no multi-thousand row graph serialization)
    const [
      decCountRes,
      decListRes,
      projCountRes,
      projListRes,
      pageCountRes,
      memberRes,
      recentPagesRes,
      integrationsRes,
      connCountRes,
      pageConnCountRes,
      priorityEntitiesRes,
      tasksCountRes,
      tasksListRes,
      goalsCountRes,
      goalsListRes,
    ] = await Promise.all([
      // 1. Decisions count
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "decision"),
      // 2. Recent decisions
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "decision")
        .order("created_at", { ascending: false })
        .limit(5),
      // 3. Projects count
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "project"),
      // 4. Recent projects
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "project")
        .order("created_at", { ascending: false })
        .limit(5),
      // 5. Pages count
      supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false),
      // 6. Member count
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id),
      // 7. Recent pages
      supabase
        .from("pages")
        .select("id, title, icon, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(5),
      // 8. Organization integrations (Stripe, GitHub, Google, Slack, etc.)
      supabase
        .from("organization_integrations")
        .select("provider, provider_account_id, status")
        .eq("organization_id", activeOrg.id)
        .eq("status", "connected"),
      // 9. Canonical company connections count (<2ms)
      supabase
        .from("company_connections")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id),
      // 10. Legacy page connections count fallback (<2ms)
      supabase
        .from("page_connections")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id),
      // 11. Priority candidate entities (tasks & decisions needing executive attention)
      supabase
        .from("company_entities")
        .select("id, type, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .in("type", ["decision", "task"])
        .order("updated_at", { ascending: false })
        .limit(15),
      // 12. Workspace tasks count
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "task"),
      // 13. Recent tasks
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "task")
        .order("updated_at", { ascending: false })
        .limit(10),
      // 14. Workspace goals count
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "goal"),
      // 15. Goals list
      supabase
        .from("company_entities")
        .select("id, title, metadata, created_at, updated_at")
        .eq("organization_id", activeOrg.id)
        .eq("type", "goal")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    decisionsCount = decCountRes.count || 0;
    recentDecisions = (decListRes.data as DecisionItem[]) || [];
    projectsCount = projCountRes.count || 0;
    recentProjects = (projListRes.data as ProjectItem[]) || [];
    pagesCount = pageCountRes.count || 0;
    membersCount = memberRes.count || 1;
    recentPages = (recentPagesRes.data as PageItem[]) || [];
    tasksCount = tasksCountRes.count || 0;
    recentTasks = ((tasksListRes.data as Array<{ id: string; title: string; metadata?: Record<string, unknown>; created_at: string; updated_at: string }>) || []).map(t => ({
      id: t.id,
      title: t.title,
      status: (t.metadata?.status as string) || "pending",
      priority: (t.metadata?.priority as string) || "normal",
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    goalsCount = goalsCountRes.count || 0;
    recentGoals = ((goalsListRes.data as Array<{ id: string; title: string; metadata?: Record<string, unknown>; updated_at: string }>) || []).map(g => {
      const current = typeof g.metadata?.current === "number" ? g.metadata.current : 0;
      const target = typeof g.metadata?.target === "number" ? g.metadata.target : 100;
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      return {
        id: g.id,
        title: g.title,
        status: (g.metadata?.status as string) || "in_progress",
        current,
        target,
        progress,
        updated_at: g.updated_at,
      };
    });

    // Resolve connection count (canonical with fallback to page_connections)
    const canonicalConnCount = connCountRes.count || 0;
    const legacyConnCount = pageConnCountRes.count || 0;
    totalConnections = canonicalConnCount > 0 ? canonicalConnCount : legacyConnCount;

    // Filter genuine priority items from real database entities
    const rawEntities = (priorityEntitiesRes.data as Array<{
      id: string;
      type: "decision" | "task";
      title: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    }>) || [];

    for (const entity of rawEntities) {
      if (entity.type === "decision") {
        const status = (entity.metadata?.status as string) || "accepted";
        if (status === "proposed") {
          priorityItems.push({
            id: entity.id,
            title: entity.title,
            type: "decision",
            priority: "high",
            status: "proposed",
            context: "Architectural Decision",
            href: `/dashboard/decisions?id=${entity.id}`,
            updatedAt: entity.updated_at,
          });
        }
      } else if (entity.type === "task") {
        const isCompleted = entity.metadata?.status === "completed" || entity.metadata?.completed === true;
        if (!isCompleted) {
          const priority = (entity.metadata?.priority as "urgent" | "high" | "normal") || "normal";
          const dueDate = (entity.metadata?.due_date as string) || null;
          const isOverdue = !!(dueDate && new Date(dueDate).getTime() < Date.now());
          const isUrgent = priority === "urgent" || priority === "high" || isOverdue;

          if (isUrgent) {
            priorityItems.push({
              id: entity.id,
              title: entity.title,
              type: "task",
              priority: isOverdue ? "urgent" : priority,
              status: isOverdue ? "overdue" : ((entity.metadata?.status as string) || "pending"),
              context: "Action Item",
              href: `/dashboard/tasks`,
              dueDate,
              updatedAt: entity.updated_at,
            });
          }
        }
      }
    }

    // Rank priority items: Urgent/Overdue (weight 3) -> High (weight 2) -> Normal/Proposed (weight 1), then recency
    priorityItems.sort((a, b) => {
      const weightA = a.status === "overdue" || a.priority === "urgent" ? 3 : a.priority === "high" ? 2 : 1;
      const weightB = b.status === "overdue" || b.priority === "urgent" ? 3 : b.priority === "high" ? 2 : 1;
      if (weightA !== weightB) return weightB - weightA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Resolve connected integrations (Stripe, GitHub, Google Calendar)
    const connectedIntegrations = (integrationsRes.data as Array<{ provider: string; provider_account_id: string; status: string }> | null) || [];

    // 1. Stripe Provider Integration
    const stripeRecord = connectedIntegrations.find((i) => i.provider === "stripe");
    if (stripeRecord && stripeRecord.status === "connected") {
      isStripeConnected = true;
      stripeAccountId = stripeRecord.provider_account_id;
      try {
        const snapshotResult = await getOrFetchStripeFinancialSnapshot(supabase, activeOrg.id);
        stripeSnapshot = snapshotResult.snapshot;
        stripeStatus = snapshotResult.status;
      } catch {
        // Stripe integration failure must never blank the entire dashboard
        stripeStatus = "error";
      }
    }

    // 2. GitHub Provider Integration
    const githubRecord = connectedIntegrations.find((i) => i.provider === "github");
    if (githubRecord && githubRecord.status === "connected") {
      try {
        const ghRes = await getGitHubOverviewAction(activeOrg.id);
        if (ghRes.success && ghRes.data) {
          githubData = {
            prs: (ghRes.data.recentActivity || [])
              .filter((a) => a.type === "pr_opened" || a.type === "pr_merged")
              .slice(0, 10)
              .map((a) => ({
                id: a.id,
                title: a.title || "Pull Request",
                author: a.actor?.login,
                status: a.type === "pr_merged" ? "merged" : "open",
                url: a.url,
              })),
            repos: [],
          };
        }
      } catch {
        // Safe boundary: provider failure must never blank the dashboard
      }
    }

    // 3. Google Calendar Provider Integration
    const googleRecord = connectedIntegrations.find((i) => i.provider === "google");
    if (googleRecord && googleRecord.status === "connected") {
      try {
        const gEvents = await listGoogleCalendarEvents(activeOrg.id, {
          timeMin: new Date().toISOString(),
          maxResults: 10,
        });
        if (Array.isArray(gEvents)) {
          calendarEvents = gEvents.map((e) => ({
            id: e.id,
            title: e.summary || "Meeting",
            startTime: e.start?.dateTime || e.start?.date || new Date().toISOString(),
            endTime: e.end?.dateTime || e.end?.date,
            meetUrl: e.hangoutLink,
          }));
        }
      } catch {
        // Safe boundary
      }
    }
  }

  // Load custom or default dashboard layout (0 client waterfall)
  let initialLayout: DashboardLayoutConfig = getDefaultLayout("home");
  if (activeOrg && user) {
    try {
      const layoutRes = await loadDashboardLayoutAction({
        organizationId: activeOrg.id,
        dashboardType: "home",
      });
      initialLayout = layoutRes.layout;
    } catch {
      // Safe fallback to curated 3-block default
      initialLayout = getDefaultLayout("home");
    }
  }

  const graphData: CompanyGraphData = {
    nodes: [],
    edges: [],
    totalConnections,
  };

  return (
    <ExecutiveHomeDashboard
      organizationId={activeOrg?.id ?? ""}
      organizationName={activeOrg?.name ?? "Workspace"}
      userRole={activeOrg?.role ?? "member"}
      userId={user?.id}
      graphData={graphData}
      connectionCount={totalConnections}
      decisions={recentDecisions}
      decisionsCount={decisionsCount}
      projects={recentProjects}
      projectsCount={projectsCount}
      pages={recentPages}
      pagesCount={pagesCount}
      tasks={recentTasks}
      tasksCount={tasksCount}
      goals={recentGoals}
      goalsCount={goalsCount}
      calendarEvents={calendarEvents}
      githubData={githubData}
      membersCount={membersCount}
      timelineEvents={timelineEvents}
      priorityItems={priorityItems}
      stripeSnapshot={stripeSnapshot}
      stripeStatus={stripeStatus}
      isStripeConnected={isStripeConnected}
      stripeAccountId={stripeAccountId}
      checklistState={onboardingState?.checklistState}
      initialLayout={initialLayout}
    />
  );
}
