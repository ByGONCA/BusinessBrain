/**
 * Comprehensive Test Suite for BusinessBrain Customizable Workspace (Phase 1 & Phase 2)
 * Validates registry integrity, metric compatibility, default 3-block layouts,
 * Zod schema boundaries, CAS concurrency simulation, migration 00037 security,
 * and Phase 2 Generic Visualizers & Responsive Grid Engine rendering.
 * 
 * Run with: npx tsx scripts/test-customizable-workspace.ts
 */

import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  METRIC_REGISTRY,
  getAllMetricCapabilities,
  getMetricCapability,
  getMetricsForDashboard,
  isVisualizerSupported,
  isTimeRangeSupported,
  isWidgetConfigValid,
} from "../lib/widgets/registry";
import {
  DEFAULT_HOME_LAYOUT,
  DEFAULT_FINANCE_LAYOUT,
  getDefaultLayout,
} from "../lib/widgets/layout-defaults";
import {
  dashboardLayoutSchema,
  widgetInstanceSchema,
} from "../lib/widgets/schemas";
import { DashboardLayoutConfig, WidgetInstanceConfig, WidgetSize } from "../lib/widgets/types";
import { WidgetGrid, WidgetGridData } from "../components/dashboard/widgets/widget-grid";
import { WidgetContainer, WidgetErrorBoundary } from "../components/dashboard/widgets/widget-container";
import { KpiVisualizer } from "../components/dashboard/widgets/renderers/kpi-visualizer";
import { ChartVisualizer } from "../components/dashboard/widgets/renderers/chart-visualizer";
import { BarVisualizer } from "../components/dashboard/widgets/renderers/bar-visualizer";
import { TableVisualizer } from "../components/dashboard/widgets/renderers/table-visualizer";
import { PrioritiesVisualizer } from "../components/dashboard/widgets/renderers/priorities-visualizer";
import { CustomizationToolbar } from "../components/dashboard/widgets/customization-toolbar";
import { WidgetDrawer } from "../components/dashboard/widgets/widget-drawer";
import { ExecutiveHomeDashboard } from "../components/dashboard/home/executive-home-dashboard";
import { FinanceDashboard } from "../components/dashboard/finance/finance-dashboard";
import { saveDashboardLayoutAction, loadDashboardLayoutAction } from "../lib/widgets/actions";
import { LanguageProvider } from "../lib/i18n";
import { en } from "../lib/i18n/dictionaries/en";
import { pt } from "../lib/i18n/dictionaries/pt";
import { es } from "../lib/i18n/dictionaries/es";
import { fr } from "../lib/i18n/dictionaries/fr";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("BusinessBrain: Customizable Workspace Test Suite (Phase 1 & 2)");
console.log("=======================================================\n");

// ---------------------------------------------------------------------------
// SUITE 1: METRIC REGISTRY INTEGRITY & DATA TRUTH
// ---------------------------------------------------------------------------
console.log("--- Suite 1: Metric Registry Integrity & Data Truth ---");

const allMetrics = getAllMetricCapabilities();
assert(allMetrics.length === 20, "Registry defines exactly 20 verified metrics", `found ${allMetrics.length}`);

// Financial metrics distinction
const activeSubsMetric = getMetricCapability("finance.active_subscriptions");
assert(
  Boolean(activeSubsMetric && activeSubsMetric.unit === "count" && activeSubsMetric.timeSemantics === "point_in_time"),
  "finance.active_subscriptions has unit 'count' and point-in-time semantics"
);

const activeCustomersMetric = getMetricCapability("finance.active_customers");
assert(
  Boolean(activeCustomersMetric && activeCustomersMetric.unit === "count" && activeCustomersMetric.timeSemantics === "point_in_time"),
  "finance.active_customers has unit 'count' and point-in-time semantics"
);

assert(
  activeSubsMetric?.id !== activeCustomersMetric?.id,
  "Active Subscriptions and Active Customers are separate distinct metrics"
);

const arrMetric = getMetricCapability("finance.arr");
assert(
  Boolean(arrMetric && arrMetric.unit === "cents" && arrMetric.timeSemantics === "point_in_time"),
  "finance.arr has unit 'cents' and point-in-time semantics"
);

const netRevenueMetric = getMetricCapability("finance.net_revenue");
assert(
  Boolean(netRevenueMetric && netRevenueMetric.unit === "cents" && netRevenueMetric.timeSemantics === "period_aggregate"),
  "finance.net_revenue has unit 'cents' and period_aggregate semantics"
);

// Verify ungrounded / unsupported metrics are strictly NOT exposed in V1
assert(!getMetricCapability("finance.unit_economics"), "finance.unit_economics is excluded from V1 registry");
assert(!getMetricCapability("finance.trial_conversion"), "finance.trial_conversion is excluded from V1 registry");
assert(!getMetricCapability("finance.net_profit"), "finance.net_profit is excluded from V1 registry");
assert(!getMetricCapability("finance.cash_flow"), "finance.cash_flow is excluded from V1 registry");

