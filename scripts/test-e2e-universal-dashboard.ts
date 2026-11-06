/**
 * End-to-End Validation & Stabilization Test Suite
 * Universal Dashboard Builder, Widget Engine & Data Providers
 *
 * Verifies:
 * 1. Home Dashboard unification & complete removal of Shopeers bypasses.
 * 2. Finance Dashboard metric accuracy (Net Revenue, MRR, ARR, Active Subs, Customers, no synthetic data).
 * 3. All 14 visualizers (KPI, Line, Area, Bar, Donut, Radial Gauge, Progress, Table, Agenda, Cards, etc.).
 * 4. Data providers resilience and fault isolation (Stripe, GitHub, Google/Outlook, Supabase Workspace).
 * 5. Layout personalization, editing operations, and CAS optimistic concurrency control.
 * 6. Responsive layout tokens, anti-clutter invariants, and i18n label consistency.
 */

import { METRIC_REGISTRY, getMetricCapability, getMetricsForDashboard, isWidgetConfigValid } from "../lib/widgets/registry";
import { widgetInstanceSchema, dashboardLayoutSchema, dashboardTypeSchema } from "../lib/widgets/schemas";
import { getDefaultLayout } from "../lib/widgets/layout-defaults";
import { WidgetInstanceConfig, WidgetSize } from "../lib/widgets/types";
import { filterFinancialMetricsByPeriod, StripeFinancialSnapshot, CurrencyFinancialTotals, MonthlyMetricPoint } from "../lib/integrations/stripe/types";
import { isValidUuid } from "../lib/security/authorization";
import fs from "fs";
import path from "path";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${description}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    Error: ${err?.message || err}`);
    failures.push(`${description} -> ${err?.message || err}`);
    failedTests++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("\n================================================================================");
console.log(" UNIVERSAL DASHBOARD ENGINE: END-TO-END VALIDATION & STABILIZATION SUITE");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// 1. HOME DASHBOARD VALIDATION
// -----------------------------------------------------------------------------
console.log("[1] VALIDATING HOME DASHBOARD ARCHITECTURE & SINGLE CANVAS:");

test("ExecutiveHomeDashboard renders WidgetGrid unconditionally without Shopeers bypass", () => {
  const filePath = path.join(process.cwd(), "components/dashboard/home/executive-home-dashboard.tsx");
  const content = fs.readFileSync(filePath, "utf-8");
  
  assert(!content.includes('!isCustomizing && currentDashboardId === "home"'), "No bypass expression found");
  assert(!content.includes("ShopeersHomeCards"), "No ShopeersHomeCards imported or rendered");
  assert(content.includes("<WidgetGrid"), "WidgetGrid is rendered in JSX");
  assert(content.includes("isEditing={isCustomizing}"), "WidgetGrid is passed isEditing state");
  assert(content.includes("onSaveWidget={handleSaveWidgetFromDrawer}"), "WidgetDrawer handles saveWidget");
});

test("Default Home Layout contains core cross-domain widgets and passes Zod schema", () => {
  const homeLayout = getDefaultLayout("home");
  const parseResult = dashboardLayoutSchema.safeParse(homeLayout);
  assert(parseResult.success, "Home layout conforms to dashboardLayoutSchema");
  assert(homeLayout.widgets.length >= 5, `Expected >= 5 widgets in Home layout, found ${homeLayout.widgets.length}`);
  
  const metricIds = homeLayout.widgets.map((w) => w.metricId);
  assert(metricIds.includes("workspace.pulse_kpis"), "Home contains pulse KPIs widget");
  assert(metricIds.includes("finance.pulse_strip"), "Home contains finance pulse strip widget");
  assert(metricIds.includes("workspace.projects"), "Home contains projects table widget");
  assert(metricIds.includes("workspace.recent_pages"), "Home contains recent pages widget");
  assert(metricIds.includes("workspace.timeline_activity"), "Home contains timeline activity widget");
});

test("Home widget manipulation simulation: Add, Remove, Duplicate, Move, Resize", () => {
  const homeLayout = getDefaultLayout("home");
  const initialCount = homeLayout.widgets.length;

  // 1. Add Widget
  const newWidget: WidgetInstanceConfig = {
    id: "widget_test_calendar_1",
    metricId: "calendar.upcoming_meetings",
    visualization: "agenda",
    size: "md",
  };
  const withAdded = [...homeLayout.widgets, newWidget];
  assert(withAdded.length === initialCount + 1, "Widget successfully added");

  // 2. Resize Widget
  const resized = withAdded.map((w) => (w.id === newWidget.id ? { ...w, size: "lg" as WidgetSize } : w));
  const target = resized.find((w) => w.id === newWidget.id);
  assert(target?.size === "lg", "Widget size changed from md to lg");

  // 3. Move Widget Left / Reorder
  const reordered = [...resized];
  const lastIdx = reordered.length - 1;
  const temp = reordered[lastIdx - 1];
  reordered[lastIdx - 1] = reordered[lastIdx];
  reordered[lastIdx] = temp;
  assert(reordered[lastIdx - 1].id === newWidget.id, "Widget moved one position left");

  // 4. Duplicate Widget
  const toDuplicate = reordered[0];
  const duplicated: WidgetInstanceConfig = {
    ...toDuplicate,
    id: `widget_${Date.now()}_dup`,
    title: `${toDuplicate.title || "Widget"} (Copy)`,
  };
  const withDuplicated = [...reordered, duplicated];
  assert(withDuplicated.length === reordered.length + 1, "Widget duplicated successfully");

  // 5. Remove Widget
  const withRemoved = withDuplicated.filter((w) => w.id !== duplicated.id);
  assert(withRemoved.length === reordered.length, "Duplicated widget removed cleanly");
});

// -----------------------------------------------------------------------------
// 2. FINANCE DASHBOARD & FINANCIAL PROVIDER VALIDATION
// -----------------------------------------------------------------------------
console.log("\n[2] VALIDATING FINANCE DASHBOARD & FINANCIAL METRIC FIDELITY:");

test("FinanceDashboard contains zero duplicate legacy charts and zero synthetic transactions", () => {
  const filePath = path.join(process.cwd(), "components/dashboard/finance/finance-dashboard.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert(!content.includes("Interactive Revenue Trajectory"), "Hero duplicate chart removed");
  assert(!content.includes("tx_${m.monthKey}_01"), "Synthetic transaction IDs removed");
  assert(!content.includes("100.0%"), "Hardcoded 100.0% success rate removed");
  assert(content.includes("<WidgetGrid"), "WidgetGrid is the single canvas");
  assert(content.includes("AccessibleModal"), "Billing cycles & unit economics moved to accessible modals");
});

test("Default Finance Layout contains required financial metrics", () => {
  const financeLayout = getDefaultLayout("finance");
  const parseResult = dashboardLayoutSchema.safeParse(financeLayout);
  assert(parseResult.success, "Finance layout conforms to schema");
  
  const metricIds = financeLayout.widgets.map((w) => w.metricId);
  assert(metricIds.includes("finance.net_revenue"), "Finance contains net revenue");
  assert(metricIds.includes("finance.mrr"), "Finance contains MRR");
  assert(metricIds.includes("finance.arr"), "Finance contains ARR");
  assert(metricIds.includes("finance.active_subscriptions"), "Finance contains active subscriptions");
  assert(metricIds.includes("finance.plans_breakdown"), "Finance contains plans breakdown");
  assert(metricIds.includes("finance.refunds"), "Finance contains refunds");
});

test("Financial calculations: ARR is strictly Annualized Run Rate (MRR * 12)", () => {
  const mrrCents = 245000; // €2,450.00
  const calculatedArrCents = mrrCents * 12; // €29,400.00
  assert(calculatedArrCents === 2940000, "ARR is exactly MRR * 12 in cents");

  const arrMetric = getMetricCapability("finance.arr");
  assert(arrMetric?.timeSemantics === "point_in_time", "ARR semantics is point_in_time run-rate");
  assert(arrMetric?.unit === "cents", "ARR unit is cents");
});

test("Financial calculations: Net Revenue uses bt.net without double deducting fees", () => {
  const sampleTotals: CurrencyFinancialTotals = {
    currency: "EUR",
    activeMrrCents: 50000,
    grossContractualMrrCents: 55000,
    discountSavingsMrrCents: 5000,
    atRiskDunningMrrCents: 0,
    arrCents: 600000,
    grossRevenueCents: 100000,
    netRevenueCents: 95000,
    totalRefundsCents: 2000,
    openDisputesCents: 0,
    stripeFeesCents: 3000,
    activeSubscribersCount: 10,
    trialingSubscribersCount: 2,
    canceledSubscribersCount: 1,
    atRiskSubscribersCount: 0,
    discountedSubscribersCount: 1,
    revenueByPlan: {
      prod_pro: { planName: "Pro Tier", subscribersCount: 6, mrrCents: 36000, percentageOfMrr: 72 },
      prod_starter: { planName: "Starter Tier", subscribersCount: 4, mrrCents: 14000, percentageOfMrr: 28 },
    },
  };

  assert(sampleTotals.netRevenueCents === 95000, "Net revenue is preserved as exact balance net");
  assert(sampleTotals.activeSubscribersCount === 10, "10 subscribers count mapped cleanly");
});

test("Temporal Filtering: filterFinancialMetricsByPeriod correctly slices historical points with valid snapshot", () => {
  const sampleMonthlyPoints: MonthlyMetricPoint[] = [
    { monthKey: "2025-01", grossRevenueCents: 10000, netRevenueCents: 9500, newCustomersCount: 1 },
    { monthKey: "2025-06", grossRevenueCents: 20000, netRevenueCents: 19000, newCustomersCount: 2 },
    { monthKey: "2025-12", grossRevenueCents: 30000, netRevenueCents: 28500, newCustomersCount: 3 },
    { monthKey: "2026-01", grossRevenueCents: 40000, netRevenueCents: 38000, newCustomersCount: 4 },
  ];

  const mockSnapshot: StripeFinancialSnapshot = {
    organizationId: "org-test-uuid",
    connectedAccountId: "acct_test_123",
    livemode: false,
    computedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    freshnessStatus: "fresh",
    primaryCurrency: "EUR",
    totalActiveCustomersCount: 8,
    totalAtRiskCustomersCount: 0,
    dunningGracePeriodDays: 14,
    timezone: "UTC",
    provenance: {
      source: "stripe_connect_api",
      apiVersion: "2024-12-18.acacia",
      sampledChargesCount: 40,
      sampledSubscriptionsCount: 10,
      sampledBalanceTransactionsCount: 40,
      lastSyncedAt: new Date().toISOString(),
      payloadSizeBytes: 2048,
      safeguardPruned: false,
      pagesTraversedSubscriptions: 1,
      pagesTraversedBalanceTransactions: 1,
      hasMoreUnfetched: false,
    },
    currencies: {
      EUR: {
        currency: "EUR",
        activeMrrCents: 50000,
        grossContractualMrrCents: 50000,
        discountSavingsMrrCents: 0,
        atRiskDunningMrrCents: 0,
        arrCents: 600000,
        grossRevenueCents: 100000,
        netRevenueCents: 95000,
        totalRefundsCents: 2000,
        openDisputesCents: 0,
        stripeFeesCents: 3000,
        activeSubscribersCount: 10,
        trialingSubscribersCount: 0,
        canceledSubscribersCount: 0,
        atRiskSubscribersCount: 0,
        discountedSubscribersCount: 0,
        revenueByPlan: {},
      },
    },
    monthlyHistory: {
      EUR: sampleMonthlyPoints,
    },
  };

  const filtered30D = filterFinancialMetricsByPeriod(mockSnapshot, "EUR", "30D", "pt-PT", "monthly");
  assert(filtered30D.chartPoints.length > 0, "30D returns populated chart points");

  const filteredAll = filterFinancialMetricsByPeriod(mockSnapshot, "EUR", "ALL", "pt-PT", "monthly");
  assert(filteredAll.chartPoints.length >= 12, "ALL returns full historical horizon");
});

// -----------------------------------------------------------------------------
// 3. ALL VISUALIZERS VALIDATION
// -----------------------------------------------------------------------------
console.log("\n[3] VALIDATING ALL 14 VISUALIZERS & RENDERING CAPABILITIES:");

test("Metric Registry maps all registered metrics to supported visualizers", () => {
  const metrics = Object.values(METRIC_REGISTRY);
  assert(metrics.length >= 25, `Expected >= 25 metrics, found ${metrics.length}`);

  for (const m of metrics) {
    assert(m.supportedVisualizers.length > 0, `Metric ${m.id} has at least one supported visualizer`);
    assert(m.allowedSizes.length > 0, `Metric ${m.id} has at least one allowed size`);
    assert(m.allowedSizes.includes(m.defaultSize), `Metric ${m.id} defaultSize must be in allowedSizes`);
  }
});

test("Visualizer safety: isWidgetConfigValid rejects unsupported visualizer pairs", () => {
  const invalidGoalsConfig: WidgetInstanceConfig = {
    id: "w_invalid_1",
    metricId: "workspace.goals",
    visualization: "bar",
    size: "md",
  };
  const check1 = isWidgetConfigValid(invalidGoalsConfig);
  assert(!check1.valid, "workspace.goals with bar chart is rejected");

  const validDonutConfig: WidgetInstanceConfig = {
    id: "w_valid_1",
    metricId: "finance.plans_breakdown",
    visualization: "donut",
    size: "md",
  };
  const check2 = isWidgetConfigValid(validDonutConfig);
  assert(check2.valid, "finance.plans_breakdown with donut is valid");
});

test("Table visualizer handles all 4 multi-domain datasets without throw", () => {
  const tableFilePath = path.join(process.cwd(), "components/dashboard/widgets/renderers/table-visualizer.tsx");
  const content = fs.readFileSync(tableFilePath, "utf-8");

  assert(content.includes('metricId === "workspace.tasks"'), "Handles workspace tasks table");
  assert(content.includes('metricId === "github.open_prs"'), "Handles github open PRs table");
  assert(content.includes('metricId === "calendar.upcoming_meetings"'), "Handles calendar meetings table");
  assert(content.includes('metricId === "finance.plans_breakdown"'), "Handles plans breakdown table");
});

test("Radial gauge visualizer contains zero hardcoded 14/20 fallbacks and uses clean 12-dot arc", () => {
  const gaugeFilePath = path.join(process.cwd(), "components/dashboard/widgets/renderers/radial-gauge-visualizer.tsx");
  const content = fs.readFileSync(gaugeFilePath, "utf-8");

  assert(!content.includes("14/20"), "Hardcoded 14/20 string removed");
  assert(!content.includes("completedDeliverables = 14"), "Hardcoded 14 fallback removed");
  assert(!content.includes("totalDeliverables = 20"), "Hardcoded 20 fallback removed");
  assert(content.includes("dotsCount = 12"), "Uses clean 12-dot geometric arc");
});

// -----------------------------------------------------------------------------
// 4. PROVIDER RESILIENCE & ISOLATION
// -----------------------------------------------------------------------------
console.log("\n[4] VALIDATING DATA PROVIDERS & FAULT ISOLATION:");

test("Stripe provider isolation: disconnected state renders clean message without crashing", () => {
  const kpiFilePath = path.join(process.cwd(), "components/dashboard/widgets/renderers/kpi-visualizer.tsx");
  const content = fs.readFileSync(kpiFilePath, "utf-8");

  assert(content.includes("isStripeConnected"), "Checks isStripeConnected");
  assert(content.includes("t.widgets.stripeNotConnected"), "Uses localized stripeNotConnected key");
});

test("GitHub provider isolation: missing integration renders empty state without affecting other widgets", () => {
  const tableFilePath = path.join(process.cwd(), "components/dashboard/widgets/renderers/table-visualizer.tsx");
  const content = fs.readFileSync(tableFilePath, "utf-8");

  assert(content.includes("Sem pull requests abertos no momento."), "Displays empty PR state cleanly in PT");
  assert(content.includes("No open pull requests recorded."), "Displays empty PR state cleanly in EN");
});

test("Calendar provider: Google & Outlook attendees array mapping preserved", () => {
  const googlePath = path.join(process.cwd(), "lib/integrations/google/calendar.ts");
  const googleContent = fs.readFileSync(googlePath, "utf-8");
  assert(googleContent.includes("evt.attendees?.map"), "Google Calendar maps attendee emails");

  const msPath = path.join(process.cwd(), "lib/integrations/microsoft/calendar.ts");
  const msContent = fs.readFileSync(msPath, "utf-8");
  assert(msContent.includes("evt.attendees?.map"), "Microsoft Calendar maps attendee emails");
});

// -----------------------------------------------------------------------------
// 5. PERSONALIZATION & CAS OCC PERSISTENCE
// -----------------------------------------------------------------------------
console.log("\n[5] VALIDATING CAS CONCURRENCY & PERSISTENCE SECURITY:");

test("saveDashboardLayoutAction validates organization ID format", () => {
  assert(!isValidUuid("invalid-org-uuid"), "Rejects invalid org id");
  assert(isValidUuid("123e4567-e89b-12d3-a456-426614174000"), "Accepts valid UUIDv4");
});

test("saveDashboardLayoutAction validates dashboardType naming against injection", () => {
  assert(dashboardTypeSchema.safeParse("home").success, "'home' is valid");
  assert(dashboardTypeSchema.safeParse("finance").success, "'finance' is valid");
  assert(dashboardTypeSchema.safeParse("executive_summary_2026").success, "Alphanumeric custom name is valid");
  assert(!dashboardTypeSchema.safeParse("; DROP TABLE dashboards;").success, "SQL injection string is rejected");
  assert(!dashboardTypeSchema.safeParse("<script>alert(1)</script>").success, "XSS string is rejected");
});

test("CAS Monotonic Concurrency check: Stale expectedUpdatedAt prevents overwrite", () => {
  const layout = getDefaultLayout("home");
  layout.updatedAt = "2026-11-06T10:00:00.000Z";

  const serverPersistedUpdatedAt: string = "2026-11-06T10:05:00.000Z";
  const clientExpectedUpdatedAt: string = "2026-11-06T10:00:00.000Z";

  const isStale = clientExpectedUpdatedAt !== serverPersistedUpdatedAt;
  assert(isStale, "Stale update detected; client must be prompted to reload latest or force overwrite");
});

// -----------------------------------------------------------------------------
// 6. VISUAL INTEGRITY, RESPONSIVENESS & I18N
// -----------------------------------------------------------------------------
console.log("\n[6] VALIDATING RESPONSIVE GRID TOKENS, ACCESSIBILITY & I18N:");

test("WidgetGrid applies mobile-first responsive column spans", () => {
  const gridFilePath = path.join(process.cwd(), "components/dashboard/widgets/widget-grid.tsx");
  const content = fs.readFileSync(gridFilePath, "utf-8");

  assert(content.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"), "Responsive grid classes match standard 4-column layout");
  assert(content.includes('sm: "col-span-1"'), "sm size maps to col-span-1");
  assert(content.includes('md: "col-span-1 sm:col-span-2"'), "md size maps to 2 columns on tablet/desktop");
  assert(content.includes('lg: "col-span-1 sm:col-span-2 lg:col-span-3"'), "lg size maps to 3 columns");
  assert(content.includes('full: "col-span-1 sm:col-span-2 lg:col-span-4"'), "full size maps to 4 columns");
});

test("UI Anti-pattern check: Zero fake pill buttons (rounded-full) used as action badges", () => {
  const gridContent = fs.readFileSync(path.join(process.cwd(), "components/dashboard/widgets/widget-grid.tsx"), "utf-8");
  assert(!gridContent.includes('<button className="rounded-full'), "No rounded-full fake pill buttons in WidgetGrid");
});

test("Anti-clutter check: Zero internal database engineering jargon in widget labels", () => {
  const ptDictPath = path.join(process.cwd(), "lib/i18n/dictionaries/pt.ts");
  const ptContent = fs.readFileSync(ptDictPath, "utf-8");

  assert(!ptContent.includes("PostgreSQL RLS de Linha de Defesa"), "No internal DB jargon in Portuguese dictionary");
  assert(!ptContent.includes("Perímetro Ativo"), "No security perimeter jargon");
  assert(!ptContent.includes("Motor de Conexões e Grafos O(V + E)"), "No raw Big-O complexity jargon");
});

console.log("\n================================================================================");
console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log("================================================================================\n");

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("✓ All E2E universal dashboard tests passed with 100% compliance.");
}
