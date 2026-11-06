"use client";

import * as React from "react";
import NextLink from "next/link";
import {
  Folder,
  GitBranch,
  ArrowUpRight,
  CheckSquare,
  GitPullRequest,
  Calendar,
  Video,
  Layers,
  Clock,
  User,
} from "lucide-react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { useLanguage } from "@/lib/i18n";

export interface TableVisualizerProps {
  widget: WidgetInstanceConfig;
  projects?: Array<{ id: string; title: string; status?: string; updated_at?: string }>;
  decisions?: Array<{ id: string; title: string; status?: string; updated_at: string }>;
  tasks?: Array<{
    id: string;
    title: string;
    status?: string;
    priority?: string;
    updated_at?: string;
    created_at?: string;
    assignee?: string;
    due_date?: string;
  }>;
  calendarEvents?: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime?: string;
    meetUrl?: string;
    attendeesCount?: number;
    attendees?: string[];
  }>;
  githubData?: {
    prs: Array<{
      id: string;
      title: string;
      repo?: string;
      author?: string;
      status?: string;
      url?: string;
      updated_at?: string;
    }>;
    repos: Array<{ id: string; name: string; url?: string; stars?: number; openIssues?: number }>;
  };
  financialSnapshot?: any;
  currency?: string;
  className?: string;
}

export function TableVisualizer({
  widget,
  projects = [],
  decisions = [],
  tasks = [],
  calendarEvents = [],
  githubData,
  financialSnapshot,
  currency = "EUR",
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

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleTimeString(formatLocale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // 1. Projects Table
  if (widget.metricId === "workspace.projects") {
    const statusFilter = widget.filters?.status || "active";
    const filteredProjects = projects.filter((p) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return p.status !== "completed" && p.status !== "archived";
      return p.status === statusFilter;
    }).slice(0, 5);

    if (filteredProjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {t.widgets.noActiveProjects}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
        {filteredProjects.map((project) => (
          <NextLink
            key={project.id}
            href={`/dashboard/projects?id=${project.id}`}
            className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-xs font-medium text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground font-mono">
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
    }).slice(0, 5);

    if (filteredDecisions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {locale === "pt" ? "Sem decisões de arquitetura registadas." : "No architectural decisions found."}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
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
                <span className="text-xs font-medium text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {decision.title}
                </span>
                {isProposed && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Proposed ADR" />
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground font-mono">
                <span>{formatDate(decision.updated_at)}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </NextLink>
          );
        })}
      </div>
    );
  }

  // 3. Tasks Table
  if (widget.metricId === "workspace.tasks") {
    const statusFilter = widget.filters?.status || "all";
    const filteredTasks = tasks.filter((task) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active" || statusFilter === "todo") {
        return task.status !== "completed" && task.status !== "done";
      }
      return task.status === statusFilter;
    }).slice(0, 5);

    if (filteredTasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {locale === "pt" ? "Nenhuma tarefa encontrada." : "No tasks found in workspace."}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
        {filteredTasks.map((task) => {
          const isDone = task.status === "completed" || task.status === "done";
          const isUrgent = task.priority === "urgent" || task.priority === "high";

          return (
            <NextLink
              key={task.id}
              href={`/dashboard/tasks?id=${task.id}`}
              className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckSquare
                  className={`h-4 w-4 shrink-0 ${
                    isDone ? "text-emerald-500" : isUrgent ? "text-rose-500" : "text-blue-500"
                  }`}
                />
                <span
                  className={`text-xs font-medium truncate transition-colors ${
                    isDone
                      ? "line-through text-muted-foreground"
                      : "text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  }`}
                >
                  {task.title}
                </span>
                {task.priority && (
                  <span
                    className={`text-[10px] font-mono capitalize ${
                      isUrgent ? "text-rose-400" : "text-zinc-500"
                    }`}
                  >
                    • {task.priority}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground font-mono">
                <span>{formatDate(task.due_date || task.updated_at)}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </NextLink>
          );
        })}
      </div>
    );
  }

  // 4. GitHub Open PRs Table
  if (widget.metricId === "github.open_prs") {
    const prList = githubData?.prs || [];

    if (prList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {locale === "pt" ? "Sem pull requests abertos no momento." : "No open pull requests recorded."}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
        {prList.slice(0, 5).map((pr) => {
          const prHref = pr.url || "/dashboard/projects";

          return (
            <a
              key={pr.id}
              href={prHref}
              target={pr.url ? "_blank" : undefined}
              rel={pr.url ? "noopener noreferrer" : undefined}
              className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GitPullRequest className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground truncate block group-hover:text-emerald-500 transition-colors">
                    {pr.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                    {pr.repo && <span className="text-zinc-400">{pr.repo}</span>}
                    {pr.author && (
                      <span className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {pr.author}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground font-mono">
                <span>{formatDate(pr.updated_at)}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  // 5. Calendar Upcoming Meetings Table
  if (widget.metricId === "calendar.upcoming_meetings") {
    if (calendarEvents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {locale === "pt" ? "Sem reuniões agendadas." : "No upcoming meetings scheduled."}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
        {calendarEvents.slice(0, 5).map((evt) => {
          const hasMeet = Boolean(evt.meetUrl);

          return (
            <div
              key={evt.id}
              className="group flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  {hasMeet ? <Video className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground truncate block">
                    {evt.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span>{formatDate(evt.startTime)} {formatTime(evt.startTime)}</span>
                    {evt.attendeesCount ? (
                      <span className="text-zinc-400">({evt.attendeesCount} pax)</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasMeet ? (
                  <a
                    href={evt.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors shadow-2xs"
                  >
                    <span>Entrar</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                ) : (
                  <NextLink
                    href="/dashboard/meetings"
                    className="text-xs text-muted-foreground hover:text-foreground font-mono inline-flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                  </NextLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 6. Plans Breakdown Table
  if (widget.metricId === "finance.plans_breakdown") {
    const activeCurrency = financialSnapshot?.primaryCurrency || currency;
    const activeTotals = financialSnapshot?.currencies?.[activeCurrency];
    const plansData = activeTotals?.revenueByPlan ? Object.values(activeTotals.revenueByPlan) : [];

    if (plansData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground dark:text-zinc-500">
          <p className="text-xs font-medium">
            {t.widgets.noPlansRecorded}
          </p>
        </div>
      );
    }

    return (
      <div className={`divide-y divide-border-subtle ${className || ""}`}>
        {plansData.map((plan: any) => (
          <div
            key={plan.planName}
            className="flex items-center justify-between py-2 px-1 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium text-foreground truncate">{plan.planName}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-muted-foreground">{plan.subscribersCount} subs</span>
              <span className="font-semibold text-foreground">
                {(plan.mrrCents / 100).toLocaleString(formatLocale, { style: "currency", currency: activeCurrency.toUpperCase() })}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-muted-foreground">
      <p className="text-xs">
        {locale === "pt" ? "Tabela não suportada para esta métrica." : "Table not supported for this metric."}
      </p>
    </div>
  );
}
