"use client";

import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { StripeFinancialSnapshot, FilteredPeriodChartPoint } from "@/lib/integrations/stripe/types";
import { filterFinancialMetricsByPeriod } from "@/lib/integrations/stripe/types";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface ChartVisualizerProps {
  widget: WidgetInstanceConfig;
  financialSnapshot?: StripeFinancialSnapshot | null;
  currency?: string;
  className?: string;
}

export function ChartVisualizer({
  widget,
  financialSnapshot,
  currency = "EUR",
  className,
}: ChartVisualizerProps) {
  const { locale, t } = useLanguage();
  const formatLocale = locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US";
  const activeCurrency = financialSnapshot?.primaryCurrency || currency;
  const timeRange = (widget.timeRange === "current" ? "12M" : widget.timeRange) || "12M";
  const granularity = widget.granularity || "monthly";

  const [hoveredPointIdx, setHoveredPointIdx] = React.useState<number | null>(null);

  // Distinct visualization styles:
  // "chart": Trend Chart (Trajectory & momentum, sparkline curve, no area fill, start & end highlight dots)
  // "line": Line Chart (Data precision, vertex nodes on every point, average benchmark guideline, no area fill)
  // "area": Area Chart (Volume representation, rich gradient fill beneath the curve, glowing top stroke)
  const isLineChart = widget.visualization === "line";
  const isAreaChart = widget.visualization === "area";
  const isTrendChart = !isLineChart && !isAreaChart; // Default to trend chart

  // Compute filtered points
  const filteredMetrics = React.useMemo(() => {
    if (!financialSnapshot) return null;
    return filterFinancialMetricsByPeriod(
      financialSnapshot,
      activeCurrency,
      timeRange as any,
      formatLocale,
      granularity as any
    );
  }, [financialSnapshot, activeCurrency, timeRange, locale, granularity]);

  const points: FilteredPeriodChartPoint[] = filteredMetrics?.chartPoints || [];

  // Helper for formatting currency amounts
  const formatMoney = React.useCallback(
    (amount: number) => {
      try {
        return amount.toLocaleString(formatLocale, {
          style: "currency",
          currency: activeCurrency.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch {
        return `${amount.toFixed(2)} ${activeCurrency.toUpperCase()}`;
      }
    },
    [locale, activeCurrency]
  );

  // Trajectory Delta calculation for Trend Chart
  const trendDelta = React.useMemo(() => {
    if (points.length < 2) return 0;
    const firstVal = points[0].revenue;
    const lastVal = points[points.length - 1].revenue;
    if (firstVal === 0) return lastVal > 0 ? 100 : 0;
    return ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
  }, [points]);

  // Average revenue calculation for Line Chart reference guideline
  const avgRevenue = React.useMemo(() => {
    if (points.length === 0) return 0;
    const sum = points.reduce((acc, curr) => acc + curr.revenue, 0);
    return sum / points.length;
  }, [points]);

  // Empty state if no data or integration not connected
  if (!financialSnapshot || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[180px] text-center p-6 text-muted-foreground dark:text-zinc-500">
        <p className="text-xs font-medium">
          {t.widgets.noHistoricalData}
        </p>
      </div>
    );
  }

  // Geometry calculations
  const chartHeight = 160;
  const chartWidth = 600;
  const paddingX = 16;
  const paddingY = 22;

  const maxVal = Math.max(...points.map((p) => p.revenue), 1) * 1.15;
  const minVal = 0;
  const rangeY = maxVal - minVal || 1;

  const stepX = points.length > 1 ? (chartWidth - paddingX * 2) / (points.length - 1) : 0;

  const svgCoords = points.map((pt, idx) => {
    const x = points.length === 1 ? chartWidth / 2 : paddingX + idx * stepX;
    const normalizedY = (pt.revenue - minVal) / rangeY;
    const y = chartHeight - paddingY - normalizedY * (chartHeight - paddingY * 2);
    return { x, y, pt, idx };
  });

  // Calculate average line Y position for Line Chart
  const avgNormalizedY = (avgRevenue - minVal) / rangeY;
  const avgY = chartHeight - paddingY - avgNormalizedY * (chartHeight - paddingY * 2);

  // Smooth Bézier path
  const pathD = svgCoords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = svgCoords[idx - 1];
    const midX = (prev.x + curr.x) / 2;
    return `${acc} C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }, "");

  // Closed area path for gradient in Area Chart
  const areaD =
    svgCoords.length > 0 && pathD
      ? `${pathD} L ${svgCoords[svgCoords.length - 1].x} ${chartHeight - paddingY} L ${svgCoords[0].x} ${chartHeight - paddingY} Z`
      : "";

  const activePoint =
    hoveredPointIdx !== null && svgCoords[hoveredPointIdx]
      ? svgCoords[hoveredPointIdx]
      : svgCoords[svgCoords.length - 1];

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {/* Dynamic Header: Tailored to Chart Type */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div>
          <span className="text-[11px] text-muted-foreground">
            {activePoint?.pt.fullDate || activePoint?.pt.date}
          </span>
          <div className="text-base sm:text-lg font-bold font-mono text-foreground">
            {formatMoney(activePoint?.pt.revenue || 0)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Trend Chart: Trajectory Momentum Pill */}
          {isTrendChart && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
                trendDelta >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              )}
            >
              {trendDelta >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>{trendDelta >= 0 ? `+${trendDelta.toFixed(1)}%` : `${trendDelta.toFixed(1)}%`}</span>
            </div>
          )}

          {/* Line Chart: Average Guideline Badge */}
          {isLineChart && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
              <span className="text-zinc-400">Média:</span>
              <span className="font-semibold">{formatMoney(avgRevenue)}</span>
            </div>
          )}

          {/* Area Chart: Volume Badge */}
          {isAreaChart && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-mono border border-blue-500/20">
              <span>Volume</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredPointIdx(null)}
        >
          <defs>
            <linearGradient id="chartGradientArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartStrokeTrend" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor={trendDelta >= 0 ? "#10B981" : "#F43F5E"} />
            </linearGradient>
          </defs>

          {/* Background Grid Baseline */}
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            className="stroke-zinc-200 dark:stroke-white/[0.06]"
            strokeWidth="1"
          />

          {/* Line Chart: Horizontal Benchmark Average Guideline */}
          {isLineChart && (
            <g>
              <line
                x1={paddingX}
                y1={avgY}
                x2={chartWidth - paddingX}
                y2={avgY}
                stroke="#3B82F6"
                strokeOpacity="0.4"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
            </g>
          )}

          {/* Trend Chart: Subtle Mid Guidance Ticks */}
          {isTrendChart && (
            <line
              x1={paddingX}
              y1={chartHeight / 2}
              x2={chartWidth - paddingX}
              y2={chartHeight / 2}
              className="stroke-zinc-200/50 dark:stroke-white/[0.03]"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
          )}

          {/* Area Chart ONLY: Rich Gradient Volume Fill */}
          {isAreaChart && areaD && (
            <path d={areaD} fill="url(#chartGradientArea)" />
          )}

          {/* Line / Path Stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={isTrendChart ? "url(#chartStrokeTrend)" : "#3b82f6"}
              strokeWidth={isAreaChart ? "2.5" : isTrendChart ? "2.5" : "2"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Line Chart ONLY: Precision Nodes on EVERY Single Data Point */}
          {isLineChart &&
            svgCoords.map((coord) => (
              <circle
                key={`node-${coord.idx}`}
                cx={coord.x}
                cy={coord.y}
                r={activePoint?.idx === coord.idx ? 5 : 3}
                className="fill-white dark:fill-zinc-900 stroke-blue-600 dark:stroke-blue-400 stroke-2 transition-all"
              />
            ))}

          {/* Trend Chart ONLY: Prominent Start & End Momentum Anchor Nodes */}
          {isTrendChart && svgCoords.length > 0 && (
            <g>
              {/* Start anchor */}
              <circle
                cx={svgCoords[0].x}
                cy={svgCoords[0].y}
                r="3"
                className="fill-blue-500/80 stroke-white dark:stroke-[#15171C] stroke-1"
              />
              {/* End anchor with accent ring */}
              <circle
                cx={svgCoords[svgCoords.length - 1].x}
                cy={svgCoords[svgCoords.length - 1].y}
                r="6"
                className={trendDelta >= 0 ? "fill-emerald-500/20" : "fill-rose-500/20"}
              />
              <circle
                cx={svgCoords[svgCoords.length - 1].x}
                cy={svgCoords[svgCoords.length - 1].y}
                r="3.5"
                className={cn(
                  "stroke-white dark:stroke-[#15171C] stroke-1.5",
                  trendDelta >= 0 ? "fill-emerald-500" : "fill-rose-500"
                )}
              />
            </g>
          )}

          {/* Hover Crosshair Vertical Guide Line */}
          {hoveredPointIdx !== null && activePoint && (
            <line
              x1={activePoint.x}
              y1={paddingY}
              x2={activePoint.x}
              y2={chartHeight - paddingY}
              stroke="#3B82F6"
              strokeOpacity="0.5"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}

          {/* Interactive Scrubbing Hit Targets */}
          {svgCoords.map((coord) => (
            <g key={`hit-${coord.idx}`}>
              <circle
                cx={coord.x}
                cy={coord.y}
                r="16"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPointIdx(coord.idx)}
              />
              {activePoint?.idx === coord.idx && (
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="5"
                  className="fill-white dark:fill-blue-500 stroke-blue-600 stroke-2"
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Time Axis Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground dark:text-zinc-500 pt-1">
        <span>{svgCoords[0]?.pt.shortDate || svgCoords[0]?.pt.date}</span>
        {svgCoords.length > 2 && (
          <span>{svgCoords[Math.floor(svgCoords.length / 2)]?.pt.shortDate}</span>
        )}
        <span>{svgCoords[svgCoords.length - 1]?.pt.shortDate || svgCoords[svgCoords.length - 1]?.pt.date}</span>
      </div>
    </div>
  );
}
