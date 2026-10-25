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
  Calendar,
  Clock,
  GitBranch,
  FolderGit2,
  Users,
  Mail,
  FileText,
  CheckSquare,
  Target,
  Layers,
  Search,
  Filter,
  TrendingUp,
  Brain,
  MessageSquare,
  AlertCircle,
  Plus,
  Github,
  ChevronRight,
  Inbox,
  UserCheck,
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
  {
    id: "proj-stripe",
    title: "Stripe Connect & Monetization Engine",
    description: "Multi-currency SaaS billing with automated dunning and 3-day upfront trial validation.",
    progress: 88,
    status: "Active",
    repos: ["acme/stripe-billing", "acme/webhooks"],
    lead: "Sarah Chen",
    deadline: "Sept 15, 2026",
  },
  {
    id: "proj-graph",
    title: "Topological Company Graph Engine v2",
    description: "Deterministic BFS cycle-safe knowledge graph powering organizational context synthesis.",
    progress: 94,
    status: "Active",
    repos: ["acme/graph-core"],
    lead: "Marcus Vance",
    deadline: "Aug 30, 2026",
  },
  {
    id: "proj-occ",
    title: "Monotonic Optimistic Concurrency Control",
    description: "Sub-millisecond conflict-free document editor revisions with monotonic Lamport clocks.",
    progress: 100,
    status: "Completed",
    repos: ["acme/editor-engine"],
    lead: "Elena Rostova",
    deadline: "Shipped",
  },
  {
    id: "proj-compliance",
    title: "SOC2 Type II Audit Trails & Cryptographic Ledger",
    description: "Immutable append-only organizational telemetry with verification signatures.",
    progress: 45,
    status: "In Progress",
    repos: ["acme/security-audit"],
    lead: "Elena Rostova",
    deadline: "Oct 31, 2026",
  },
];

const PRODUCTION_TASKS = [
  {
    id: "task-1",
    title: "Verify idempotency keys on Stripe invoice.payment_succeeded",
    priority: "High",
    status: "In Progress",
    assignee: "Sarah Chen",
    due: "Tomorrow",
    tag: "Billing",
  },
  {
    id: "task-2",
    title: "Implement deterministic BFS cycle-safe traversal for graph canvas",
    priority: "Urgent",
    status: "Done",
    assignee: "Marcus Vance",
    due: "Yesterday",
    tag: "Graph",
  },
  {
    id: "task-3",
    title: "Add optimistic concurrency check in block editor mutations",
    priority: "High",
    status: "Done",
    assignee: "Elena Rostova",
    due: "Aug 24",
    tag: "Pages",
  },
  {
    id: "task-4",
    title: "Review annual discount coupon rules before day-3 charge",
    priority: "Medium",
    status: "Review",
    assignee: "Elena Rostova",
    due: "Aug 26",
    tag: "Finance",
  },
  {
    id: "task-5",
    title: "Configure Resend transactional email fallback webhooks",
    priority: "Normal",
    status: "Todo",
    assignee: "Dev Team",
    due: "Aug 29",
    tag: "Integrations",
  },
];

const PRODUCTION_GOALS = [
  {
    id: "goal-1",
    title: "Q3 2026: Reach €30,000 MRR with <1% monthly churn",
    current: "€24,850",
    target: "€30,000",
    progress: 83,
    owner: "Elena Rostova",
  },
  {
    id: "goal-2",
    title: "Q3 2026: Sub-50ms Graph Query Latency across 10,000 entities",
    current: "34ms",
    target: "<50ms",
    progress: 95,
    owner: "Marcus Vance",
  },
  {
    id: "goal-3",
    title: "Q4 2026: Launch Native GitHub PR & Linear Sync Integration",
    current: "Phase 2",
    target: "Production",
    progress: 65,
    owner: "Sarah Chen",
  },
];

