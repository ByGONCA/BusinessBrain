"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { cn } from "@/lib/utils";

interface RadialGaugeVisualizerProps {
  widget: WidgetInstanceConfig;
  currentValue?: number;
  targetValue?: number;
  label?: string;
  unitSuffix?: string;
  totalDeliverables?: number;
  completedDeliverables?: number;
  height?: number;
}

export function RadialGaugeVisualizer({
  widget,
  currentValue,
  targetValue,
  label = "Objetivo Concluído",
  unitSuffix = "",
  totalDeliverables,
  completedDeliverables,
  height = 240,
}: RadialGaugeVisualizerProps) {
  // Use options overrides or real metrics without fabricated fallbacks
  const effectiveTotal = totalDeliverables !== undefined ? totalDeliverables : (widget.options?.targetValue ?? 100);
  const current = currentValue ?? widget.options?.currentValue ?? (completedDeliverables !== undefined ? completedDeliverables : 0);
  const target = targetValue ?? effectiveTotal;

  const percentage = React.useMemo(() => {
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }, [current, target]);

  const dotsCount = 12;
  const completedDotsCount = Math.round((percentage / 100) * dotsCount);

  // SVG Semi-circle Arc Configuration
  const radius = 80;
  const cx = 100;
  const cy = 100;

  const milestoneDots = React.useMemo(() => {
    return Array.from({ length: dotsCount }, (_, i) => {
      // Angle sweeps from Math.PI (180deg, bottom-left) to 0 (0deg, bottom-right)
      const angle = Math.PI - (i / (dotsCount - 1)) * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy - radius * Math.sin(angle);
      const isCompleted = i < completedDotsCount;
      return { id: i, x, y, isCompleted };
    });
  }, [dotsCount, completedDotsCount]);

  return (
    <div
      className="flex flex-col items-center justify-center p-6 text-center select-none"
      style={{ minHeight: `${height}px` }}
    >
      <div className="relative w-48 h-28 my-2 flex items-end justify-center">
        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
          {/* Subtle rail track */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800/60"
            strokeWidth="2"
          />
          {/* Discrete Milestone Dots */}
          {milestoneDots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={4.5}
              className={cn(
                "transition-colors duration-300",
                dot.isCompleted
                  ? "fill-emerald-500"
                  : "fill-zinc-300 dark:fill-zinc-700/60"
              )}
            />
          ))}
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute bottom-1 flex flex-col items-center pointer-events-none">
          <span className="text-3xl font-extrabold text-foreground tracking-tight font-mono">
            {percentage}%
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2 font-medium">
        {current.toLocaleString()}{unitSuffix} de {target.toLocaleString()}{unitSuffix} {label}
      </p>
    </div>
  );
}
