"use client";

import * as React from "react";
import NextLink from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { useLanguage } from "@/lib/i18n";

export interface PriorityVisualizerItem {
  id: string;
  title: string;
  type: "decision" | "task" | "project";
  priority?: "urgent" | "high" | "normal";
  status: string;
  context?: string;
  href: string;
  dueDate?: string | null;
  updatedAt: string;
}

export interface PrioritiesVisualizerProps {
  widget: WidgetInstanceConfig;
  priorityItems?: PriorityVisualizerItem[];
  className?: string;
}

export function PrioritiesVisualizer({
  widget: _widget,
  priorityItems = [],
  className,
}: PrioritiesVisualizerProps) {
  const { locale, t } = useLanguage();
  const formatLocale = locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US";

  if (priorityItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-6 text-zinc-400 dark:text-zinc-500">
        <CheckCircle2 className="h-6 w-6 text-emerald-500/80 mb-2" />
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {t.widgets.allPrioritiesUpToDate}
        </p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          {t.widgets.noUrgentPriorities}
        </p>
      </div>
    );
  }

  // Display top 4 actionable priorities
  const visibleItems = priorityItems.slice(0, 4);

  return (
    <div className={`divide-y divide-zinc-100 dark:divide-white/[0.04] ${className || ""}`}>
      {visibleItems.map((item) => {
        const isUrgent = item.status === "overdue" || item.priority === "urgent";
        const isHigh = item.priority === "high" || item.status === "proposed";

        return (
          <NextLink
            key={item.id}
            href={item.href}
            className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Subtle status dot (Not a fake button pill) */}
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isUrgent
                    ? "bg-rose-500 animate-pulse"
                    : isHigh
                    ? "bg-amber-400"
                    : "bg-blue-500"
                }`}
                title={item.status}
              />

              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </p>
                {item.context && (
                  <p className="text-[10px] text-zinc-400 truncate">
                    {item.context}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] text-zinc-400 font-mono">
              {item.status === "overdue" ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold text-[10px]">
                  {locale === "pt" ? "Em atraso" : "Overdue"}
                </span>
              ) : item.status === "proposed" ? (
                <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                  {locale === "pt" ? "Proposta" : "Proposed"}
                </span>
              ) : null}

              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-500" />
            </div>
          </NextLink>
        );
      })}
    </div>
  );
}
