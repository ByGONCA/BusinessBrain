/**
 * Shared Fictional Demonstration Dataset for BusinessBrain
 *
 * Provides internally consistent, cross-linked demonstration entities for the
 * interactive workstation demo on the marketing landing page.
 * Completely client-side, zero backend mutations, zero secret leakage.
 */

export interface DemoPage {
  id: string;
  title: string;
  category: "Strategy" | "Product" | "Architecture" | "Finance";
  author: string;
  updatedAt: string;
  revision: number;
  snippet: string;
  blocks: {
    type: "paragraph" | "callout" | "link" | "list";
    content: string;
    meta?: {
      targetId?: string;
      targetType?: "decision" | "repo" | "page";
      calloutType?: "info" | "success" | "warning";
    };
  }[];
  linkedDecisionIds: string[];
}

export interface DemoDecision {
  id: string;
  code: string;
  title: string;
  status: "Accepted" | "Under Review" | "Superseded";
  date: string;
  drivers: string[];
  context: string;
  decision: string;
  consequences: string;
  linkedPageId?: string;
}

export interface DemoGraphNode {
  id: string;
  title: string;
  type: "page" | "decision" | "project" | "repo" | "meeting";
  typeLabel: string;
  summary: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  connections: string[];
  referenceId?: string; // id of page or decision
}

export interface DemoFinanceMetric {
  mrr: string;
  mrrGrowth: string;
  arr: string;
  churnRate: string;
  netRevenue: string;
  activeSubscriptions: number;
  tierBreakdown: {
    tier: string;
    count: number;
    sharePercentage: number;
  }[];
  history: { month: string; value: number }[];
}

export interface DemoTelemetryEvent {
  id: string;
  source: "github" | "stripe" | "slack" | "system";
  sourceName: string;
  time: string;
  message: string;
  status: "success" | "info" | "warning";
}

// -----------------------------------------------------------------------------
// 1. Fictional Workspace Pages
// -----------------------------------------------------------------------------
export const DEMO_PAGES: DemoPage[] = [
  {
    id: "page-strategy",
    title: "Company Strategy 2026: The Connected Memory Layer",
    category: "Strategy",
    author: "Sarah Chen (CEO)",
    updatedAt: "18m ago",
    revision: 14,
    snippet: "Unifying institutional knowledge, architectural decisions, and telemetry into an active operating system.",
    blocks: [
      {
        type: "paragraph",
        content:
          "Modern companies lose critical operational context as information fragments across ephemeral chat threads, stale docs, and unlinked repositories. Our mission for 2026 is establishing BusinessBrain as the permanent memory layer.",
      },
      {
        type: "callout",
        content:
          "Key Objective: Connect every strategic deliverable to an Architectural Decision Record (ADR) and its corresponding GitHub pull requests.",
        meta: { calloutType: "info" },
      },
      {
        type: "paragraph",
        content:
          "All team leads must ensure workspace documentation preserves bidirectional references to accepted decisions before engineering execution commences.",
      },
    ],
    linkedDecisionIds: ["adr-014", "adr-031"],
  },
  {
    id: "page-roadmap",
    title: "Product Roadmap: Topological Graph & Real-Time Sync",
    category: "Product",
    author: "Marcus Vance (CPO)",
    updatedAt: "2h ago",
    revision: 21,
    snippet: "Milestone schedule for $O(V + E)$ cycle-safe BFS graph traversal and live integrations telemetry.",
    blocks: [
      {
        type: "paragraph",
        content:
          "The Company Graph enables cross-functional visibility by mapping relationships between strategic decisions, code pull requests, and meetings. This quarter's focus is multi-tenant topological visualization.",
      },
      {
        type: "callout",
        content:
          "Target Milestone: Sub-50ms deterministic BFS traversal across up to 5,000 organizational nodes.",
        meta: { calloutType: "success" },
      },
      {
        type: "paragraph",
        content:
          "Initial performance benchmarks completed successfully. Cycle detection ensures zero client crash states during circular link resolution.",
      },
    ],
    linkedDecisionIds: ["adr-028"],
  },
  {
    id: "page-occ-spec",
    title: "Engineering Specification: Monotonic OCC v14",
    category: "Architecture",
    author: "Elena Rostova (VP Eng)",
    updatedAt: "Yesterday",
    revision: 14,
    snippet: "Clock-independent optimistic concurrency control preventing document overwrite collisions.",
    blocks: [
      {
        type: "paragraph",
        content:
          "Distributed teams editing shared documentation require bulletproof conflict resolution. BusinessBrain uses monotonic revision tokens (`revision_id`) verified on write mutations.",
      },
      {
        type: "callout",
        content:
          "Integrity Rule: Stale tokens trigger immediate 409 Conflict, preserving local unsaved drafts in memory without data loss.",
        meta: { calloutType: "warning" },
      },
      {
        type: "paragraph",
        content:
          "Pessimistic row locking is strictly confined to multi-page reorder transactions to prevent deadlocks.",
      },
    ],
    linkedDecisionIds: ["adr-022"],
  },
  {
    id: "page-billing-spec",
    title: "Monetization & 3-Day Trial Gating Architecture",
    category: "Finance",
    author: "David Kim (Finance Dir)",
    updatedAt: "3d ago",
    revision: 8,
    snippet: "Transparent three-day free trial, upfront payment verification, and automated Day 3 billing.",
    blocks: [
      {
        type: "paragraph",
        content:
          "To align product evaluation with genuine user commitment, BusinessBrain operates on a paid-only subscription model with a 3-day unrestricted free trial.",
      },
      {
        type: "callout",
        content:
          "Billing Terms: Payment method is validated upfront at checkout. Customers are billed on Day 3 unless canceled in workspace settings.",
        meta: { calloutType: "info" },
      },
      {
        type: "paragraph",
        content:
          "Server-side entitlements check `hasAuthenticatedUser() -> hasOrganization() -> hasActiveEntitlement()` on every dashboard route.",
      },
    ],
    linkedDecisionIds: ["adr-014"],
  },
];