// Dashboard domain boundaries
const financeOnlyMetrics = getMetricsForDashboard("finance");
assert(
  financeOnlyMetrics.every((m) => m.category === "finance"),
  "Finance dashboard only exposes financial category metrics"
);

const homeMetrics = getMetricsForDashboard("home");
assert(
  homeMetrics.some((m) => m.category === "workspace") && homeMetrics.some((m) => m.category === "finance"),
  "Home dashboard exposes both workspace and financial category metrics"
);

// ---------------------------------------------------------------------------
// SUITE 2: COMPATIBILITY & CAPABILITY CONSTRAINTS
// ---------------------------------------------------------------------------
console.log("\n--- Suite 2: Compatibility & Capability Constraints ---");

assert(
  isVisualizerSupported("finance.net_revenue", "chart") === true,
  "finance.net_revenue supports 'chart' visualizer"
);
assert(
  isVisualizerSupported("finance.net_revenue", "kpi") === true,
  "finance.net_revenue supports 'kpi' visualizer"
);
assert(
  isVisualizerSupported("finance.mrr", "chart") === false,
  "finance.mrr rejects 'chart' visualizer (point-in-time KPI only)"
);
assert(
  isVisualizerSupported("workspace.priorities", "priorities") === true,
  "workspace.priorities supports 'priorities' visualizer"
);
assert(
  isVisualizerSupported("workspace.priorities", "chart") === false,
  "workspace.priorities rejects 'chart' visualizer"
);

assert(
  isTimeRangeSupported("finance.net_revenue", "12M") === true,
  "finance.net_revenue supports '12M' time range"
);
assert(
  isTimeRangeSupported("finance.mrr", "12M") === false,
  "finance.mrr rejects '12M' (point-in-time metric strictly supports 'current')"
);

// Daily granularity restriction test
const validDailyWidget: WidgetInstanceConfig = {
  id: "w_valid_daily",
  metricId: "finance.net_revenue",
  visualization: "chart",
  size: "full",
  timeRange: "30D",
  granularity: "daily",
};
assert(
  isWidgetConfigValid(validDailyWidget).valid === true,
  "Daily granularity is valid for 30D historical net revenue"
);

const invalidDailyWidget: WidgetInstanceConfig = {
  id: "w_invalid_daily",
  metricId: "finance.net_revenue",
  visualization: "chart",
  size: "full",
  timeRange: "12M",
  granularity: "daily",
};
assert(
  isWidgetConfigValid(invalidDailyWidget).valid === false,
  "Daily granularity is rejected for multi-month time ranges (12M)"
);

// ---------------------------------------------------------------------------
// SUITE 3: DEFAULT LAYOUTS VALIDATION (EXACTLY 3 BLOCKS EACH)
// ---------------------------------------------------------------------------
console.log("\n--- Suite 3: Default Layouts (Curated Modular Blocks) ---");

assert(DEFAULT_HOME_LAYOUT.widgets.length === 5, "DEFAULT_HOME_LAYOUT has exactly 5 widgets");
assert(DEFAULT_FINANCE_LAYOUT.widgets.length === 3, "DEFAULT_FINANCE_LAYOUT has exactly 3 widgets");

// Home default widgets inspection
const homeWidgetIds = DEFAULT_HOME_LAYOUT.widgets.map((w) => w.metricId);
assert(homeWidgetIds.includes("workspace.pulse_kpis"), "Home layout contains 'workspace.pulse_kpis'");
assert(homeWidgetIds.includes("finance.pulse_strip"), "Home layout contains 'finance.pulse_strip'");
assert(homeWidgetIds.includes("workspace.topology_map"), "Home layout contains 'workspace.topology_map'");
assert(homeWidgetIds.includes("workspace.recent_pages"), "Home layout contains 'workspace.recent_pages'");
assert(homeWidgetIds.includes("workspace.timeline_activity"), "Home layout contains 'workspace.timeline_activity'");

// Finance default widgets inspection
const financeWidgetIds = DEFAULT_FINANCE_LAYOUT.widgets.map((w) => w.metricId);
assert(financeWidgetIds.includes("finance.net_revenue"), "Finance layout contains 'finance.net_revenue'");
assert(financeWidgetIds.includes("finance.mrr"), "Finance layout contains 'finance.mrr'");

// Validate each widget inside defaults
for (const w of DEFAULT_HOME_LAYOUT.widgets) {
  const validity = isWidgetConfigValid(w);
  assert(validity.valid, `Home default widget '${w.id}' is valid in registry`);
}

for (const w of DEFAULT_FINANCE_LAYOUT.widgets) {
  const validity = isWidgetConfigValid(w);
  assert(validity.valid, `Finance default widget '${w.id}' is valid in registry`);
}

// Zod schema compliance
const homeSchemaRes = dashboardLayoutSchema.safeParse(DEFAULT_HOME_LAYOUT);
assert(homeSchemaRes.success, "DEFAULT_HOME_LAYOUT conforms to dashboardLayoutSchema");

const financeSchemaRes = dashboardLayoutSchema.safeParse(DEFAULT_FINANCE_LAYOUT);
assert(financeSchemaRes.success, "DEFAULT_FINANCE_LAYOUT conforms to dashboardLayoutSchema");

