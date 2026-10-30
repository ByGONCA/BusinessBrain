import {
  MetricCapability,
  DashboardType,
  VisualizationType,
  TimeRange,
  WidgetInstanceConfig,
} from "./types";

/**
 * Verified Semantic Metric Registry for BusinessBrain.
 * Strictly bounded to real repository services and data models.
 * Zero ungrounded formulas, zero cross-currency aggregations.
 */
export const METRIC_REGISTRY: Record<string, MetricCapability> = {
  // ---------------------------------------------------------------------------
  // 1. FINANCIAL METRICS (Verified against lib/integrations/stripe/analytics.ts)
  // ---------------------------------------------------------------------------
  "finance.net_revenue": {
    id: "finance.net_revenue",
    category: "finance",
    labelKey: "widgets.metrics.finance.net_revenue.label",
    descriptionKey: "widgets.metrics.finance.net_revenue.description",
    unit: "cents",
    timeSemantics: "period_aggregate",
    supportedVisualizers: ["kpi", "chart", "bar", "progress"],
    supportedTimeRanges: ["30D", "90D", "12M", "YTD", "ALL"],
    defaultSize: "md",
    allowedSizes: ["sm", "md", "lg", "full"],
    hasHistoricalPoints: true,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.gross_revenue": {
    id: "finance.gross_revenue",
    category: "finance",
    labelKey: "widgets.metrics.finance.gross_revenue.label",
    descriptionKey: "widgets.metrics.finance.gross_revenue.description",
    unit: "cents",
    timeSemantics: "period_aggregate",
    supportedVisualizers: ["kpi", "chart", "bar"],
    supportedTimeRanges: ["30D", "90D", "12M", "YTD", "ALL"],
    defaultSize: "md",
    allowedSizes: ["sm", "md", "lg", "full"],
    hasHistoricalPoints: true,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.mrr": {
    id: "finance.mrr",
    category: "finance",
    labelKey: "widgets.metrics.finance.mrr.label",
    descriptionKey: "widgets.metrics.finance.mrr.description",
    unit: "cents",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["kpi", "gauge"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.arr": {
    id: "finance.arr",
    category: "finance",
    labelKey: "widgets.metrics.finance.arr.label",
    descriptionKey: "widgets.metrics.finance.arr.description",
    unit: "cents",
    timeSemantics: "point_in_time", // Derived run-rate estimate: MRR * 12
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.active_subscriptions": {
    id: "finance.active_subscriptions",
    category: "finance",
    labelKey: "widgets.metrics.finance.active_subscriptions.label",
    descriptionKey: "widgets.metrics.finance.active_subscriptions.description",
    unit: "count",
    timeSemantics: "point_in_time", // Active subscription count (distinct from customers)
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.active_customers": {
    id: "finance.active_customers",
    category: "finance",
    labelKey: "widgets.metrics.finance.active_customers.label",
    descriptionKey: "widgets.metrics.finance.active_customers.description",
    unit: "count",
    timeSemantics: "point_in_time", // Distinct unique customer IDs
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.refunds": {
    id: "finance.refunds",
    category: "finance",
    labelKey: "widgets.metrics.finance.refunds.label",
    descriptionKey: "widgets.metrics.finance.refunds.description",
    unit: "cents",
    timeSemantics: "period_aggregate",
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["30D", "90D", "12M", "YTD", "ALL"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  "finance.plans_breakdown": {
    id: "finance.plans_breakdown",
    category: "finance",
    labelKey: "widgets.metrics.finance.plans_breakdown.label",
    descriptionKey: "widgets.metrics.finance.plans_breakdown.description",
    unit: "cents",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["table", "bar"],
    supportedTimeRanges: ["current"],
    defaultSize: "md",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home", "finance"],
  },

  // ---------------------------------------------------------------------------
  // 2. WORKSPACE METRICS (Verified against app/dashboard/page.tsx queries)
  // ---------------------------------------------------------------------------
  "workspace.priorities": {
    id: "workspace.priorities",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.priorities.label",
    descriptionKey: "widgets.metrics.workspace.priorities.description",
    unit: "items",
    timeSemantics: "chronological",
    supportedVisualizers: ["priorities", "cards", "agenda"],
    supportedTimeRanges: ["current"],
    defaultSize: "full",
    allowedSizes: ["lg", "full"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.projects": {
    id: "workspace.projects",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.projects.label",
    descriptionKey: "widgets.metrics.workspace.projects.description",
    unit: "items",
    timeSemantics: "chronological",
    supportedVisualizers: ["table", "cards", "progress"],
    supportedTimeRanges: ["current"],
    defaultSize: "md",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    supportedFilters: [
      {
        key: "status",
        labelKey: "widgets.filters.status",
        options: [
          { value: "all", labelKey: "widgets.filters.all" },
          { value: "active", labelKey: "widgets.filters.active" },
          { value: "completed", labelKey: "widgets.filters.completed" },
        ],
      },
    ],
    allowedDashboards: ["home"],
  },

  "workspace.decisions": {
    id: "workspace.decisions",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.decisions.label",
    descriptionKey: "widgets.metrics.workspace.decisions.description",
    unit: "items",
    timeSemantics: "chronological",
    supportedVisualizers: ["table", "cards"],
    supportedTimeRanges: ["current"],
    defaultSize: "md",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    supportedFilters: [
      {
        key: "status",
        labelKey: "widgets.filters.status",
        options: [
          { value: "all", labelKey: "widgets.filters.all" },
          { value: "proposed", labelKey: "widgets.filters.proposed" },
          { value: "accepted", labelKey: "widgets.filters.accepted" },
        ],
      },
    ],
    allowedDashboards: ["home"],
  },

  "workspace.pulse_kpis": {
    id: "workspace.pulse_kpis",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.pulse_kpis.label",
    descriptionKey: "widgets.metrics.workspace.pulse_kpis.description",
    unit: "items",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["pulse_kpis", "kpi", "gauge"],
    supportedTimeRanges: ["current"],
    defaultSize: "full",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.projects_count": {
    id: "workspace.projects_count",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.projects_count.label",
    descriptionKey: "widgets.metrics.workspace.projects_count.description",
    unit: "count",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.decisions_count": {
    id: "workspace.decisions_count",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.decisions_count.label",
    descriptionKey: "widgets.metrics.workspace.decisions_count.description",
    unit: "count",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.pages_count": {
    id: "workspace.pages_count",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.pages_count.label",
    descriptionKey: "widgets.metrics.workspace.pages_count.description",
    unit: "count",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.connections_count": {
    id: "workspace.connections_count",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.connections_count.label",
    descriptionKey: "widgets.metrics.workspace.connections_count.description",
    unit: "count",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "sm",
    allowedSizes: ["sm", "md"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.topology_map": {
    id: "workspace.topology_map",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.topology_map.label",
    descriptionKey: "widgets.metrics.workspace.topology_map.description",
    unit: "items",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["topology"],
    supportedTimeRanges: ["current"],
    defaultSize: "md",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.recent_pages": {
    id: "workspace.recent_pages",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.recent_pages.label",
    descriptionKey: "widgets.metrics.workspace.recent_pages.description",
    unit: "items",
    timeSemantics: "chronological",
    supportedVisualizers: ["pages", "cards", "table"],
    supportedTimeRanges: ["current"],
    defaultSize: "md",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "workspace.timeline_activity": {
    id: "workspace.timeline_activity",
    category: "workspace",
    labelKey: "widgets.metrics.workspace.timeline_activity.label",
    descriptionKey: "widgets.metrics.workspace.timeline_activity.description",
    unit: "items",
    timeSemantics: "chronological",
    supportedVisualizers: ["timeline", "agenda", "table"],
    supportedTimeRanges: ["current"],
    defaultSize: "full",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    allowedDashboards: ["home"],
  },

  "finance.pulse_strip": {
    id: "finance.pulse_strip",
    category: "finance",
    labelKey: "widgets.metrics.finance.pulse_strip.label",
    descriptionKey: "widgets.metrics.finance.pulse_strip.description",
    unit: "cents",
    timeSemantics: "point_in_time",
    supportedVisualizers: ["strip", "kpi"],
    supportedTimeRanges: ["current"],
    defaultSize: "full",
    allowedSizes: ["md", "lg", "full"],
    hasHistoricalPoints: false,
    requiresConnectedIntegration: "stripe",
    allowedDashboards: ["home"],
  },
};

/**
 * Returns capability for a given metric ID if supported.
 */
export function getMetricCapability(metricId: string): MetricCapability | undefined {
  return METRIC_REGISTRY[metricId];
}

/**
 * Returns all registered metric capabilities.
 */
export function getAllMetricCapabilities(): MetricCapability[] {
  return Object.values(METRIC_REGISTRY);
}

/**
 * Returns metric capabilities filtered for a specific dashboard surface.
 */
export function getMetricsForDashboard(dashboardType: DashboardType): MetricCapability[] {
  return Object.values(METRIC_REGISTRY).filter((m) =>
    m.allowedDashboards.includes(dashboardType)
  );
}

/**
 * Checks whether a visualizer is supported for a given metric.
 */
export function isVisualizerSupported(
  metricId: string,
  visualizer: VisualizationType
): boolean {
  const capability = getMetricCapability(metricId);
  return Boolean(capability?.supportedVisualizers.includes(visualizer));
}

/**
 * Checks whether a time range is supported for a given metric.
 */
export function isTimeRangeSupported(
  metricId: string,
  timeRange: TimeRange
): boolean {
  const capability = getMetricCapability(metricId);
  return Boolean(capability?.supportedTimeRanges.includes(timeRange));
}

/**
 * Validates a widget configuration against the registry capability model.
 */
export function isWidgetConfigValid(
  widget: WidgetInstanceConfig
): { valid: boolean; reason?: string } {
  const capability = getMetricCapability(widget.metricId);
  if (!capability) {
    return { valid: false, reason: `Metric '${widget.metricId}' is not registered.` };
  }

  if (!capability.supportedVisualizers.includes(widget.visualization)) {
    return {
      valid: false,
      reason: `Visualizer '${widget.visualization}' is not supported for '${widget.metricId}'.`,
    };
  }

  if (!capability.allowedSizes.includes(widget.size)) {
    return {
      valid: false,
      reason: `Size '${widget.size}' is not allowed for '${widget.metricId}'.`,
    };
  }

  if (widget.timeRange && !capability.supportedTimeRanges.includes(widget.timeRange)) {
    return {
      valid: false,
      reason: `TimeRange '${widget.timeRange}' is not supported for '${widget.metricId}'.`,
    };
  }

  if (widget.granularity === "daily" && (!capability.hasHistoricalPoints || widget.timeRange !== "30D")) {
    return {
      valid: false,
      reason: "Daily granularity is only valid for historical metrics within the 30D window.",
    };
  }

  return { valid: true };
}
