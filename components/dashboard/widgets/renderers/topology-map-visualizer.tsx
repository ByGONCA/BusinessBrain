"use client";

import * as React from "react";
import NextLink from "next/link";
import { PhosphorNetwork } from "@/components/icons";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { CompanyGraphData } from "@/lib/connections/types";
import { useLanguage, en } from "@/lib/i18n";

export interface TopologyMapVisualizerProps {
  widget: WidgetInstanceConfig;
  graphData?: CompanyGraphData;
  connectionCount?: number;
  pagesCount?: number;
  decisionsCount?: number;
  projectsCount?: number;
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
  className?: string;
}

export function TopologyMapVisualizer({
  widget: _widget,
  graphData,
  connectionCount,
  pagesCount = 0,
  decisionsCount = 0,
  projectsCount = 0,
  onDemoNavigate,
  demoMode,
  className,
}: TopologyMapVisualizerProps) {
  const { t } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;

  const totalConnectionsDisplay = connectionCount ?? graphData?.totalConnections ?? 0;
  const totalNodesDisplay =
    graphData?.nodes?.length || pagesCount + decisionsCount + projectsCount;

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

  return (
    <div className={cn("space-y-3 select-none", className)}>
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
            <PhosphorNetwork className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {totalNodesDisplay} {h.mappedNodes.toLowerCase()} • {totalConnectionsDisplay}{" "}
            {h.relations.toLowerCase()}
          </span>
        </div>
        <LinkWrapper
          href="/dashboard/connections"
          className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
        >
          {h.openFullGraph}
        </LinkWrapper>
      </div>

      {/* SVG Mini-Map Wireframe */}
      <div className="h-28 w-full rounded-lg border border-zinc-200/80 dark:border-white/[0.04] bg-zinc-50 dark:bg-[#0A0B0D] flex items-center justify-center p-2 relative overflow-hidden">
        <svg className="w-full h-full text-zinc-400 dark:text-zinc-600" viewBox="0 0 300 100" fill="none">
          <line
            x1="50"
            y1="50"
            x2="150"
            y2="30"
            stroke="rgba(129, 140, 248, 0.4)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1="150"
            y1="30"
            x2="250"
            y2="50"
            stroke="rgba(129, 140, 248, 0.4)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line x1="150" y1="30" x2="150" y2="80" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1" />
          <line x1="50" y1="50" x2="150" y2="80" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" />
          <line x1="250" y1="50" x2="150" y2="80" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1" />

          {/* Central Node */}
          <circle cx="150" cy="30" r="8" className="fill-white dark:fill-[#121316]" stroke="#818CF8" strokeWidth="2" />
          <circle cx="150" cy="30" r="2.5" fill="#818CF8" />

          {/* Left ADR Node */}
          <circle cx="50" cy="50" r="7" className="fill-white dark:fill-[#121316]" stroke="#F59E0B" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="2" fill="#F59E0B" />

          {/* Right Project Node */}
          <circle cx="250" cy="50" r="7" className="fill-white dark:fill-[#121316]" stroke="#10B981" strokeWidth="1.5" />
          <circle cx="250" cy="50" r="2" fill="#10B981" />

          {/* Bottom Pages Node */}
          <circle cx="150" cy="80" r="6" className="fill-white dark:fill-[#121316]" stroke="#A855F7" strokeWidth="1.5" />
          <circle cx="150" cy="80" r="1.5" fill="#A855F7" />
        </svg>
      </div>
    </div>
  );
}