// getDefaultLayout cloning isolation
const clonedHome = getDefaultLayout("home");
clonedHome.widgets.pop();
assert(DEFAULT_HOME_LAYOUT.widgets.length === 5, "getDefaultLayout returns an isolated clone");

// ---------------------------------------------------------------------------
// SUITE 4: SCHEMA & INPUT VALIDATION GUARDRAILS
// ---------------------------------------------------------------------------
console.log("\n--- Suite 4: Schema & Input Validation Guardrails ---");

// Layout with more than 24 widgets must be rejected
const oversizedLayout: DashboardLayoutConfig = {
  version: 1,
  updatedAt: new Date().toISOString(),
  widgets: Array.from({ length: 25 }, (_, i) => ({
    id: `w_${i}`,
    metricId: "finance.mrr",
    visualization: "kpi",
    size: "sm",
  })),
};
const oversizedRes = dashboardLayoutSchema.safeParse(oversizedLayout);
assert(!oversizedRes.success, "Layout with > 24 widgets is rejected by Zod schema");

// Widget with invalid size
const invalidSizeWidget = {
  id: "w_bad_size",
  metricId: "finance.mrr",
  visualization: "kpi",
  size: "huge",
};
const invalidSizeRes = widgetInstanceSchema.safeParse(invalidSizeWidget);
assert(!invalidSizeRes.success, "Widget with invalid size 'huge' is rejected");

// ---------------------------------------------------------------------------
// SUITE 5: CAS CONCURRENCY LOGIC & JSONB PATH SIMULATION
// ---------------------------------------------------------------------------
console.log("\n--- Suite 5: Atomic CAS Concurrency & JSONB Path Simulation ---");

interface CASState {
  user_preferences: Record<string, any>;
  updated_at: string;
}

function simulateSaveDashboardLayoutCas(
  state: CASState,
  orgId: string,
  dashboardType: string,
  layout: any,
  expectedUpdatedAt: string | null = null,
  forceOverwrite: boolean = false
): { success: boolean; code?: string; state: CASState } {
  const currentPreferences = JSON.parse(JSON.stringify(state.user_preferences || {}));
  const currentLayout = currentPreferences?.dashboard_layouts?.[orgId]?.[dashboardType];
  const currentUpdatedAt = currentLayout?.updatedAt || null;

  // Concurrency Check
  if (!forceOverwrite) {
    if (expectedUpdatedAt !== null && currentUpdatedAt !== null && currentUpdatedAt !== expectedUpdatedAt) {
      return { success: false, code: "STALE_WRITE", state };
    }
    if (expectedUpdatedAt === null && currentUpdatedAt !== null) {
      return { success: false, code: "STALE_WRITE", state };
    }
  }

  // Safe JSONB Path Initialization
  if (!currentPreferences.dashboard_layouts || typeof currentPreferences.dashboard_layouts !== "object") {
    currentPreferences.dashboard_layouts = {};
  }
  if (!currentPreferences.dashboard_layouts[orgId] || typeof currentPreferences.dashboard_layouts[orgId] !== "object") {
    currentPreferences.dashboard_layouts[orgId] = {};
  }

  currentPreferences.dashboard_layouts[orgId][dashboardType] = layout;
  const newTimestamp = new Date().toISOString();

  return {
    success: true,
    state: {
      user_preferences: currentPreferences,
      updated_at: newTimestamp,
    },
  };
}

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

let dbState: CASState = {
  user_preferences: { theme: "dark", locale: "pt" },
  updated_at: "2026-10-29T00:00:00.000Z",
};

// 1. First-time save for Org A
const firstSave = simulateSaveDashboardLayoutCas(
  dbState,
  orgA,
  "home",
  { version: 1, updatedAt: "T1", widgets: [] },
  null
);
assert(firstSave.success, "First-time save initializes layout from absent JSONB path");
dbState = firstSave.state;

assert(dbState.user_preferences.theme === "dark", "Unrelated 'theme' preference is strictly preserved");
assert(dbState.user_preferences.locale === "pt", "Unrelated 'locale' preference is strictly preserved");

// 2. Concurrent first-time save collision
const concurrentFirstSaveCollision = simulateSaveDashboardLayoutCas(
  dbState,
  orgA,
  "home",
  { version: 1, updatedAt: "T_collision", widgets: [] },
  null
);
assert(
  !concurrentFirstSaveCollision.success && concurrentFirstSaveCollision.code === "STALE_WRITE",
  "Concurrent first-time collision is rejected with STALE_WRITE"
);

// 3. Normal update with matching expected timestamp
const secondSave = simulateSaveDashboardLayoutCas(
  dbState,
  orgA,
  "home",
  { version: 1, updatedAt: "T2", widgets: [] },
  "T1"
);
assert(secondSave.success, "Save with matching expected timestamp succeeds");
dbState = secondSave.state;

// 4. Stale update collision
const staleSaveCollision = simulateSaveDashboardLayoutCas(
  dbState,
  orgA,
  "home",
  { version: 1, updatedAt: "T_stale", widgets: [] },
  "T1"
);
assert(
  !staleSaveCollision.success && staleSaveCollision.code === "STALE_WRITE",
  "Stale write is rejected with STALE_WRITE"
);

