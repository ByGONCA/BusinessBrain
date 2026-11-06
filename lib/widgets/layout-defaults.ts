import { DashboardLayoutConfig, DashboardType } from "./types";

/**
 * Curated Default Layouts for BusinessBrain.
 * Strictly limited to exactly 3 verified, high-signal blocks per dashboard
 * to avoid visual clutter (AGENTS.md Section 6).
 */

export const DEFAULT_HOME_LAYOUT: DashboardLayoutConfig = {
  version: 1,
  updatedAt: "2026-10-29T00:00:00.000Z",
  widgets: [
    {
      id: "w_home_pulse_kpis",
      metricId: "workspace.pulse_kpis",
      visualization: "pulse_kpis",
      size: "full",
      timeRange: "current",
    },
    {
      id: "w_home_finance_strip",
      metricId: "finance.pulse_strip",
      visualization: "strip",
      size: "full",
      timeRange: "current",
    },
    {
      id: "w_home_projects",
      metricId: "workspace.projects",
      visualization: "table",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_home_recent_pages",
      metricId: "workspace.recent_pages",
      visualization: "pages",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_home_timeline",
      metricId: "workspace.timeline_activity",
      visualization: "timeline",
      size: "full",
      timeRange: "current",
    },
  ],
};

export const DEFAULT_FINANCE_LAYOUT: DashboardLayoutConfig = {
  version: 1,
  updatedAt: "2026-10-29T00:00:00.000Z",
  widgets: [
    {
      id: "w_finance_net_revenue",
      metricId: "finance.net_revenue",
      visualization: "kpi",
      size: "md",
      timeRange: "30D",
      options: {
        showTrend: true,
      },
    },
    {
      id: "w_finance_mrr",
      metricId: "finance.mrr",
      visualization: "kpi",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_finance_arr",
      metricId: "finance.arr",
      visualization: "kpi",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_finance_active_subscriptions",
      metricId: "finance.active_subscriptions",
      visualization: "kpi",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_finance_trajectory_12m",
      metricId: "finance.net_revenue",
      visualization: "chart",
      size: "full",
      timeRange: "12M",
      granularity: "monthly",
    },
    {
      id: "w_finance_plans_breakdown",
      metricId: "finance.plans_breakdown",
      visualization: "donut",
      size: "md",
      timeRange: "current",
    },
    {
      id: "w_finance_refunds",
      metricId: "finance.refunds",
      visualization: "kpi",
      size: "md",
      timeRange: "30D",
    },
  ],
};

/**
 * Returns a cloned default layout for the given dashboard type.
 */
export function getDefaultLayout(dashboardType: DashboardType): DashboardLayoutConfig {
  const base =
    dashboardType === "finance" ? DEFAULT_FINANCE_LAYOUT : DEFAULT_HOME_LAYOUT;
  return JSON.parse(JSON.stringify(base));
}
