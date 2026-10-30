import { z } from "zod";

export const widgetSizeSchema = z.enum(["sm", "md", "lg", "full"]);
export const visualizationSchema = z.enum([
  "kpi",
  "chart",
  "bar",
  "table",
  "priorities",
  "pulse_kpis",
  "strip",
  "topology",
  "pages",
  "timeline",
  "progress",
  "gauge",
  "agenda",
  "cards",
]);
export const timeRangeSchema = z.enum(["30D", "90D", "12M", "YTD", "ALL", "current"]);
export const granularitySchema = z.enum(["daily", "monthly"]);

export const widgetTabSchema = z.object({
  id: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(100),
  metricId: z.string().trim().min(1).max(100),
  visualization: visualizationSchema,
});

export const widgetOptionsSchema = z
  .object({
    showTrend: z.boolean().optional(),
    currency: z.string().max(10).optional(),
    showLegend: z.boolean().optional(),
    rowBreak: z.boolean().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    offsetXPercent: z.number().min(0).max(85).optional(),
    customHeight: z.enum(["compact", "normal", "tall"]).optional(),
    customHeightPx: z.number().min(120).max(2000).optional(),
    customWidthPercent: z.number().min(15).max(100).optional(),
    tabs: z.array(widgetTabSchema).max(8).optional(),
    activeTabId: z.string().max(50).optional(),
  })
  .passthrough()
  .optional();

export const widgetInstanceSchema = z.object({
  id: z.string().trim().min(1).max(100),
  metricId: z.string().trim().min(1).max(100),
  visualization: visualizationSchema,
  size: widgetSizeSchema,
  title: z.string().trim().max(100).optional(),
  timeRange: timeRangeSchema.optional(),
  granularity: granularitySchema.optional(),
  dimension: z.string().trim().max(100).optional(),
  filters: z.record(z.string().max(50), z.string().max(100)).optional(),
  options: widgetOptionsSchema,
});

export const dashboardLayoutSchema = z.object({
  version: z.number().int().min(1),
  updatedAt: z.string(),
  widgets: z.array(widgetInstanceSchema).max(24),
});
