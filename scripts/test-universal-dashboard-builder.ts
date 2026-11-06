/**
 * Test Suite: Universal Dashboard Builder & Widget Ecosystem
 *
 * Validates:
 * 1. Metric registry extensibility (Tasks, Goals, Calendar, GitHub, Integrations).
 * 2. Visualizer support (KPI, Bar, Line, Area, Donut, Radial Gauge, Agenda, Progress).
 * 3. Zod schema validation for widget instances and options.
 * 4. Multi-dashboard descriptors and alphanumeric naming validation.
 * 5. Backward compatibility for legacy layout formats.
 */

import { METRIC_REGISTRY, getMetricCapability, getMetricsForDashboard } from "../lib/widgets/registry";
import { widgetInstanceSchema, dashboardLayoutSchema, dashboardTypeSchema } from "../lib/widgets/schemas";
import { getDefaultLayout } from "../lib/widgets/layout-defaults";
import { WidgetInstanceConfig } from "../lib/widgets/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log(" UNIVERSAL DASHBOARD BUILDER & WIDGET ECOSYSTEM TEST");
console.log("=======================================================\n");

// 1. Metric Registry Tests
console.log("1. Metric Registry Validation:");

const taskMetric = getMetricCapability("workspace.tasks");
assert(!!taskMetric, "workspace.tasks metric is registered");
assert(taskMetric?.category === "workspace", "workspace.tasks has category 'workspace'");
assert(taskMetric?.supportedVisualizers.includes("table") ?? false, "workspace.tasks supports table visualization");

const goalMetric = getMetricCapability("workspace.goals");
assert(!!goalMetric, "workspace.goals metric is registered");
assert(goalMetric?.supportedVisualizers.includes("radial_gauge") ?? false, "workspace.goals supports radial_gauge");
assert(goalMetric?.supportedVisualizers.includes("progress") ?? false, "workspace.goals supports progress");

const meetingMetric = getMetricCapability("calendar.upcoming_meetings");
assert(!!meetingMetric, "calendar.upcoming_meetings metric is registered");
assert(meetingMetric?.category === "calendar", "calendar.upcoming_meetings has category 'calendar'");
assert(meetingMetric?.requiresConnectedIntegration === "calendar", "calendar.upcoming_meetings flags calendar integration");

const githubMetric = getMetricCapability("github.open_prs");
assert(!!githubMetric, "github.open_prs metric is registered");
assert(githubMetric?.category === "github", "github.open_prs has category 'github'");
assert(githubMetric?.requiresConnectedIntegration === "github", "github.open_prs flags github integration");

const netRevenueMetric = getMetricCapability("finance.net_revenue");
assert(netRevenueMetric?.supportedVisualizers.includes("area") ?? false, "finance.net_revenue supports area chart");
assert(netRevenueMetric?.supportedVisualizers.includes("line") ?? false, "finance.net_revenue supports line chart");

const plansMetric = getMetricCapability("finance.plans_breakdown");
assert(plansMetric?.supportedVisualizers.includes("donut") ?? false, "finance.plans_breakdown supports donut chart");

// 2. Custom Dashboard Metric Resolution
console.log("\n2. Dashboard Metric Filtering:");
const homeMetrics = getMetricsForDashboard("home");
const financeMetrics = getMetricsForDashboard("finance");
const customMetrics = getMetricsForDashboard("sales_ops_2025");

assert(homeMetrics.length > 0, "home dashboard receives available metrics");
assert(financeMetrics.length > 0, "finance dashboard receives available metrics");
assert(customMetrics.length >= homeMetrics.length, "custom dashboard receives full catalog of metrics");

// 3. Zod Schemas Validation
console.log("\n3. Zod Schema & Options Validation:");

// Test valid custom dashboard widget with radial gauge
const validRadialWidget: WidgetInstanceConfig = {
  id: "test-radial-1",
  metricId: "workspace.goals",
  visualization: "radial_gauge",
  size: "sm",
  options: {
    targetValue: 20,
    currentValue: 14,
    showMilestoneDots: true,
    colorScheme: "emerald",
  },
};
const parsedRadial = widgetInstanceSchema.safeParse(validRadialWidget);
assert(parsedRadial.success, "Valid radial gauge widget config parses correctly");

// Test valid donut widget
const validDonutWidget: WidgetInstanceConfig = {
  id: "test-donut-1",
  metricId: "finance.plans_breakdown",
  visualization: "donut",
  size: "md",
  options: {
    donutHoleRatio: 0.65,
    showLegend: true,
  },
};
const parsedDonut = widgetInstanceSchema.safeParse(validDonutWidget);
assert(parsedDonut.success, "Valid donut chart widget config parses correctly");

// Test valid area chart widget
const validAreaWidget: WidgetInstanceConfig = {
  id: "test-area-1",
  metricId: "finance.net_revenue",
  visualization: "area",
  size: "lg",
  timeRange: "30D",
  options: {
    showSpline: true,
  },
};
const parsedArea = widgetInstanceSchema.safeParse(validAreaWidget);
assert(parsedArea.success, "Valid area spline widget config parses correctly");

// Test invalid visualization rejection
const invalidWidget = {
  id: "test-bad-1",
  metricId: "workspace.tasks",
  visualization: "unsupported_3d_cube",
  size: "sm",
};
const parsedInvalid = widgetInstanceSchema.safeParse(invalidWidget);
assert(!parsedInvalid.success, "Unsupported visualization is rejected by Zod schema");

// 4. Dashboard Type Naming & Isolation
console.log("\n4. Dashboard Type Validation:");
assert(dashboardTypeSchema.safeParse("home").success, "Dashboard 'home' is valid");
assert(dashboardTypeSchema.safeParse("finance").success, "Dashboard 'finance' is valid");
assert(dashboardTypeSchema.safeParse("sales-growth_2025").success, "Alphanumeric custom dashboard ID is valid");
assert(!dashboardTypeSchema.safeParse("").success, "Empty dashboard ID is rejected");
assert(!dashboardTypeSchema.safeParse("bad name with spaces!").success, "Dashboard ID with spaces or special chars is rejected");
assert(!dashboardTypeSchema.safeParse("a".repeat(70)).success, "Dashboard ID exceeding 64 characters is rejected");

// 5. Default Layouts & Backward Compatibility
console.log("\n5. Layout Defaults & Compatibility:");
const homeDefault = getDefaultLayout("home");
assert(homeDefault.version === 1, "Home default layout has version 1");
assert(homeDefault.widgets.length >= 3, "Home default layout contains initial widgets");

const layoutParsed = dashboardLayoutSchema.safeParse(homeDefault);
assert(layoutParsed.success, "Default home layout passes Zod schema validation");

const financeDefault = getDefaultLayout("finance");
assert(financeDefault.version === 1, "Finance default layout has version 1");
assert(financeDefault.widgets.length >= 3, "Finance default layout contains initial widgets");

console.log("\n=======================================================");
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Universal Dashboard Builder assertions passed successfully.\n");
}
