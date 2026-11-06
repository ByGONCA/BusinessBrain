"use client";

import * as React from "react";
import NextLink from "next/link";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
} from "@/components/icons";
import { TrendingUp, CheckCircle2 } from "lucide-react";
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
    <div className={cn("grid gap-4 sm:gap-5 select-none w-full", gridColsClass, className)}>
      {/* Card 1: Active Projects */}
      <LinkWrapper
        href="/dashboard/projects"
        className="bg-card rounded-2xl p-5 hover:shadow-md transition-all shadow-xs group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{h.activeProjects || "Active Projects"}</span>
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <PhosphorFolder className="h-4 w-4 shrink-0" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {demoMode ? "12" : projectsCount}
          </span>
          {projectsCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-muted-foreground">
              0 active
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {projectsCount === 0
            ? "No active workstreams"
            : projectsCount === 1
            ? "1 ongoing workstream"
            : `${projectsCount} ongoing workstreams`}
        </p>
      </LinkWrapper>

      {/* Card 2: Decisions & ADRs */}
      <LinkWrapper
        href="/dashboard/decisions"
        className="bg-card rounded-2xl p-5 hover:shadow-md transition-all shadow-xs group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{h.decisionsAdr || "Decisions & ADRs"}</span>
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
            <PhosphorGitBranch className="h-4 w-4 shrink-0" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {demoMode ? "8" : decisionsCount}
          </span>
          {decisionsCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
              <CheckCircle2 className="h-3 w-3" />
              Logged
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-muted-foreground">
              0 records
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {decisionsCount === 0
            ? "0 architecture records"
            : decisionsCount === 1
            ? "1 documented decision"
            : `${decisionsCount} documented decisions`}
        </p>
      </LinkWrapper>

      {/* Card 3: Documented Knowledge & Pages */}
      <LinkWrapper
        href="/dashboard/pages"
        className="bg-card rounded-2xl p-5 hover:shadow-md transition-all shadow-xs group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{h.pages || "Knowledge Base"}</span>
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <PhosphorBookOpen className="h-4 w-4 shrink-0" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {demoMode ? "24" : pagesCount}
          </span>
          {pagesCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
              Published
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-muted-foreground">
              Empty
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {pagesCount === 0
            ? "0 wiki documents"
            : pagesCount === 1
            ? "1 published document"
            : `${pagesCount} published documents`}
        </p>
      </LinkWrapper>

      {/* Card 4: Knowledge Graph Connections */}
      <LinkWrapper
        href="/dashboard/connections"
        className="bg-card rounded-2xl p-5 hover:shadow-md transition-all shadow-xs group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{h.activeConnections || "Company Map"}</span>
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <PhosphorNetwork className="h-4 w-4 shrink-0" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {demoMode ? "48" : totalConnectionsDisplay}
          </span>
          {totalConnectionsDisplay > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
              Mapped
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-muted-foreground">
              0 links
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {totalConnectionsDisplay === 0
            ? "0 mapped relationships"
            : totalConnectionsDisplay === 1
            ? "1 mapped relationship"
            : `${totalConnectionsDisplay} mapped relationships`}
        </p>
      </LinkWrapper>
    </div>
  );
}