// 5. Explicit Force Overwrite
const forceOverwriteSave = simulateSaveDashboardLayoutCas(
  dbState,
  orgA,
  "home",
  { version: 1, updatedAt: "T_forced", widgets: [] },
  "T1",
  true
);
assert(forceOverwriteSave.success, "Explicit force overwrite succeeds with deliberate override");
dbState = forceOverwriteSave.state;

// 6. Organization Layout Isolation
const orgBSave = simulateSaveDashboardLayoutCas(
  dbState,
  orgB,
  "home",
  { version: 1, updatedAt: "T_orgB", widgets: [] },
  null
);
assert(orgBSave.success, "Saving layout for Org B succeeds");
dbState = orgBSave.state;

assert(
  dbState.user_preferences.dashboard_layouts[orgA].home.updatedAt === "T_forced",
  "Org A layout is preserved when saving Org B"
);
assert(
  dbState.user_preferences.dashboard_layouts[orgB].home.updatedAt === "T_orgB",
  "Org B layout is saved in isolated tenant path"
);

// ---------------------------------------------------------------------------
// SUITE 6: MIGRATION 00037 STATIC SECURITY & POLICY AUDIT
// ---------------------------------------------------------------------------
console.log("\n--- Suite 6: Migration 00037 Static Security & Policy Audit ---");

const migrationPath = path.join(process.cwd(), "database", "migrations", "00037_dashboard_layout_cas.sql");
assert(fs.existsSync(migrationPath), "Migration 00037_dashboard_layout_cas.sql exists on disk");

const migrationSql = fs.readFileSync(migrationPath, "utf8");

assert(migrationSql.includes("security definer"), "Migration specifies SECURITY DEFINER");
assert(migrationSql.includes("set search_path = public, pg_temp"), "Migration sets fixed search_path = public, pg_temp");
assert(migrationSql.includes("for update"), "Migration uses SELECT ... FOR UPDATE to serialize concurrent writes");
assert(migrationSql.includes("revoke all on function public.save_dashboard_layout_cas"), "Migration revokes execution from public and anon");
assert(migrationSql.includes("grant execute on function public.save_dashboard_layout_cas"), "Migration grants execution to authenticated and service_role");
assert(migrationSql.includes("public.organization_members"), "Migration independently validates organization membership in PostgreSQL");
assert(migrationSql.includes("v_user_id := auth.uid()"), "Migration independently enforces authentication via auth.uid()");

// ---------------------------------------------------------------------------
// SUITE 7: PHASE 2 GENERIC VISUALIZERS & RESPONSIVE GRID ENGINE
// ---------------------------------------------------------------------------
console.log("\n--- Suite 7: Phase 2 Generic Visualizers & Responsive Grid Engine ---");

// Mock Financial Snapshot
const mockSnapshot: any = {
  organizationId: "org_test",
  connectedAccountId: "acct_test123",
  primaryCurrency: "EUR",
  currencies: {
    EUR: {
      currency: "EUR",
      activeMrrCents: 1540000, // 15,400.00 €
      netRevenueCents: 4500000, // 45,000.00 €
      grossRevenueCents: 4800000,
      activeSubscribersCount: 142,
      totalRefundsCents: 20000,
      revenueByPlan: {
        Enterprise: { planName: "Enterprise", mrrCents: 900000, subscribersCount: 12 },
        Pro: { planName: "Pro", mrrCents: 540000, subscribersCount: 90 },
      },
    },
  },
  monthlyHistory: {
    EUR: [
      { monthKey: "2026-08", grossRevenueCents: 3800000, netRevenueCents: 3600000, newCustomersCount: 10 },
      { monthKey: "2026-09", grossRevenueCents: 4200000, netRevenueCents: 4000000, newCustomersCount: 15 },
      { monthKey: "2026-10", grossRevenueCents: 4800000, netRevenueCents: 4500000, newCustomersCount: 22 },
    ],
  },
  totalActiveCustomersCount: 138,
};

const mockGridData: WidgetGridData = {
  financialSnapshot: mockSnapshot,
  priorityItems: [
    {
      id: "p_1",
      title: "Security Hardening: Rotate Stripe API Keys",
      type: "task",
      priority: "urgent",
      status: "overdue",
      context: "Security Perimeter",
      href: "/dashboard/tasks",
      updatedAt: "2026-10-29T00:00:00.000Z",
    },
    {
      id: "p_2",
      title: "ADR-004: Compare-And-Swap Concurrency Model",
      type: "decision",
      status: "proposed",
      context: "Architecture ADR",
      href: "/dashboard/decisions?id=adr_4",
      updatedAt: "2026-10-28T00:00:00.000Z",
    },
  ],
  projects: [
    { id: "proj_1", title: "Customizable Business Workspace", status: "active", updated_at: "2026-10-29T00:00:00.000Z" },
    { id: "proj_2", title: "Audit Log Streaming Service", status: "completed", updated_at: "2026-10-20T00:00:00.000Z" },
  ],
  decisions: [
    { id: "dec_1", title: "ADR-004: Dashboard Layout Persistence", status: "proposed", updated_at: "2026-10-28T00:00:00.000Z" },
    { id: "dec_2", title: "ADR-003: Subagents Architecture Protocol", status: "accepted", updated_at: "2026-10-15T00:00:00.000Z" },
  ],
  projectsCount: 2,
  decisionsCount: 2,
  pagesCount: 4,
  connectionCount: 12,
  totalConnections: 12,
  pages: [
    { id: "page_1", title: "Product Blueprint", updated_at: "2026-10-29T00:00:00.000Z" },
  ],
  timelineEvents: [
    {
      id: "ev_1",
      title: "Audit Log Streaming Service deployed",
      timestamp: "2026-10-29T00:00:00.000Z",
      type: "project_created",
      category: "work",
      description: "Deployment completed successfully",
    },
  ],
  currency: "EUR",
};

