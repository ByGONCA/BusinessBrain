"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { cn } from "@/lib/utils";

interface ProgressItem {
  id: string;
  label: string;
  current: number;
  total: number;
  color?: string;
  unitSuffix?: string;
}

interface ProgressVisualizerProps {
  widget: WidgetInstanceConfig;
  items?: ProgressItem[];
  singleCurrent?: number;
  singleTotal?: number;
  singleLabel?: string;
  height?: number;
}

export function ProgressVisualizer({
  widget,
  items,
  singleCurrent,
  singleTotal,
  singleLabel,
  height = 200,
}: ProgressVisualizerProps) {
  const progressList: ProgressItem[] = React.useMemo(() => {
    if (items && items.length > 0) return items;

    // Single item fallback
    const cur = singleCurrent ?? widget.options?.currentValue ?? 14;
    const tot = singleTotal ?? widget.options?.targetValue ?? 20;
    const lbl = singleLabel || widget.title || "Progresso Global";

    return [
      {
        id: "single",
        label: lbl,
        current: cur,
        total: tot,
        color: "bg-blue-500",
        unitSuffix: "",
      },
    ];
  }, [items, singleCurrent, singleTotal, singleLabel, widget]);

  return (
    <div
      className="flex flex-col justify-center p-6 space-y-4 select-none"
      style={{ minHeight: `${height}px` }}
    >
      {progressList.map((item) => {
        const percent = item.total > 0 ? Math.min(100, Math.round((item.current / item.total) * 100)) : 0;

        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground truncate max-w-[180px]">{item.label}</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground text-[11px]">
                  {item.current} / {item.total} {item.unitSuffix}
                </span>
                <span className="font-bold text-foreground w-10 text-right">{percent}%</span>
              </div>
            </div>

            <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", item.color || "bg-blue-500")}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
