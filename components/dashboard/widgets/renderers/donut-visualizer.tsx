"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
  percentage?: number;
}

interface DonutVisualizerProps {
  widget: WidgetInstanceConfig;
  data?: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
}

const DEFAULT_PALETTE = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#8B5CF6", // purple-500
  "#EC4899", // pink-500
  "#6366F1", // indigo-500
];

export function DonutVisualizer({
  widget: _widget,
  data = [],
  centerLabel = "Total",
  centerValue,
  height = 240,
}: DonutVisualizerProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const total = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [data]);

  const segmentsWithPercent = React.useMemo(() => {
    if (total === 0) return [];
    return data.map((seg, i) => ({
      ...seg,
      color: seg.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      percentage: Math.round((seg.value / total) * 100),
    }));
  }, [data, total]);

  // SVG Geometry Constants
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute stroke-dasharray and dashoffset for each slice
  let accumulatedOffset = 0;
  const slicePaths = segmentsWithPercent.map((seg, index) => {
    const fraction = seg.value / total;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += fraction * circumference;
    return {
      ...seg,
      index,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  if (data.length === 0 || total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ minHeight: `${height}px` }}
      >
        <div className="h-16 w-16 rounded-full border-4 border-dashed border-zinc-300 dark:border-zinc-700/60 mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Nenhum dado para distribuição</p>
      </div>
    );
  }

  const activeSegment = hoveredIndex !== null ? segmentsWithPercent[hoveredIndex] : null;

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-around gap-6 p-4 select-none"
      style={{ minHeight: `${height}px` }}
    >
      {/* Donut SVG */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Subtle rail track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800/40"
            strokeWidth={strokeWidth}
          />
          {slicePaths.map((slice) => {
            const isHovered = hoveredIndex === slice.index;
            return (
              <circle
                key={slice.id || slice.index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(slice.index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center Summary Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
          <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[110px]">
            {activeSegment ? activeSegment.label : centerLabel}
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight font-mono">
            {activeSegment ? `${activeSegment.percentage}%` : centerValue || total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown List */}
      <div className="flex-1 w-full max-w-xs space-y-2">
        {segmentsWithPercent.map((seg, idx) => {
          const isHovered = hoveredIndex === idx;
          return (
            <div
              key={seg.id || idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs",
                isHovered
                  ? "bg-hover shadow-2xs font-medium"
                  : "hover:bg-hover/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="truncate max-w-[140px] text-foreground font-medium">{seg.label}</span>
              </div>
              <div className="flex items-center gap-3 font-mono shrink-0">
                <span className="text-foreground">{seg.value.toLocaleString()}</span>
                <span className="text-muted-foreground w-10 text-right">{seg.percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