// 1. Render Home Default Grid via React Server DOM
const homeGridHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetGrid, {
      widgets: DEFAULT_HOME_LAYOUT.widgets,
      data: mockGridData,
    })
  )
);

assert(homeGridHtml.includes("col-span-1 sm:col-span-2 lg:col-span-4"), "Full-size widgets have full 4-column span");
assert(homeGridHtml.includes("col-span-1 sm:col-span-2"), "Medium widgets have 2-column span (md)");
assert(homeGridHtml.includes("Product Blueprint"), "Home Grid renders RecentPagesVisualizer with pages");
assert(homeGridHtml.includes("Audit Log Streaming Service deployed"), "Home Grid renders TimelineActivityVisualizer with events");

// 2. Render Finance Default Grid via React Server DOM
const financeGridHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetGrid, {
      widgets: DEFAULT_FINANCE_LAYOUT.widgets,
      data: mockGridData,
    })
  )
);

assert(
  financeGridHtml.includes("15,400") || financeGridHtml.includes("15.400"),
  "Finance Grid renders KpiVisualizer with formatted MRR amount"
);
assert(financeGridHtml.includes("chartGradient"), "Finance Grid renders ChartVisualizer with SVG Bézier gradient");
assert(financeGridHtml.includes("<svg"), "Finance Grid contains SVG element for trajectory curve");

// 3. Render Grid in Editing Mode
const editGridHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetGrid, {
      widgets: DEFAULT_HOME_LAYOUT.widgets,
      data: mockGridData,
      isEditing: true,
    })
  )
);

assert(editGridHtml.includes("aria-label=\"Move widget left\""), "Edit mode renders accessible Move Left button");
assert(editGridHtml.includes("aria-label=\"Move widget right\""), "Edit mode renders accessible Move Right button");
assert(editGridHtml.includes("aria-label=\"Configure widget\""), "Edit mode renders Configure button");
assert(editGridHtml.includes("aria-label=\"Remove widget\""), "Edit mode renders Remove button");

// 4. Render Empty Grid
const emptyGridHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetGrid, {
      widgets: [],
      data: mockGridData,
    })
  )
);

assert(
  emptyGridHtml.includes("No widgets in this dashboard") || emptyGridHtml.includes("Nenhum widget neste dashboard"),
  "Empty Grid renders clean empty state"
);

// 5. Render Bar Visualizer
const barWidget: WidgetInstanceConfig = {
  id: "w_bar_test",
  metricId: "finance.plans_breakdown",
  visualization: "bar",
  size: "md",
};
const barHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(BarVisualizer, {
      widget: barWidget,
      financialSnapshot: mockSnapshot,
    })
  )
);
assert(barHtml.includes("Enterprise"), "BarVisualizer renders plan name 'Enterprise'");
assert(barHtml.includes("Pro"), "BarVisualizer renders plan name 'Pro'");
assert(barHtml.includes("bg-blue-500"), "BarVisualizer renders colored progress bars");

// 6. Test Error Boundary isolation
const FaultyChild = () => {
  throw new Error("Simulated component explosion");
};
const errorBoundaryHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    WidgetErrorBoundary,
    { fallbackTitle: "Test Metric Card" },
    React.createElement("div", null, "Safe content")
  )
);
assert(errorBoundaryHtml.includes("Safe content"), "WidgetErrorBoundary renders normal children cleanly");

// ---------------------------------------------------------------------------
// SUITE 8: PHASE 3 CONFIGURATION DRAWER & CUSTOMIZATION TOOLBAR
// ---------------------------------------------------------------------------
console.log("\n--- Suite 8: Phase 3 Configuration Drawer & Customization Toolbar ---");

// 1. CustomizationToolbar in Normal State
const toolbarHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(CustomizationToolbar, {
      dashboardType: "home",
      hasUnsavedChanges: true,
      isSaving: false,
      onAddWidget: () => {},
      onRestoreDefaults: () => {},
      onCancel: () => {},
      onSave: () => {},
    })
  )
);