// -----------------------------------------------------------------------------
// 2. Fictional Architectural Decision Records (ADRs)
// -----------------------------------------------------------------------------
export const DEMO_DECISIONS: DemoDecision[] = [
  {
    id: "adr-014",
    code: "ADR-014",
    title: "Standardized 3-Day Free Trial & Upfront Card Validation",
    status: "Accepted",
    date: "2026-08-14",
    drivers: ["Executive Leadership", "Finance Team", "Product Strategy"],
    context:
      "Permanent free tiers create unsustainable infrastructure load and poor customer qualification. We require a conversion mechanism that allows full evaluation while verifying intent.",
    decision:
      "Implement an unrestricted 3-day free trial on all plans. Require valid payment method upfront via Stripe Checkout. Automate first charge on Day 3 with clear self-serve cancellation instructions.",
    consequences:
      "Greatly increases conversion quality, eliminates bot workspace creation, and guarantees zero billing surprises through transparent pre-charge notices.",
    linkedPageId: "page-billing-spec",
  },
  {
    id: "adr-022",
    code: "ADR-022",
    title: "Multi-Tenant Row-Level Security Defense-in-Depth",
    status: "Accepted",
    date: "2026-07-28",
    drivers: ["Security Lead", "Core Infrastructure"],
    context:
      "Enterprise customers require absolute cryptographic isolation of company memory, documents, and financial metrics.",
    decision:
      "Enforce PostgreSQL Row Level Security (RLS) on all tenant tables with `organization_id` mandatory foreign keys. Reject application-only filtering.",
    consequences:
      "Guarantees zero cross-tenant data leakage even in the event of an application-layer routing bug.",
    linkedPageId: "page-occ-spec",
  },
  {
    id: "adr-028",
    code: "ADR-028",
    title: "Deterministic BFS Traversal for Connections Graph",
    status: "Accepted",
    date: "2026-08-02",
    drivers: ["Graph Architecture Team"],
    context:
      "Entity networks in growing companies can develop circular dependencies (e.g. Page A -> Decision B -> Page A). Traversal must be cycle-safe.",
    decision:
      "Use an iterative Breadth-First Search (BFS) with a visited node set and deterministic lock-ordering. Traversal complexity bounded to O(V + E).",
    consequences:
      "Prevents infinite recursion, delivers instant shortest-path evaluation, and maintains sub-50ms rendering performance.",
    linkedPageId: "page-roadmap",
  },
  {
    id: "adr-031",
    code: "ADR-031",
    title: "Tiered AI Usage & Cost-Control Boundaries",
    status: "Accepted",
    date: "2026-08-20",
    drivers: ["AI Infrastructure", "Finance Team"],
    context:
      "Unbounded generative model queries on trial accounts risk runaway provider inference costs and vulnerability to abuse.",
    decision:
      "Establish strict server-side credit quotas (100 credits for 3-day trial accounts) and route trial queries through fast, cost-effective models (Gemini 1.5 Flash). Reserve extended reasoning for paid tiers.",
    consequences:
      "Bounds maximum provider expenditure per trial user to sub-€0.05 while preserving full context evaluation quality.",
    linkedPageId: "page-strategy",
  },
];

