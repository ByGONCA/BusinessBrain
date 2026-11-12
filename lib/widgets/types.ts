// Types and contracts for KogSync customizable dashboards.

export type WidgetSize = "sm" | "md" | "lg" | "full";

export type VisualizationType =
  | "kpi"
  | "chart"
  | "line"
  | "area"
  | "bar"
  | "donut"
  | "radial_gauge"
  | "table"
  | "priorities"
  | "pulse_kpis"
  | "strip"
  | "topology"
  | "pages"
  | "timeline"
  | "progress"
  | "gauge"
  | "agenda"
  | "cards";

export type TimeRange = "30D" | "90D" | "12M" | "YTD" | "ALL" | "current";

export type ChartGranularity = "daily" | "monthly";

export type MetricCategory = "finance" | "workspace" | "integrations" | "calendar" | "github";

export type MetricUnit = "cents" | "count" | "percentage" | "items" | "hours";

export type TimeSemantics = "point_in_time" | "period_aggregate" | "chronological";

export type DashboardType = "home" | "finance" | (string & {});

export interface MetricFilterDefinition {
  key: string;
  labelKey: string;
  options: Array<{ value: string; labelKey: string }>;
}

export interface MetricCapability {
  id: string; // e.g. "finance.net_revenue", "workspace.priorities", "workspace.tasks"
  category: MetricCategory;
  labelKey: string;
  descriptionKey: string;
  unit: MetricUnit;
  timeSemantics: TimeSemantics;
  supportedVisualizers: VisualizationType[];
  supportedTimeRanges: TimeRange[];
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  hasHistoricalPoints: boolean;
  supportedFilters?: MetricFilterDefinition[];
  supportedDimensions?: string[];
  requiresConnectedIntegration?: "stripe" | "github" | "google_calendar" | "microsoft_calendar" | "calendar";
  allowedDashboards: string[]; // Can be used in "home", "finance", or any custom dashboard
}

export interface WidgetTabConfig {
  id: string;
  label: string;
  metricId: string;
  visualization: VisualizationType;
}

export interface WidgetOptions {
  showTrend?: boolean;
  currency?: string;
  showLegend?: boolean;
  rowBreak?: boolean; // forces widget to start on a new row below
  align?: "left" | "center" | "right"; // horizontal alignment in the row
  offsetXPercent?: number; // 0% to 80% free horizontal offset from the left edge
  customHeight?: "compact" | "normal" | "tall";
  customHeightPx?: number; // 100% customizable height in pixels (160px - 1200px)
  customWidthPercent?: number; // 100% customizable width in percentage (20% - 100%)
  tabs?: WidgetTabConfig[];
  activeTabId?: string;
  targetValue?: number;
  currentValue?: number;
  unitPrefix?: string;
  unitSuffix?: string;
  donutHoleRatio?: number;
  showValues?: boolean;
  colorScheme?: "blue" | "emerald" | "amber" | "purple" | "multi";
  showMilestoneDots?: boolean;
  showSpline?: boolean;
}

export interface WidgetInstanceConfig {
  id: string; // Unique instance id e.g. "w_home_priorities_1"
  metricId: string;
  visualization: VisualizationType;
  size: WidgetSize;
  title?: string;
  timeRange?: TimeRange;
  granularity?: ChartGranularity;
  dimension?: string;
  filters?: Record<string, string>;
  options?: WidgetOptions;
}

export interface DashboardLayoutConfig {
  version: number; // Schema version (1)
  updatedAt: string; // ISO 8601 timestamp for Compare-And-Swap OCC
  widgets: WidgetInstanceConfig[];
}

export interface DashboardDescriptor {
  id: string; // "home", "finance", or "custom-[slug/uuid]"
  name: string;
  title?: string;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SaveLayoutErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_DASHBOARD"
  | "INVALID_LAYOUT"
  | "PROFILE_NOT_FOUND"
  | "STALE_WRITE"
  | "PERSISTENCE_ERROR";

export interface SaveLayoutResult {
  success: boolean;
  code?: SaveLayoutErrorCode;
  message?: string;
  updatedAt?: string;
  currentUpdatedAt?: string;
}

export interface LoadLayoutResult {
  layout: DashboardLayoutConfig;
  isCustom: boolean;
}