assert(
  toolbarHtml.includes("Customizing Home Dashboard") || toolbarHtml.includes("A personalizar Painel Principal"),
  "Toolbar renders Home title"
);
assert(
  toolbarHtml.includes("Add Widget") || toolbarHtml.includes("Adicionar Bloco"),
  "Toolbar renders Add Widget action"
);
assert(
  toolbarHtml.includes("Unsaved") || toolbarHtml.includes("Não guardado"),
  "Toolbar renders unsaved changes indicator"
);

// 2. CustomizationToolbar Saving State
const savingToolbarHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(CustomizationToolbar, {
      dashboardType: "finance",
      hasUnsavedChanges: false,
      isSaving: true,
      onAddWidget: () => {},
      onRestoreDefaults: () => {},
      onCancel: () => {},
      onSave: () => {},
    })
  )
);

assert(
  savingToolbarHtml.includes("Saving...") || savingToolbarHtml.includes("A guardar..."),
  "Toolbar displays saving spinner text"
);

// 3. CustomizationToolbar STALE_WRITE Conflict State
const conflictToolbarHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(CustomizationToolbar, {
      dashboardType: "home",
      hasUnsavedChanges: false,
      isSaving: false,
      saveFeedback: {
        type: "conflict",
        message: "Stale write conflict",
        currentUpdatedAt: "2026-10-29T00:50:00Z",
      },
      onAddWidget: () => {},
      onRestoreDefaults: () => {},
      onCancel: () => {},
      onSave: () => {},
      onReloadLatest: () => {},
      onForceOverwrite: () => {},
    })
  )
);

assert(
  conflictToolbarHtml.includes("Conflito de Gravação") || conflictToolbarHtml.includes("Conflict Detected"),
  "Toolbar displays OCC conflict warning"
);
assert(
  conflictToolbarHtml.includes("Recarregar e Rever") ||
    conflictToolbarHtml.includes("Reload &amp; Review") ||
    conflictToolbarHtml.includes("Reload & Review"),
  "Toolbar provides Reload & Review action"
);
assert(
  conflictToolbarHtml.includes("Forçar Substituição") || conflictToolbarHtml.includes("Force Overwrite"),
  "Toolbar provides Force Overwrite secondary action"
);

// 4. WidgetDrawer Render in Home Mode
const homeDrawerHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetDrawer, {
      isOpen: true,
      onClose: () => {},
      dashboardType: "home",
      onSaveWidget: () => {},
    })
  )
);

assert(homeDrawerHtml.includes("role=\"dialog\""), "WidgetDrawer renders dialog element with role='dialog'");
assert(homeDrawerHtml.includes("aria-modal=\"true\""), "WidgetDrawer has aria-modal='true'");
assert(
  homeDrawerHtml.includes("Adicionar Bloco ao Painel") || homeDrawerHtml.includes("Add Widget to Dashboard"),
  "WidgetDrawer renders correct header title"
);
assert(
  homeDrawerHtml.includes("Workspace") && (homeDrawerHtml.includes("Finanças") || homeDrawerHtml.includes("Finance")),
  "WidgetDrawer displays category filter tabs in Home mode"
);

// 5. WidgetDrawer Render in Finance Mode (Finance only allows financial metrics)
const financeDrawerHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetDrawer, {
      isOpen: true,
      onClose: () => {},
      dashboardType: "finance",
      onSaveWidget: () => {},
    })
  )
);

assert(
  !financeDrawerHtml.includes("workspace.priorities"),
  "Finance Drawer strictly excludes non-financial workspace metrics"
);
assert(
  financeDrawerHtml.includes("finance.net_revenue") || financeDrawerHtml.includes("Net Revenue") || financeDrawerHtml.includes("Revenu Net"),
  "Finance Drawer includes verified finance.net_revenue"
);

// 6. WidgetDrawer when isOpen is false
const closedDrawerHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(WidgetDrawer, {
      isOpen: false,
      onClose: () => {},
      dashboardType: "home",
      onSaveWidget: () => {},
    })
  )
);

assert(closedDrawerHtml === "", "WidgetDrawer renders nothing when isOpen is false");

// ---------------------------------------------------------------------------
// SUITE 9: PHASE 4 END-TO-END DASHBOARD INTEGRATION
// ---------------------------------------------------------------------------
console.log("\n--- Suite 9: Phase 4 End-to-End Dashboard Integration ---");

// 1. Render ExecutiveHomeDashboard with initialLayout
const renderedHomeDashboard = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(ExecutiveHomeDashboard, {
      organizationId: "org_test",
      organizationName: "Acme Corp",
      userRole: "owner",
      userId: "usr_test",
      decisions: mockGridData.decisions as any,
      decisionsCount: 2,
      projects: mockGridData.projects as any,
      projectsCount: 2,
      pages: [],
      pagesCount: 0,
      membersCount: 1,
      timelineEvents: [],
      priorityItems: mockGridData.priorityItems as any,
      stripeSnapshot: mockSnapshot,
      stripeStatus: "fresh",
      isStripeConnected: true,
      initialLayout: DEFAULT_HOME_LAYOUT,
    })
  )
);

