"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { StripeFinancialSnapshot, FilteredPeriodChartPoint } from "@/lib/integrations/stripe/types";
import { filterFinancialMetricsByPeriod } from "@/lib/integrations/stripe/types";
import { useLanguage } from "@/lib/i18n";

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

  // Empty state if no data or integration not connected
  if (!financialSnapshot || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[180px] text-center p-6 text-zinc-400 dark:text-zinc-500">
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
  const paddingY = 20;

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

  // Smooth Bézier path
  const pathD = svgCoords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = svgCoords[idx - 1];
    const midX = (prev.x + curr.x) / 2;
    return `${acc} C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }, "");

  // Closed area path for gradient
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
      {/* Dynamic Scrubber / Active Metric Header */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {activePoint?.pt.fullDate || activePoint?.pt.date}
          </span>
          <div className="text-base sm:text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatMoney(activePoint?.pt.revenue || 0)}
          </div>
        </div>

        {granularity === "daily" && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-2 py-0.5 rounded-md">
            {locale === "pt" ? "Média diária estimada" : "Estimated daily pacing"}
          </span>
        )}
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredPointIdx(null)}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Ticks */}
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            className="stroke-zinc-200 dark:stroke-white/[0.06]"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={chartHeight / 2}
            x2={chartWidth - paddingX}
            y2={chartHeight / 2}
            className="stroke-zinc-200/60 dark:stroke-white/[0.03]"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Area Fill */}
          {areaD && <path d={areaD} fill="url(#chartGradient)" />}

          {/* Line Stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Points and Hover Circles */}
          {svgCoords.map((coord) => (
            <g key={coord.idx}>
              {/* Invisible wide hit area for mouse scrubbing */}
              <circle
                cx={coord.x}
                cy={coord.y}
                r="14"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPointIdx(coord.idx)}
              />

              {/* Highlight active point */}
              {activePoint.idx === coord.idx && (
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="4"
                  className="fill-white dark:fill-blue-500 stroke-blue-600 stroke-2"
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Time Axis Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500 pt-1">
        <span>{svgCoords[0]?.pt.shortDate || svgCoords[0]?.pt.date}</span>
        {svgCoords.length > 2 && (
          <span>{svgCoords[Math.floor(svgCoords.length / 2)]?.pt.shortDate}</span>
        )}
        <span>{svgCoords[svgCoords.length - 1]?.pt.shortDate || svgCoords[svgCoords.length - 1]?.pt.date}</span>
      </div>
    </div>
  );
}