// -----------------------------------------------------------------------------
// 3. Fictional Company Graph Nodes & Connections
// -----------------------------------------------------------------------------
export const DEMO_GRAPH_NODES: DemoGraphNode[] = [
  {
    id: "node-page-strat",
    title: "Company Strategy 2026",
    type: "page",
    typeLabel: "Page",
    summary: "Permanent memory layer vision and organizational alignment goals.",
    x: 25,
    y: 30,
    connections: ["node-adr-014", "node-adr-031", "node-proj-billing"],
    referenceId: "page-strategy",
  },
  {
    id: "node-adr-014",
    title: "ADR-014: 3-Day Trial",
    type: "decision",
    typeLabel: "Decision",
    summary: "Standardized 3-day free trial with upfront payment verification.",
    x: 48,
    y: 22,
    connections: ["node-page-strat", "node-proj-billing", "node-meet-exec"],
    referenceId: "adr-014",
  },
  {
    id: "node-proj-billing",
    title: "Stripe Connect Infrastructure",
    type: "project",
    typeLabel: "Project",
    summary: "Automated webhook handling, trial gating, and customer portal.",
    x: 72,
    y: 35,
    connections: ["node-adr-014", "node-repo-core"],
  },
  {
    id: "node-repo-core",
    title: "github/acme-core-api",
    type: "repo",
    typeLabel: "Repository",
    summary: "Core backend services with 32 merged PRs and OCC verification.",
    x: 82,
    y: 65,
    connections: ["node-proj-billing", "node-adr-028"],
  },
  {
    id: "node-adr-028",
    title: "ADR-028: BFS Graph Engine",
    type: "decision",
    typeLabel: "Decision",
    summary: "Deterministic O(V + E) cycle-safe relationship traversal.",
    x: 55,
    y: 75,
    connections: ["node-repo-core", "node-page-roadmap"],
    referenceId: "adr-028",
  },
  {
    id: "node-page-roadmap",
    title: "Product Roadmap Q3",
    type: "page",
    typeLabel: "Page",
    summary: "Topological graph visualizer milestones and deliverables.",
    x: 25,
    y: 70,
    connections: ["node-adr-028", "node-meet-exec"],
    referenceId: "page-roadmap",
  },
  {
    id: "node-meet-exec",
    title: "Executive Revenue Review",
    type: "meeting",
    typeLabel: "Meeting",
    summary: "Bi-weekly alignment on MRR growth, unit economics, and trial conversion.",
    x: 45,
    y: 50,
    connections: ["node-adr-014", "node-page-roadmap", "node-page-strat"],
  },
];

// -----------------------------------------------------------------------------
// 4. Fictional Corporate Finance Datasets
// -----------------------------------------------------------------------------
export const DEMO_FINANCE_DATA: Record<"30d" | "q3" | "ytd", DemoFinanceMetric> = {
  "30d": {
    mrr: "€24,850",
    mrrGrowth: "+14.2%",
    arr: "€298,200",
    churnRate: "0.8%",
    netRevenue: "€28,420",
    activeSubscriptions: 312,
    tierBreakdown: [
      { tier: "Starter (€19/mo)", count: 180, sharePercentage: 58 },
      { tier: "Pro (€79/mo)", count: 118, sharePercentage: 38 },
      { tier: "Enterprise", count: 14, sharePercentage: 4 },
    ],
    history: [
      { month: "W1", value: 21500 },
      { month: "W2", value: 22800 },
      { month: "W3", value: 23900 },
      { month: "W4", value: 24850 },
    ],
  },
  q3: {
    mrr: "€24,850",
    mrrGrowth: "+38.6%",
    arr: "€298,200",
    churnRate: "1.1%",
    netRevenue: "€71,200",
    activeSubscriptions: 312,
    tierBreakdown: [
      { tier: "Starter (€19/mo)", count: 180, sharePercentage: 58 },
      { tier: "Pro (€79/mo)", count: 118, sharePercentage: 38 },
      { tier: "Enterprise", count: 14, sharePercentage: 4 },
    ],
    history: [
      { month: "Jul", value: 17900 },
      { month: "Aug", value: 21200 },
      { month: "Sep", value: 24850 },
    ],
  },
  ytd: {
    mrr: "€24,850",
    mrrGrowth: "+114.0%",
    arr: "€298,200",
    churnRate: "0.9%",
    netRevenue: "€184,500",
    activeSubscriptions: 312,
    tierBreakdown: [
      { tier: "Starter (€19/mo)", count: 180, sharePercentage: 58 },
      { tier: "Pro (€79/mo)", count: 118, sharePercentage: 38 },
      { tier: "Enterprise", count: 14, sharePercentage: 4 },
    ],
    history: [
      { month: "Q1", value: 11600 },
      { month: "Q2", value: 17900 },
      { month: "Q3", value: 24850 },
    ],
  },
};

// -----------------------------------------------------------------------------
// 5. Fictional Live Integration Telemetry Events
// -----------------------------------------------------------------------------
export const DEMO_TELEMETRY: DemoTelemetryEvent[] = [
  {
    id: "telem-1",
    source: "github",
    sourceName: "GitHub Integration",
    time: "3m ago",
    message: "Pull request #42 merged: 'feat(billing): 3-day trial webhook handler'. Linked to ADR-014.",
    status: "success",
  },
  {
    id: "telem-2",
    source: "stripe",
    sourceName: "Stripe Connect",
    time: "14m ago",
    message: "Customer trial started for 'Apex Labs'. Upfront payment method verified. Day 3 charge scheduled.",
    status: "info",
  },
  {
    id: "telem-3",
    source: "slack",
    sourceName: "Slack Decision Bot",
    time: "42m ago",
    message: "Captured architectural thread in #eng-leadership: 'Ratified ADR-031 AI credit quotas'.",
    status: "success",
  },
  {
    id: "telem-4",
    source: "system",
    sourceName: "Company Graph Engine",
    time: "1h ago",
    message: "Recomputed graph topology. 389 entities and 612 edges verified with zero cycles.",
    status: "info",
  },
];
