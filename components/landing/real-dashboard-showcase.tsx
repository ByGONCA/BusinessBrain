"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { InboxProvider } from "@/components/dashboard/inbox/inbox-context";
import { SettingsProvider } from "@/components/dashboard/settings/settings-context";
import { SidePeekProvider } from "@/components/dashboard/pages/side-peek-context";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ExecutiveHomeDashboard } from "@/components/dashboard/home/executive-home-dashboard";
import { InteractiveGraphCanvas } from "@/components/dashboard/connections/interactive-graph-canvas";
import { FinanceDashboard } from "@/components/dashboard/finance/finance-dashboard";
import { PagesHub } from "@/components/dashboard/pages/pages-hub";
import { PageBreadcrumbs } from "@/components/dashboard/pages/page-breadcrumbs";
import { BlockEditor } from "@/components/dashboard/pages/block-editor";
import {
  DEMO_PAGES,
  DEMO_DECISIONS,
  DEMO_GRAPH_NODES,
  DEMO_FINANCE_DATA,
  DEMO_TELEMETRY,
} from "@/lib/marketing/demo-data";
import { PageRecord, PageTreeNode, EditorBlock } from "@/lib/pages/types";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { CompanyGraphData, GraphNode, GraphEdge, EntityType } from "@/lib/connections/types";
import { StripeFinancialSnapshot } from "@/lib/integrations/stripe/types";

// ==============================================================================
// 1. Static Mock Data Mappings for Production Dashboard Components
// ==============================================================================

const MOCK_USER = {
  id: "demo-user-001",
  email: "elena.rostova@acme-corp.com",
  user_metadata: {
    full_name: "Elena Rostova",
    name: "Elena Rostova",
    avatar_url: undefined,
  },
};

