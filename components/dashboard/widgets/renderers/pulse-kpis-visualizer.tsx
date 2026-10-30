"use client";

import * as React from "react";
import NextLink from "next/link";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { useLanguage, en } from "@/lib/i18n";

export interface PulseKpisVisualizerProps {
  widget: WidgetInstanceConfig;
  projectsCount?: number;
  decisionsCount?: number;
  pagesCount?: number;
  connectionCount?: number;
  totalConnections?: number;
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
  className?: string;
}

export function PulseKpisVisualizer({
  widget,
  projectsCount = 0,
  decisionsCount = 0,
  pagesCount = 0,
  connectionCount,
  totalConnections = 0,
  onDemoNavigate,
  demoMode,
  className,
}: PulseKpisVisualizerProps) {
  const { t } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;

  const totalConnectionsDisplay = connectionCount ?? totalConnections;

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

  const gridColsClass =
    widget.size === "sm"
      ? "grid-cols-1"
      : widget.size === "md"
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-3 select-none", gridColsClass, className)}>
      {/* Card 1: Active Projects */}
      <LinkWrapper
        href="/dashboard/projects"
        className="bg-zinc-50 dark:bg-[#0E1013] border border-zinc-200/80 dark:border-white/[0.06] rounded-xl p-3.5 hover:border-emerald-500/40 hover:bg-zinc-100/60 dark:hover:bg-[#15171C] transition-all shadow-xs group"
      >
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <PhosphorFolder className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{h.activeProjects}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-300 transition-colors">
          {projectsCount}
        </div>
      </LinkWrapper>

      {/* Card 2: Architecture Decisions */}
      <LinkWrapper
        href="/dashboard/decisions"
        className="bg-zinc-50 dark:bg-[#0E1013] border border-zinc-200/80 dark:border-white/[0.06] rounded-xl p-3.5 hover:border-amber-500/40 hover:bg-zinc-100/60 dark:hover:bg-[#15171C] transition-all shadow-xs group"
      >
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <PhosphorGitBranch className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <span>{h.decisionsAdr}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors">
          {decisionsCount}
        </div>
      </LinkWrapper>

      {/* Card 3: Documented Knowledge & Pages */}
      <LinkWrapper
        href="/dashboard/pages"
        className="bg-zinc-50 dark:bg-[#0E1013] border border-zinc-200/80 dark:border-white/[0.06] rounded-xl p-3.5 hover:border-purple-500/40 hover:bg-zinc-100/60 dark:hover:bg-[#15171C] transition-all shadow-xs group"
      >
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <PhosphorBookOpen className="h-4 w-4 text-purple-500 dark:text-purple-400 shrink-0" />
          <span>{h.pages}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-purple-500 dark:group-hover:text-purple-300 transition-colors">
          {pagesCount}
        </div>
      </LinkWrapper>

      {/* Card 4: Knowledge Graph Connections */}
      <LinkWrapper
        href="/dashboard/connections"
        className="bg-zinc-50 dark:bg-[#0E1013] border border-zinc-200/80 dark:border-white/[0.06] rounded-xl p-3.5 hover:border-indigo-500/40 hover:bg-zinc-100/60 dark:hover:bg-[#15171C] transition-all shadow-xs group"
      >
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <PhosphorNetwork className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <span>{h.activeConnections}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">
          {totalConnectionsDisplay}
        </div>
      </LinkWrapper>
    </div>
  );
}