const PRODUCTION_MEETINGS = [
  {
    id: "meet-1",
    title: "Weekly Architecture & Monotonic State Sync",
    date: "Aug 24, 2026 • 45 min",
    attendees: 5,
    summary: "Reviewed OCC conflict resolution, deterministic topological BFS ordering, and Stripe webhook deduplication guarantees.",
    decision: "ADR-014 accepted unanimously. Merged PR #142 into main branch.",
  },
  {
    id: "meet-2",
    title: "Monetization & Upfront Trial Performance Standup",
    date: "Aug 22, 2026 • 30 min",
    attendees: 3,
    summary: "Confirmed 3-day upfront card verification funnel. Trial-to-paid conversion holding steady at 74.5%.",
    decision: "Keep 3-day window; maintain zero pre-selected marketing consent.",
  },
  {
    id: "meet-3",
    title: "Executive Engineering All-Hands",
    date: "Aug 18, 2026 • 60 min",
    attendees: 14,
    summary: "Sprint demonstration of the interactive canvas graph and Notion-grade block editor.",
    decision: "Release v1.4 to pilot enterprise customers next week.",
  },
];

const PRODUCTION_TIMELINE = [
  { id: "tl-1", date: "Aug 24, 2026", author: "Sarah Chen", title: "ADR-014: 3-Day Trial Architecture Accepted", category: "Decision" },
  { id: "tl-2", date: "Aug 23, 2026", author: "Elena Rostova", title: "Engineering Spec: Monotonic OCC v14 Published", category: "Pages" },
  { id: "tl-3", date: "Aug 23, 2026", author: "GitHub Sync", title: "PR #142 Merged: Monotonic Conflict Resolver", category: "GitHub" },
  { id: "tl-4", date: "Aug 22, 2026", author: "Stripe Connect", title: "Upfront card trial payment setup completed for Apex Labs", category: "Billing" },
  { id: "tl-5", date: "Aug 15, 2026", author: "Elena Rostova", title: "Company Brain Architecture Blueprint Finalized", category: "Milestone" },
];

const PRODUCTION_MEMBERS = [
  { id: "m-1", name: "Elena Rostova", role: "Owner & CEO", email: "elena@acme-corp.com", department: "Executive" },
  { id: "m-2", name: "Sarah Chen", role: "VP Engineering", email: "sarah.chen@acme-corp.com", department: "Engineering" },
  { id: "m-3", name: "Marcus Vance", role: "Principal Engineer", email: "marcus.v@acme-corp.com", department: "Infrastructure" },
  { id: "m-4", name: "Alex Mercer", role: "Product Lead", email: "alex.m@acme-corp.com", department: "Product" },
];