const MOCK_ORG: OrganizationWithRole = {
  id: "org-acme-technologies",
  name: "Acme Technologies Inc.",
  slug: "acme-technologies",
  role: "owner",
  created_by: "demo-user-001",
  status: "active",
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const MOCK_ENTITLEMENT: OrganizationEntitlement = {
  isEntitled: true,
  status: "trialing",
  plan: "pro",
  isTrial: true,
  trialEnd: "2026-10-27T23:59:59Z",
  currentPeriodEnd: "2026-10-27T23:59:59Z",
  cancelAtPeriodEnd: false,
  subscriptionId: "sub_demo_trial",
};

// Convert DEMO_PAGES to production PageRecord format
const PRODUCTION_PAGES: PageRecord[] = DEMO_PAGES.map((p, idx) => {
  const blocks: EditorBlock[] = [
    {
      id: `b-header-${p.id}`,
      type: "heading_1",
      content: p.title,
    },
    ...p.blocks.map((b, bIdx) => {
      let bType: EditorBlock["type"] = "paragraph";
      if (b.type === "callout") bType = "callout";
      else if (b.type === "list") bType = "bullet_list";

      return {
        id: `b-${p.id}-${bIdx}`,
        type: bType,
        content: b.content,
        properties: b.meta?.calloutType
          ? { calloutIcon: b.meta.calloutType === "success" ? "✅" : b.meta.calloutType === "warning" ? "⚠️" : "💡" }
          : undefined,
      };
    }),
  ];

  return {
    id: p.id,
    organization_id: MOCK_ORG.id,
    parent_page_id: null,
    title: p.title,
    icon: p.category === "Strategy" ? "🎯" : p.category === "Architecture" ? "📐" : p.category === "Finance" ? "💳" : "📄",
    content: blocks,
    content_text: p.blocks.map((b) => b.content).join(" "),
    position: idx,
    is_favorite: p.category === "Strategy",
    is_archived: false,
    archived_at: null,
    created_by: MOCK_USER.id,
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-24T18:30:00Z",
    revision_id: p.revision,
  };
});

const PRODUCTION_PAGE_TREE: PageTreeNode[] = PRODUCTION_PAGES.map((p) => ({
  ...p,
  children: [],
}));

// Convert graph nodes to production GraphNode & GraphEdge
const PRODUCTION_GRAPH_NODES: GraphNode[] = DEMO_GRAPH_NODES.map((n) => ({
  id: n.id,
  organization_id: MOCK_ORG.id,
  type: (n.type === "repo" ? "project" : n.type === "meeting" ? "meeting" : n.type) as EntityType,
  title: n.title,
  degree: n.connections.length,
  inDegree: 1,
  outDegree: n.connections.length,
  metadata: { summary: n.summary, status: "Active" },
}));

const PRODUCTION_GRAPH_EDGES: GraphEdge[] = DEMO_GRAPH_NODES.flatMap((n) =>
  n.connections.map((targetId) => ({
    id: `edge-${n.id}-${targetId}`,
    source: n.id,
    sourceType: (n.type === "repo" ? "project" : n.type === "meeting" ? "meeting" : n.type) as EntityType,
    target: targetId,
    targetType: "page" as EntityType,
    relationshipType: "related_to" as const,
    label: "Related to",
    reverseLabel: "Related to",
  }))
);

const PRODUCTION_GRAPH_DATA: CompanyGraphData = {
  nodes: PRODUCTION_GRAPH_NODES,
  edges: PRODUCTION_GRAPH_EDGES,
  totalConnections: PRODUCTION_GRAPH_EDGES.length,
};

// Convert financial metrics to production StripeFinancialSnapshot
const PRODUCTION_STRIPE_SNAPSHOT: StripeFinancialSnapshot = {
  organizationId: MOCK_ORG.id,
  connectedAccountId: "acct_demo_businessbrain",
  livemode: false,
  computedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  freshnessStatus: "fresh",
  primaryCurrency: "eur",
  totalActiveCustomersCount: 312,
  totalAtRiskCustomersCount: 2,
  dunningGracePeriodDays: 14,
  timezone: "UTC",
  provenance: {
    source: "stripe_connect_api",
    apiVersion: "2024-06-20",
    sampledChargesCount: 142,
    sampledSubscriptionsCount: 312,
    sampledBalanceTransactionsCount: 250,
    lastSyncedAt: new Date().toISOString(),
    payloadSizeBytes: 4096,
    safeguardPruned: false,
    pagesTraversedSubscriptions: 4,
    pagesTraversedBalanceTransactions: 3,
    hasMoreUnfetched: false,
  },
  monthlyHistory: {
    eur: [
      { monthKey: "2026-03", grossRevenueCents: 1540000, netRevenueCents: 1420000, newCustomersCount: 28 },
      { monthKey: "2026-04", grossRevenueCents: 1790000, netRevenueCents: 1680000, newCustomersCount: 34 },
      { monthKey: "2026-05", grossRevenueCents: 2100000, netRevenueCents: 1950000, newCustomersCount: 42 },
      { monthKey: "2026-06", grossRevenueCents: 2310000, netRevenueCents: 2140000, newCustomersCount: 45 },
      { monthKey: "2026-07", grossRevenueCents: 2540000, netRevenueCents: 2310000, newCustomersCount: 49 },
      { monthKey: "2026-08", grossRevenueCents: 2842000, netRevenueCents: 2485000, newCustomersCount: 56 },
    ],
  },
  currencies: {
    eur: {
      currency: "eur",
      activeMrrCents: 2485000,
      grossContractualMrrCents: 2600000,
      discountSavingsMrrCents: 115000,
      atRiskDunningMrrCents: 3800,
      arrCents: 29820000,
      grossRevenueCents: 2842000,
      netRevenueCents: 2750000,
      totalRefundsCents: 0,
      openDisputesCents: 0,
      stripeFeesCents: 92000,
      activeSubscribersCount: 312,
      trialingSubscribersCount: 28,
      canceledSubscribersCount: 4,
      atRiskSubscribersCount: 2,
      discountedSubscribersCount: 14,
      arpuCents: 7964,
      churnRatePercentage: 0.8,
      retentionRatePercentage: 99.2,
      trialConversionRatePercentage: 74.5,
    },
  },
};

const PRODUCTION_DECISIONS = DEMO_DECISIONS.map((d) => ({
  id: d.id,
  title: `${d.code}: ${d.title}`,
  created_at: d.date,
  updated_at: d.date,
  metadata: { status: d.status, drivers: d.drivers, context: d.context, decision: d.decision, consequences: d.consequences },
}));

const PRODUCTION_PROJECTS = [
  { id: "proj-stripe", title: "Stripe Connect & Trial Monetization", created_at: "2026-08-01", updated_at: "2026-08-20", metadata: { status: "active" } },
  { id: "proj-graph", title: "Topological Company Graph Engine v2", created_at: "2026-08-10", updated_at: "2026-08-24", metadata: { status: "active" } },
];

const PRODUCTION_TIMELINE = [
  { id: "tl-1", organization_id: MOCK_ORG.id, event_type: "decision_created", title: "ADR-014: 3-Day Trial Accepted", entity_type: "decision", entity_id: "adr-014", created_at: "2026-08-24T09:30:00Z", metadata: { author: "Sarah Chen" } },
  { id: "tl-2", organization_id: MOCK_ORG.id, event_type: "page_created", title: "Engineering Spec: Monotonic OCC v14", entity_type: "page", entity_id: "page-occ-spec", created_at: "2026-08-23T16:15:00Z", metadata: { author: "Elena Rostova" } },
  { id: "tl-3", organization_id: MOCK_ORG.id, event_type: "integration_synced", title: "GitHub Webhook: PR #142 Merged", entity_type: "project", entity_id: "proj-stripe", created_at: "2026-08-23T14:00:00Z", metadata: { provider: "github" } },
];

// ==============================================================================
// 2. Real Dashboard Showcase Component
// ==============================================================================

interface RealDashboardShowcaseProps {
  standalone?: boolean;
  className?: string;
}

export function RealDashboardShowcase({
  standalone = false,
  className,
}: RealDashboardShowcaseProps) {
  const { t } = useLanguage();
  const [activePath, setActivePath] = React.useState<string>("/dashboard");
  const [selectedGraphNode, setSelectedGraphNode] = React.useState<GraphNode | null>(null);

  // Synchronous route switcher inside the showcase
  const handleNavigate = React.useCallback((href: string) => {
    setActivePath(href);
  }, []);

  // Resolve currently active page if viewing a page document
  const activePageRecord = React.useMemo(() => {
    if (activePath.startsWith("/dashboard/pages/")) {
      const pageId = activePath.replace("/dashboard/pages/", "");
      return PRODUCTION_PAGES.find((p) => p.id === pageId) || PRODUCTION_PAGES[0];
    }
    return null;
  }, [activePath]);

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border border-[#242428] bg-[#09090B] shadow-2xl overflow-hidden transition-all duration-300",
        standalone ? "min-h-screen rounded-none border-none shadow-none" : "max-w-7xl mx-auto",
        className
      )}
    >
      {/* Embedded Real Production Dashboard UI */}
      <div className="relative flex h-[780px] max-h-[88vh] w-full bg-[#0A0A0B] text-zinc-100">
        <SidebarProvider>
          <InboxProvider>
            <SettingsProvider>
              <SidePeekProvider>
                {/* 1. Real Production Sidebar */}
                <Sidebar
                  user={MOCK_USER}
                  organizations={[MOCK_ORG]}
                  activeOrg={MOCK_ORG}
                  entitlement={MOCK_ENTITLEMENT}
                  pageTree={PRODUCTION_PAGE_TREE}
                  favoritePages={[PRODUCTION_PAGES[0]]}
                  initialIntegrations={[
                    { id: "int-1", organization_id: MOCK_ORG.id, provider: "github", status: "connected" } as any,
                    { id: "int-2", organization_id: MOCK_ORG.id, provider: "stripe", status: "connected" } as any,
                  ]}
                  demoMode={true}
                  activeDemoPath={activePath}
                  onDemoNavigate={handleNavigate}
                />

                {/* 2. Real Production Main Content View */}
                <main className="flex-1 overflow-y-auto bg-[#09090A] p-4 md:p-6 lg:p-8 no-scrollbar">
                  {/* View A: Home Dashboard (/dashboard) */}
                  {activePath === "/dashboard" && (
                    <div className="animate-in fade-in duration-200">
                      <ExecutiveHomeDashboard
                        organizationId={MOCK_ORG.id}
                        organizationName={MOCK_ORG.name}
                        userRole="owner"
                        graphData={PRODUCTION_GRAPH_DATA}
                        decisions={PRODUCTION_DECISIONS}
                        decisionsCount={PRODUCTION_DECISIONS.length}
                        projects={PRODUCTION_PROJECTS}
                        projectsCount={PRODUCTION_PROJECTS.length}
                        pages={PRODUCTION_PAGES.map((p) => ({
                          id: p.id,
                          title: p.title,
                          icon: p.icon,
                          updated_at: p.updated_at,
                        }))}
                        pagesCount={PRODUCTION_PAGES.length}
                        membersCount={14}
                        timelineEvents={PRODUCTION_TIMELINE as any}
                        stripeSnapshot={PRODUCTION_STRIPE_SNAPSHOT}
                        stripeStatus="fresh"
                        isStripeConnected={true}
                        demoMode={true}
                        onDemoNavigate={handleNavigate}
                      />
                    </div>
                  )}

                  {/* View B: Force-Directed Company Graph (/dashboard/connections) */}
                  {activePath === "/dashboard/connections" && (
                    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Company Graph</h1>
                          <p className="text-xs text-zinc-400">
                            Deterministic BFS $O(V + E)$ cycle-safe entity network. Click nodes to focus.
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 min-h-[600px] rounded-xl border border-[#242428] bg-[#0E0E10] overflow-hidden">
                        <InteractiveGraphCanvas
                          nodes={PRODUCTION_GRAPH_DATA.nodes}
                          edges={PRODUCTION_GRAPH_DATA.edges}
                          selectedNodeId={selectedGraphNode?.id ?? null}
                          onSelectNode={(node) => setSelectedGraphNode(node)}
                          focusDepth={null}
                          className="h-full w-full min-h-[600px]"
                        />
                      </div>
                    </div>
                  )}

                  {/* View C: Financial Analytics (/dashboard/finance) */}
                  {activePath === "/dashboard/finance" && (
                    <div className="animate-in fade-in duration-200">
                      <FinanceDashboard
                        organizationId={MOCK_ORG.id}
                        organizationName={MOCK_ORG.name}
                        stripeSnapshot={PRODUCTION_STRIPE_SNAPSHOT}
                        isStripeConnected={true}
                        userRole="owner"
                        demoMode={true}
                        onDemoNavigate={handleNavigate}
                      />
                    </div>
                  )}

                  {/* View D: Knowledge Hub Pages Directory (/dashboard/pages) */}
                  {activePath === "/dashboard/pages" && (
                    <div className="animate-in fade-in duration-200">
                      <PagesHub
                        initialPages={PRODUCTION_PAGES}
                        organizationId={MOCK_ORG.id}
                        demoMode={true}
                        onDemoNavigate={handleNavigate}
                      />
                    </div>
                  )}

                  {/* View E: Production Block Editor (/dashboard/pages/[id]) */}
                  {activePageRecord && (
                    <div className="relative min-h-full flex flex-col -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:-mx-8 animate-in fade-in duration-200">
                      <PageBreadcrumbs
                        breadcrumbs={[
                          { id: activePageRecord.id, title: activePageRecord.title, icon: activePageRecord.icon },
                        ]}
                        isFavorite={activePageRecord.is_favorite}
                        showSidePeekAction={false}
                        closeHref="/dashboard/pages"
                        onClose={() => handleNavigate("/dashboard/pages")}
                      />
                      <div className="flex-1 w-full p-4 md:p-6 lg:p-8 flex flex-col min-h-full">
                        <BlockEditor
                          page={activePageRecord}
                          currentUser={MOCK_USER}
                          demoMode={true}
                        />
                      </div>
                    </div>
                  )}

                  {/* View F: Decisions Log (/dashboard/decisions) */}
                  {activePath === "/dashboard/decisions" && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Architectural Decisions (ADRs)</h1>
                          <p className="text-xs text-zinc-400">
                            Immutable organizational decision records governing architecture, trials, and security.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {DEMO_DECISIONS.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-xl border border-[#242428] bg-[#121215] p-4 transition-all hover:border-[#383842]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-blue-400">{d.code}</span>
                                <h3 className="text-sm font-semibold text-white">{d.title}</h3>
                              </div>
                              <span className="text-[11px] font-medium text-emerald-400">
                                {d.status}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{d.context}</p>
                            <div className="rounded-lg bg-[#18181C] p-3 text-xs text-zinc-300 border border-[#202026]">
                              <span className="font-semibold text-white">Decision: </span>
                              {d.decision}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View G: Default / Other routes fallback to home */}
                  {activePath !== "/dashboard" &&
                    activePath !== "/dashboard/connections" &&
                    activePath !== "/dashboard/finance" &&
                    activePath !== "/dashboard/pages" &&
                    activePath !== "/dashboard/decisions" &&
                    !activePageRecord && (
                      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-3">
                        <h2 className="text-base font-semibold text-white">Route Preview: {activePath}</h2>
                        <p className="text-xs text-zinc-400 max-w-sm">
                          This section connects to live third-party webhooks in the full product.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleNavigate("/dashboard")}
                          className="rounded-lg bg-[#202024] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#28282E]"
                        >
                          Return to Home Dashboard
                        </button>
                      </div>
                    )}
                </main>
              </SidePeekProvider>
            </SettingsProvider>
          </InboxProvider>
        </SidebarProvider>
      </div>
    </div>
  );
}
