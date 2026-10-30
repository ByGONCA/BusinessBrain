"use client";

import * as React from "react";
import NextLink from "next/link";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { TimelineEvent } from "@/lib/timeline/types";
import { useLanguage, en } from "@/lib/i18n";

export interface TimelineActivityVisualizerProps {
  widget: WidgetInstanceConfig;
  timelineEvents?: TimelineEvent[];
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
  className?: string;
}

export function TimelineActivityVisualizer({
  widget: _widget,
  timelineEvents = [],
  onDemoNavigate,
  demoMode,
  className,
}: TimelineActivityVisualizerProps) {
  const { t, locale } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;
  const intlLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  const LinkWrapper = React.useCallback(
    ({ href, className: linkClass, children }: any) => {
      if (demoMode && onDemoNavigate) {
        return (
          <button
            type="button"
            onClick={() => onDemoNavigate(href)}
            className={cn("text-left cursor-pointer", linkClass)}
          >
            {children}
          </button>
        );
      }
      return (
        <NextLink href={href} className={linkClass}>
          {children}
        </NextLink>
      );
    },
    [demoMode, onDemoNavigate]
  );

  const sortedEvents = React.useMemo(() => {
    const seen = new Set<string>();
    const unique: TimelineEvent[] = [];
    for (const event of timelineEvents) {
      const key = `${event.title}-${new Date(event.timestamp).getTime()}`;
      if (!seen.has(event.id) && !seen.has(key)) {
        seen.add(event.id);
        seen.add(key);
        unique.push(event);
      }
    }
    return unique.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [timelineEvents]);

  return (
    <div className={cn("space-y-2 select-none", className)}>
      <div className="flex items-center justify-end pb-1">
        <LinkWrapper
          href="/dashboard/timeline"
          className="text-xs text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-medium transition-colors"
        >
          {h.viewAllActivity}
        </LinkWrapper>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
        {sortedEvents.length > 0 ? (
          sortedEvents.slice(0, 5).map((event) => (
            <LinkWrapper
              key={event.id}
              href={event.link?.href || "/dashboard/timeline"}
              className="flex items-center justify-between py-2 px-1 hover:bg-zinc-50 dark:hover:bg-white/[0.03] rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {event.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 ml-2 font-mono">
                <Clock className="h-3 w-3" />
                <span>{new Date(event.timestamp).toLocaleDateString(intlLocale)}</span>
              </div>
            </LinkWrapper>
          ))
        ) : (
          <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {h.noRecentActivity}
          </div>
        )}
      </div>
    </div>
  );
}