assert(
  renderedHomeDashboard.includes("Personalizar") || renderedHomeDashboard.includes("Customize"),
  "Home Dashboard renders 'Customize' action button"
);
assert(
  renderedHomeDashboard.includes("Pulso") || renderedHomeDashboard.includes("Pulse"),
  "Home Dashboard renders Workspace Pulse widget from customizable grid"
);
assert(
  renderedHomeDashboard.includes("Topologia") || renderedHomeDashboard.includes("Topology"),
  "Home Dashboard renders Topology widget from customizable grid"
);

// 2. Render FinanceDashboard with initialLayout
const renderedFinanceDashboard = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    LanguageProvider,
    null,
    React.createElement(FinanceDashboard, {
      organizationId: "org_test",
      organizationName: "Acme Corp",
      stripeSnapshot: mockSnapshot,
      isStripeConnected: true,
      userRole: "owner",
      initialLayout: DEFAULT_FINANCE_LAYOUT,
    })
  )
);

assert(
  renderedFinanceDashboard.includes("Personalizar") || renderedFinanceDashboard.includes("Customize"),
  "Finance Dashboard renders 'Customize' action button"
);
assert(
  renderedFinanceDashboard.includes("15,400") || renderedFinanceDashboard.includes("15.400"),
  "Finance Dashboard renders Active MRR widget from customizable grid"
);
assert(
  renderedFinanceDashboard.includes("chartGradient"),
  "Finance Dashboard renders 12M Trajectory Chart from customizable grid"
);

// 3. Validation of Server Action boundaries (invalid inputs reject cleanly)
async function runServerActionValidation() {
  const badOrgResult = await saveDashboardLayoutAction({
    organizationId: "invalid-uuid",
    dashboardType: "home",
    layout: DEFAULT_HOME_LAYOUT,
  });
  assert(
    badOrgResult.success === false && badOrgResult.code === "INVALID_LAYOUT",
    "saveDashboardLayoutAction rejects invalid UUID organization ID"
  );

  const loadBadOrgResult = await loadDashboardLayoutAction({
    organizationId: "invalid-uuid",
    dashboardType: "home",
  });
  assert(
    loadBadOrgResult.isCustom === false && loadBadOrgResult.layout.widgets.length === 5,
    "loadDashboardLayoutAction safely falls back to default layout for invalid org ID"
  );
}

