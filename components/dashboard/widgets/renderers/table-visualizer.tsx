"use client";

import * as React from "react";
import NextLink from "next/link";
import { Folder, GitBranch, ArrowUpRight } from "lucide-react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { useLanguage } from "@/lib/i18n";

export interface TableVisualizerProps {
  widget: WidgetInstanceConfig;
  projects?: Array<{ id: string; title: string; status?: string; updated_at?: string }>;
  decisions?: Array<{ id: string; title: string; status?: string; updated_at: string }>;
  className?: string;
}

export function TableVisualizer({
  widget,
  projects = [],
  decisions = [],
  className,
}: TableVisualizerProps) {
  const { locale, t } = useLanguage();
  const formatLocale = locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString(formatLocale, {
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  // 1. Projects Table
  if (widget.metricId === "workspace.projects") {
    const statusFilter = widget.filters?.status || "active";
    const filteredProjects = projects.filter((p) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return p.status !== "completed" && p.status !== "archived";
      return p.status === statusFilter;
    }).slice(0, 4);

    if (filteredProjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-zinc-400 dark:text-zinc-500">
          <p className="text-xs font-medium">
            {t.widgets.noActiveProjects}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-zinc-100 dark:divide-white/[0.04] ${className || ""}`}>
        {filteredProjects.map((project) => (
          <NextLink
            key={project.id}
            href={`/dashboard/projects?id=${project.id}`}
            className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] text-zinc-400 font-mono">
              <span>{formatDate(project.updated_at)}</span>
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </NextLink>
        ))}
      </div>
    );
  }

  // 2. Decisions Table
  if (widget.metricId === "workspace.decisions") {
    const statusFilter = widget.filters?.status || "all";
    const filteredDecisions = decisions.filter((d) => {
      if (statusFilter === "all") return true;
      return (d.status || "accepted") === statusFilter;
    }).slice(0, 4);

    if (filteredDecisions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-zinc-400 dark:text-zinc-500">
          <p className="text-xs font-medium">
            {locale === "pt" ? "Sem decisões de arquitetura registadas." : "No architectural decisions found."}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-zinc-100 dark:divide-white/[0.04] ${className || ""}`}>
        {filteredDecisions.map((decision) => {
          const isProposed = (decision.status || "accepted") === "proposed";

          return (
            <NextLink
              key={decision.id}
              href={`/dashboard/decisions?id=${decision.id}`}
              className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {decision.title}
                </span>
                {isProposed && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Proposed ADR" />
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-zinc-400 font-mono">
                <span>{formatDate(decision.updated_at)}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </NextLink>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-zinc-400">
      <p className="text-xs">
        {locale === "pt" ? "Tabela não suportada para esta métrica." : "Table not supported for this metric."}
      </p>
    </div>
  );
}
