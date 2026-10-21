import { getActiveOrganization } from "@/lib/organizations/queries";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { CompanyTimeline } from "@/components/dashboard/timeline/company-timeline";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Clock,
  FileText,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorUsers,
  PhosphorNetwork,
} from "@/components/icons";
import Link from "next/link";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { BusinessMetricsSection } from "@/components/dashboard/analytics/business-metrics";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
} from "@/lib/integrations/stripe/analytics";
import { getUserOnboardingState } from "@/lib/onboarding/queries";
import { FirstStepsChecklist } from "@/components/dashboard/checklist/first-steps-checklist";

export default async function DashboardOverviewPage() {
  const activeOrg = await getActiveOrganization();
  const timelineEvents = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];
  const onboardingState = await getUserOnboardingState();

  let decisionsCount = 0;
  let projectsCount = 0;
  let pagesCount = 0;
  let membersCount = 1;
  let recentPages: Array<{ id: string; title: string; icon?: string | null; updated_at: string }> = [];
  let stripeSnapshot: StripeFinancialSnapshot | null = null;
  let stripeStatus: MetricFreshnessStatus = "fresh";
  let isStripeConnected = false;
  let stripeAccountId: string | undefined;

  if (activeOrg) {
    const supabase = await createClient();

    const [decRes, projRes, pageRes, memberRes, recentRes, stripeIntRes] = await Promise.all([
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "decision"),
      supabase
        .from("company_entities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.id)
        .eq("type", "project"),
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
        .limit(4),
      supabase
        .from("organization_integrations")
        .select("provider_account_id, status")
        .eq("organization_id", activeOrg.id)
        .eq("provider", "stripe")
        .maybeSingle(),
    ]);

    decisionsCount = decRes.count || 0;
    projectsCount = projRes.count || 0;
    pagesCount = pageRes.count || 0;
    membersCount = memberRes.count || 1;
    recentPages = (recentRes.data as typeof recentPages) || [];

    if (stripeIntRes.data && stripeIntRes.data.status === "connected") {
      isStripeConnected = true;
      stripeAccountId = stripeIntRes.data.provider_account_id;
      const snapshotResult = await getOrFetchStripeFinancialSnapshot(supabase, activeOrg.id);
      stripeSnapshot = snapshotResult.snapshot;
      stripeStatus = snapshotResult.status;
    }
  }

  return (
    <div className="space-y-7 max-w-6xl">
      {/* Home Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Dashboard Overview
            </h1>
            {activeOrg && (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                {activeOrg.name}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time organizational intelligence, recent activity, and memory layer status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
          >
            <PhosphorNetwork className="h-3.5 w-3.5 text-blue-400" />
            <span>Company Map</span>
          </Link>
        </div>
      </div>

      {/* First-Use Actionable Checklist */}
      {activeOrg && (
        <FirstStepsChecklist
          initialState={onboardingState?.checklistState || {}}
          hasPages={pagesCount > 0}
          hasMultipleMembers={membersCount > 1}
          organizationId={activeOrg.id}
        />
      )}

      {/* Real Business Data & Financial Metrics (Stripe Connect) */}
      {activeOrg && (
        <BusinessMetricsSection
          organizationId={activeOrg.id}
          userRole={activeOrg.role}
          initialSnapshot={stripeSnapshot}
          status={stripeStatus}
          isStripeConnected={isStripeConnected}
          connectedAccountId={stripeAccountId}
        />
      )}

      {/* Metric Cards Grid (Reference Image 1) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border hover:border-hover transition-colors">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Decisions
            </CardTitle>
            <PhosphorGitBranch className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{decisionsCount}</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              ADRs & strategic choices
            </p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-hover transition-colors">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Projects
            </CardTitle>
            <PhosphorFolder className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{projectsCount}</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Active initiatives
            </p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-hover transition-colors">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Knowledge
            </CardTitle>
            <PhosphorBookOpen className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{pagesCount}</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Wikis & workspace docs
            </p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-hover transition-colors">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Team Members
            </CardTitle>
            <PhosphorUsers className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{membersCount}</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Active collaborators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Timeline */}
      {activeOrg && (
        <CompanyTimeline
          events={timelineEvents}
          organizationName={activeOrg.name}
        />
      )}

      {/* Main Content Grid: Recent Documents & Workspace Navigation */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Recently Updated Documents */}
        <Card className="bg-card border-border p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Recent Workspace Pages
              </h2>
            </div>
            <Link
              href="/dashboard/pages"
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              All Pages →
            </Link>
          </div>

          <div className="divide-y divide-border pt-1">
            {recentPages.length > 0 ? (
              recentPages.map((page) => (
                <Link
                  key={page.id}
                  href={`/dashboard/pages/${page.id}`}
                  className="flex items-center justify-between py-2.5 px-1.5 hover:bg-hover rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PageIcon icon={page.icon} pageId={page.id} className="text-xs shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">
                      {page.title || "Untitled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(page.updated_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No documents created yet in this workspace.
              </div>
            )}
          </div>
        </Card>

        {/* Right: Architecture & Security Status */}
        <Card className="bg-card border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Enterprise Security & RLS
                </h2>
              </div>
              <Badge variant="secondary" className="text-[10px]">Active Guard</Badge>
            </div>

            <div className="space-y-3 pt-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-secondary p-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">PostgreSQL Multi-Tenant RLS</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Zero cross-tenant leakage. Strict database-level Row Level Security policies isolate all entities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-secondary p-3">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Modular Operating Architecture</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Stripe subscriptions, calendar sync, and the Gemini memory layer operate through clean domain interfaces in <code className="font-mono text-[10px] text-blue-300">lib/</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground">Verified multi-tenant perimeter</span>
            <Link
              href="/dashboard/connections"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Explore Graph Engine</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