const PRODUCTION_GITHUB_PRS = [
  { id: "pr-1", number: 142, title: "feat(engine): monotonic OCC conflict resolver v14", status: "Merged", time: "2h ago", author: "Sarah Chen" },
  { id: "pr-2", number: 140, title: "fix(billing): duplicate stripe customer deduplication safeguard", status: "Merged", time: "1d ago", author: "Elena Rostova" },
  { id: "pr-3", number: 138, title: "perf(graph): topological BFS memoization and cycle guards", status: "Merged", time: "2d ago", author: "Marcus Vance" },
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

  // Synchronous in-place route switcher inside the showcase
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
        standalone ? "min-h-screen rounded-none border-none shadow-none" : "max-w-[1360px] w-full mx-auto",
        className
      )}
    >
      {/* Embedded Real Production Dashboard UI */}
      <div className="relative flex h-[820px] max-h-[90vh] w-full bg-[#0A0A0B] text-zinc-100">
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
                        projects={PRODUCTION_PROJECTS as any}
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
                            Deterministic BFS cycle-safe topological entity network. Click nodes to focus.
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

                  {/* View G: Projects & Repositories (/dashboard/projects) */}
                  {activePath.startsWith("/dashboard/projects") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Strategic Projects</h1>
                          <p className="text-xs text-zinc-400">Active engineering initiatives, repository synchronization, and milestones.</p>
                        </div>
                        <div className="text-xs text-zinc-400 font-medium">
                          {PRODUCTION_PROJECTS.length} Initiatives Active
                        </div>
                      </div>

                      <div className="grid gap-3.5 sm:grid-cols-2">
                        {PRODUCTION_PROJECTS.map((proj) => (
                          <div
                            key={proj.id}
                            className="rounded-xl border border-[#242428] bg-[#121215] p-5 transition-all hover:border-[#383842]"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="text-sm font-semibold text-white">{proj.title}</h3>
                              <span className="text-[11px] font-medium text-emerald-400 shrink-0">
                                {proj.status}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{proj.description}</p>
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                <span>Progress</span>
                                <span className="text-zinc-200">{proj.progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-[#202026] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ width: `${proj.progress}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-[#1E1E22] text-xs text-zinc-400">
                              <span>Lead: {proj.lead}</span>
                              <span className="font-mono text-[11px]">{proj.deadline}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View H: Tasks Tracking (/dashboard/tasks) */}
                  {activePath.startsWith("/dashboard/tasks") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Action Tasks</h1>
                          <p className="text-xs text-zinc-400">Cross-functional task execution ledger linked to architectural decisions.</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#242428] bg-[#121215] overflow-hidden">
                        <div className="divide-y divide-[#1E1E22]">
                          {PRODUCTION_TASKS.map((task) => (
                            <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#18181D] transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-2 w-2 rounded-full shrink-0",
                                  task.status === "Done" ? "bg-emerald-400" : task.status === "In Progress" ? "bg-blue-400" : "bg-zinc-500"
                                )} />
                                <div>
                                  <div className="text-sm font-medium text-white">{task.title}</div>
                                  <div className="text-[11px] text-zinc-400 mt-0.5">Assigned to {task.assignee} • Scope: {task.tag}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                <span className={cn(
                                  "text-[11px] font-medium font-mono px-2 py-0.5 rounded-md",
                                  task.priority === "Urgent" ? "bg-rose-500/10 text-rose-400" : task.priority === "High" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-300"
                                )}>
                                  {task.priority}
                                </span>
                                <span className="text-xs text-zinc-400 font-mono">{task.due}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View I: Goals & OKRs (/dashboard/goals) */}
                  {activePath.startsWith("/dashboard/goals") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Company Objectives & Key Results</h1>
                          <p className="text-xs text-zinc-400">Quantitative targets synchronized with live Stripe and GitHub telemetry.</p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {PRODUCTION_GOALS.map((goal) => (
                          <div key={goal.id} className="rounded-xl border border-[#242428] bg-[#121215] p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                              <h3 className="text-sm font-semibold text-white">{goal.title}</h3>
                              <span className="text-xs text-emerald-400 font-mono font-medium">Owner: {goal.owner}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-2">
                              <span>Current: {goal.current}</span>
                              <span>Target: {goal.target}</span>
                            </div>
                            <div className="h-2 w-full bg-[#202026] rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${goal.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View J: Meetings Log (/dashboard/meetings) */}
                  {activePath.startsWith("/dashboard/meetings") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Structured Syncs & Standups</h1>
                          <p className="text-xs text-zinc-400">Synthesized meeting records linking discussions to immutable decisions.</p>
                        </div>
                      </div>

                      <div className="grid gap-3.5">
                        {PRODUCTION_MEETINGS.map((m) => (
                          <div key={m.id} className="rounded-xl border border-[#242428] bg-[#121215] p-5 hover:border-[#383842] transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <h3 className="text-sm font-semibold text-white">{m.title}</h3>
                              <span className="text-xs text-zinc-400 font-mono">{m.date}</span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed mb-3">{m.summary}</p>
                            <div className="rounded-lg bg-[#18181C] p-3 text-xs text-zinc-300 border border-[#202026]">
                              <span className="font-semibold text-emerald-400">Outcome: </span>
                              {m.decision}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View K: Activity Timeline (/dashboard/timeline) */}
                  {activePath.startsWith("/dashboard/timeline") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Company Timeline</h1>
                          <p className="text-xs text-zinc-400">Append-only audit trail of decisions, documents, and infrastructure events.</p>
                        </div>
                      </div>

                      <div className="relative pl-6 border-l border-[#242428] space-y-6">
                        {PRODUCTION_TIMELINE.map((tl) => (
                          <div key={tl.id} className="relative group">
                            <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-[#18181B] border-2 border-blue-500" />
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                              <span className="font-mono">{tl.date}</span>
                              <span>•</span>
                              <span>{tl.author}</span>
                              <span>•</span>
                              <span className="text-blue-400">{tl.category}</span>
                            </div>
                            <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                              {tl.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View L: Brain & Knowledge Hub (/dashboard/brain or /dashboard/knowledge) */}
                  {(activePath.startsWith("/dashboard/brain") || activePath.startsWith("/dashboard/knowledge")) && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Organizational Memory Engine</h1>
                          <p className="text-xs text-zinc-400">Synchronized company intelligence across code, ADRs, finance, and documentation.</p>
                        </div>
                      </div>

                      <div className="grid gap-3.5 sm:grid-cols-3">
                        <div className="rounded-xl border border-[#242428] bg-[#121215] p-4 text-center">
                          <div className="text-2xl font-bold text-white font-mono">142</div>
                          <div className="text-xs text-zinc-400 mt-1">Indexed Documents</div>
                        </div>
                        <div className="rounded-xl border border-[#242428] bg-[#121215] p-4 text-center">
                          <div className="text-2xl font-bold text-emerald-400 font-mono">48</div>
                          <div className="text-xs text-zinc-400 mt-1">Architectural Decisions</div>
                        </div>
                        <div className="rounded-xl border border-[#242428] bg-[#121215] p-4 text-center">
                          <div className="text-2xl font-bold text-blue-400 font-mono">1,420</div>
                          <div className="text-xs text-zinc-400 mt-1">Topological Edges</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#242428] bg-[#121215] p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-white">Active Knowledge Ingestion Channels</h3>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="p-3 rounded-lg bg-[#18181D] border border-[#202026] flex items-center justify-between">
                            <span className="text-zinc-200">GitHub Repositories (acme-corp/*)</span>
                            <span className="text-emerald-400">Continuous Sync</span>
                          </div>
                          <div className="p-3 rounded-lg bg-[#18181D] border border-[#202026] flex items-center justify-between">
                            <span className="text-zinc-200">Stripe Live Webhook Stream</span>
                            <span className="text-emerald-400">Sub-100ms Ingestion</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View M: People & Teams Directory (/dashboard/people or /dashboard/teams) */}
                  {(activePath.startsWith("/dashboard/people") || activePath.startsWith("/dashboard/teams")) && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Team & Permissions</h1>
                          <p className="text-xs text-zinc-400">Active organization members, access roles, and domain scopes.</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#242428] bg-[#121215] overflow-hidden divide-y divide-[#1E1E22]">
                        {PRODUCTION_MEMBERS.map((member) => (
                          <div key={member.id} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-semibold text-xs border border-blue-500/30">
                                {member.name[0]}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{member.name}</div>
                                <div className="text-xs text-zinc-400">{member.email}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-white">{member.role}</div>
                              <div className="text-[11px] text-zinc-400">{member.department}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View N: GitHub Connected Workspace (/dashboard/github) */}
                  {activePath.startsWith("/dashboard/github") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">GitHub Workspace</h1>
                          <p className="text-xs text-zinc-400">Connected pull requests, commit streams, and linked architectural decisions.</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#242428] bg-[#121215] overflow-hidden divide-y divide-[#1E1E22]">
                        {PRODUCTION_GITHUB_PRS.map((pr) => (
                          <div key={pr.id} className="p-4 flex items-center justify-between hover:bg-[#18181D] transition-colors">
                            <div className="flex items-center gap-3">
                              <GitBranch className="h-4 w-4 text-purple-400 shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-white">#{pr.number} {pr.title}</div>
                                <div className="text-xs text-zinc-400 mt-0.5">By {pr.author} • {pr.time}</div>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-emerald-400 font-mono">{pr.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View O: Calendar (/dashboard/calendar) */}
                  {activePath.startsWith("/dashboard/calendar") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Sprint & Architecture Calendar</h1>
                          <p className="text-xs text-zinc-400">Upcoming engineering milestones, architectural reviews, and billing cycles.</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#242428] bg-[#121215] p-5">
                          <div className="text-xs font-mono text-blue-400 mb-1">Today • 14:00 UTC</div>
                          <h3 className="text-sm font-semibold text-white mb-2">Monotonic OCC Engine Review</h3>
                          <p className="text-xs text-zinc-400">Reviewing PR #142 with Elena Rostova and Sarah Chen.</p>
                        </div>
                        <div className="rounded-xl border border-[#242428] bg-[#121215] p-5">
                          <div className="text-xs font-mono text-emerald-400 mb-1">Tomorrow • 10:00 UTC</div>
                          <h3 className="text-sm font-semibold text-white mb-2">Stripe Upfront Day-3 Trial Execution</h3>
                          <p className="text-xs text-zinc-400">Scheduled automated transition from trial to paid starter tier.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View P: Email & Communications (/dashboard/email) */}
                  {activePath.startsWith("/dashboard/email") && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-bold text-white tracking-tight">Executive Communications</h1>
                          <p className="text-xs text-zinc-400">Automated summaries, trial notifications, and weekly telemetry digests.</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#242428] bg-[#121215] p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[#1E1E22]">
                          <div>
                            <div className="text-sm font-medium text-white">Daily Company Memory Digest</div>
                            <div className="text-xs text-zinc-400">Sent to all 14 team members • 3 new ADRs merged today</div>
                          </div>
                          <span className="text-xs font-mono text-zinc-400">08:00 AM</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">Stripe Upfront Trial Started: Apex Labs</div>
                            <div className="text-xs text-zinc-400">Card pre-authorized • €2,485 MRR snapshot updated</div>
                          </div>
                          <span className="text-xs font-mono text-zinc-400">14 min ago</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View Q: Default / Fallback for other routes */}
                  {activePath !== "/dashboard" &&
                    activePath !== "/dashboard/connections" &&
                    activePath !== "/dashboard/finance" &&
                    activePath !== "/dashboard/pages" &&
                    activePath !== "/dashboard/decisions" &&
                    !activePath.startsWith("/dashboard/projects") &&
                    !activePath.startsWith("/dashboard/tasks") &&
                    !activePath.startsWith("/dashboard/goals") &&
                    !activePath.startsWith("/dashboard/meetings") &&
                    !activePath.startsWith("/dashboard/timeline") &&
                    !activePath.startsWith("/dashboard/brain") &&
                    !activePath.startsWith("/dashboard/knowledge") &&
                    !activePath.startsWith("/dashboard/people") &&
                    !activePath.startsWith("/dashboard/teams") &&
                    !activePath.startsWith("/dashboard/github") &&
                    !activePath.startsWith("/dashboard/calendar") &&
                    !activePath.startsWith("/dashboard/email") &&
                    !activePageRecord && (
                      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4 animate-in fade-in duration-200">
                        <div className="h-10 w-10 rounded-xl bg-[#18181D] border border-[#242428] flex items-center justify-center text-zinc-300">
                          <Layers className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-white">Section: {activePath}</h2>
                          <p className="text-xs text-zinc-400 max-w-sm mt-1">
                            This workspace module is fully functional in your authenticated BusinessBrain account.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleNavigate("/dashboard")}
                            className="rounded-lg bg-[#202024] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#28282E] transition-colors"
                          >
                            Return to Executive Home
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNavigate("/dashboard/connections")}
                            className="rounded-lg border border-[#28282E] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#18181D] transition-colors"
                          >
                            View Company Graph
                          </button>
                        </div>
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