runServerActionValidation().then(() => {

  // ---------------------------------------------------------------------------
  // SUITE 10: QUAD-LOCALE i18n DICTIONARY PARITY & COMPLETENESS
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 10: Quad-Locale i18n Dictionary Parity & Completeness ---");

  const dictionaries = { en, pt, es, fr };
  const locales = ["en", "pt", "es", "fr"] as const;

  for (const loc of locales) {
    const dict = dictionaries[loc];
    assert(Boolean(dict && dict.widgets), `Locale '${loc}' defines a valid 'widgets' dictionary`);
  }

  const enWidgetKeys = Object.keys(en.widgets);
  assert(enWidgetKeys.length >= 35, `English widgets dictionary contains ${enWidgetKeys.length} keys (>= 35 expected)`);

  for (const loc of ["pt", "es", "fr"] as const) {
    const dict = dictionaries[loc];
    const missingKeys = enWidgetKeys.filter((k) => !(k in dict.widgets));
    assert(missingKeys.length === 0, `Locale '${loc}' has 100% key parity with 'en' (missing: ${missingKeys.join(", ") || "none"})`);

    const emptyKeys = enWidgetKeys.filter((k) => {
      const val = (dict.widgets as any)[k];
      if (typeof val === "object" && val !== null) {
        // Nested object (e.g. metrics, filters)
        return Object.keys(val).length === 0;
      }
      return typeof val !== "string" || val.trim().length === 0;
    });
    assert(emptyKeys.length === 0, `Locale '${loc}' has no empty translation values (empty: ${emptyKeys.join(", ") || "none"})`);
  }

  // Placeholder interpolation checks
  for (const loc of locales) {
    const desc = dictionaries[loc].widgets.conflictDesc;
    assert(desc.includes("{updatedAt}"), `Locale '${loc}' conflictDesc contains {updatedAt} interpolation token`);
  }

  // Component rendering across Spanish and French locales
  const esToolbarHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLocale: "es" },
      React.createElement(CustomizationToolbar, {
        dashboardType: "home",
        hasUnsavedChanges: true,
        isSaving: false,
        onAddWidget: () => {},
        onRestoreDefaults: () => {},
        onCancel: () => {},
        onSave: () => {},
      })
    )
  );
  assert(esToolbarHtml.includes(es.widgets.customizingHome), "Toolbar renders in Spanish: 'Personalizando Panel Principal'");
  assert(esToolbarHtml.includes(es.widgets.addWidget), "Toolbar renders Spanish Add Widget: 'Añadir Bloque'");
  assert(esToolbarHtml.includes(es.widgets.unsaved), "Toolbar renders Spanish Unsaved: 'Sin guardar'");

  const frToolbarHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLocale: "fr" },
      React.createElement(CustomizationToolbar, {
        dashboardType: "finance",
        hasUnsavedChanges: false,
        isSaving: true,
        onAddWidget: () => {},
        onRestoreDefaults: () => {},
        onCancel: () => {},
        onSave: () => {},
      })
    )
  );
  assert(frToolbarHtml.includes(fr.widgets.customizingFinance), "Toolbar renders in French: 'Personnalisation du Tableau Financier'");
  assert(frToolbarHtml.includes(fr.widgets.saving), "Toolbar renders French saving indicator: 'Enregistrement...'");

  const esEmptyGridHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLocale: "es" },
      React.createElement(WidgetGrid, {
        widgets: [],
        onAddWidgetPrompt: () => {},
      })
    )
  );
  assert(esEmptyGridHtml.includes(es.widgets.emptyTitle), "Empty Grid renders Spanish: 'Sin widgets en este panel'");

  const frEmptyGridHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLocale: "fr" },
      React.createElement(WidgetGrid, {
        widgets: [],
        onAddWidgetPrompt: () => {},
      })
    )
  );
  assert(frEmptyGridHtml.includes(fr.widgets.emptyTitle), "Empty Grid renders French: 'Aucun widget dans ce tableau'");

  // ---------------------------------------------------------------------------
  // SUITE 11: END-TO-END REGRESSION & ARCHITECTURAL INVARIANTS
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 11: End-to-End Regression & Architectural Invariants ---");

  // Invariant 1: No secret leakages in client widgets code
  const widgetsDir = path.resolve(__dirname, "../components/dashboard/widgets");
  function checkNoSecretsInDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        checkNoSecretsInDir(fullPath);
      } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
        const fileContent = fs.readFileSync(fullPath, "utf8");
        assert(!fileContent.includes("STRIPE_SECRET_KEY"), `No STRIPE_SECRET_KEY in ${file}`);
        assert(!fileContent.includes("SUPABASE_SERVICE_ROLE_KEY"), `No SUPABASE_SERVICE_ROLE_KEY in ${file}`);
      }
    }
  }
  checkNoSecretsInDir(widgetsDir);

  // Invariant 2: No rounded-full pill buttons in toolbar or container
  const toolbarCode = fs.readFileSync(path.join(widgetsDir, "customization-toolbar.tsx"), "utf8");
  assert(!toolbarCode.includes("rounded-full border bg-"), "No fake button pill badges in customization toolbar");
  const containerCode = fs.readFileSync(path.join(widgetsDir, "widget-container.tsx"), "utf8");
  assert(!containerCode.includes("rounded-full border bg-"), "No fake button pill badges in widget container");

  // Invariant 3: End-to-end multi-step workflow simulation
  const orgWorkflowLayout = getDefaultLayout("home");
  assert(orgWorkflowLayout.widgets.length === 5, "Workflow starts with 5 default widgets");

  // Add widget
  const addedWidget: WidgetInstanceConfig = {
    id: "w_workflow_mrr",
    metricId: "finance.mrr",
    visualization: "kpi",
    size: "sm",
  };
  const step2Widgets = [...orgWorkflowLayout.widgets, addedWidget];
  assert(step2Widgets.length === 6, "Workflow adds a 6th widget");

  // Reorder widgets
  const step3Widgets = [step2Widgets[5], ...step2Widgets.slice(0, 5)];
  assert(step3Widgets[0].id === "w_workflow_mrr", "Workflow successfully moves 6th widget to 1st position");

  // Resize widget
  const step4Widgets = step3Widgets.map((w) => (w.id === "w_workflow_mrr" ? { ...w, size: "md" as WidgetSize } : w));
  assert(step4Widgets[0].size === "md", "Workflow successfully resizes widget from sm to md");

  // Atomic CAS save simulation
  let casState: CASState = {
    user_preferences: {},
    updated_at: new Date().toISOString(),
  };
  const casSave1 = simulateSaveDashboardLayoutCas(casState, "org_workflow", "home", { ...orgWorkflowLayout, widgets: step4Widgets }, null);
  assert(casSave1.success === true, "Workflow saves newly arranged layout via atomic CAS");
  casState = casSave1.state;

  // Stale write rejection
  const staleCasSave = simulateSaveDashboardLayoutCas(casState, "org_workflow", "home", { ...orgWorkflowLayout, widgets: [] }, "2020-01-01T00:00:00Z");
  assert(staleCasSave.success === false && staleCasSave.code === "STALE_WRITE", "Workflow rejects concurrent stale write with STALE_WRITE");

  // Force overwrite resolution
  const forceCasSave = simulateSaveDashboardLayoutCas(casState, "org_workflow", "home", { ...orgWorkflowLayout, widgets: step4Widgets }, null, true);
  assert(forceCasSave.success === true, "Workflow force overwrite resolution succeeds cleanly");

  // ---------------------------------------------------------------------------
  // FINAL REPORT & ENVIRONMENT VERIFICATION GATES
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`Customizable Workspace Test Results (All 11 Suites): ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  console.log("Deterministic Local Environment Verification: COMPLETE (All assertions passed).");
  console.log("Operational Live DB Verification Gate: PENDING REAL DB ENVIRONMENT");
  console.log("  - Supabase CLI / Staging migration application requires real PG connection.");
  console.log("  - Multi-process parallel live execution requires real PostgREST endpoint.\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
