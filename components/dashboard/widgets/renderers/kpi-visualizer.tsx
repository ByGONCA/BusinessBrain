"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { getMetricCapability } from "@/lib/widgets/registry";
import { StripeFinancialSnapshot } from "@/lib/integrations/stripe/types";
import { filterFinancialMetricsByPeriod } from "@/lib/integrations/stripe/types";
import { useLanguage } from "@/lib/i18n";

export interface KpiVisualizerProps {
  widget: WidgetInstanceConfig;
  financialSnapshot?: StripeFinancialSnapshot | null;
  currency?: string;
  projectsCount?: number;
  decisionsCount?: number;
  pagesCount?: number;
  connectionCount?: number;
  totalConnections?: number;
  tasksCount?: number;
  goalsCount?: number;
  calendarEvents?: Array<{ id: string; title: string; startTime: string; endTime?: string; meetUrl?: string; attendeesCount?: number }>;
  githubData?: {
    prs: Array<{ id: string; title: string; repo?: string; author?: string; status?: string; url?: string }>;
    repos: Array<{ id: string; name: string; url?: string; stars?: number; openIssues?: number }>;
  };
  isStripeConnected?: boolean;
  className?: string;
}

export function KpiVisualizer({
  widget,
  financialSnapshot,
  currency = "EUR",
  projectsCount,
  decisionsCount,
  pagesCount,
  connectionCount,
  totalConnections,
  tasksCount,
  goalsCount,
  calendarEvents,
  githubData,
  isStripeConnected,
  className,
}: KpiVisualizerProps) {
  const { locale, t } = useLanguage();
  const formatLocale = locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US";
  const capability = getMetricCapability(widget.metricId);
  const activeCurrency = financialSnapshot?.primaryCurrency || currency;

  // Resolve totals for current currency bucket
  const activeTotals = financialSnapshot?.currencies?.[activeCurrency];

  // Helper for formatting currency amounts
  const formatCurrency = (cents: number, curr = activeCurrency) => {
    try {
      return (cents / 100).toLocaleString(formatLocale, {
        style: "currency",
        currency: curr.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return `${(cents / 100).toFixed(2)} ${curr.toUpperCase()}`;
    }
  };

  // Helper for formatting integer counts
  const formatCount = (count: number) => {
    return count.toLocaleString(formatLocale);
  };

  // Resolve Value & Comparison based on metric ID
  let mainValue = "—";
  let comparisonPercentage: number | null = null;
  let comparisonLabel = "";

  if (capability?.category === "finance") {
    if (!financialSnapshot) {
      mainValue = "—";
      comparisonLabel = isStripeConnected
        ? (locale === "pt" ? "A sincronizar dados Stripe..." : "Syncing Stripe snapshot...")
        : t.widgets.stripeNotConnected;
    } else {
      switch (widget.metricId) {
        case "finance.net_revenue": {
          const timeRange = (widget.timeRange === "current" ? "30D" : widget.timeRange) || "30D";
          const filtered = filterFinancialMetricsByPeriod(
            financialSnapshot,
            activeCurrency,
            timeRange as any,
            formatLocale,
            "monthly"
          );
          mainValue = formatCurrency(filtered.periodNetRevenueCents);
          comparisonPercentage = filtered.periodComparisonPercentage;
          comparisonLabel =
            timeRange === "30D" ? t.widgets.vsPrevious30Days : t.widgets.vsPreviousPeriod;
          break;
        }

        case "finance.gross_revenue": {
          const timeRange = (widget.timeRange === "current" ? "30D" : widget.timeRange) || "30D";
          const filtered = filterFinancialMetricsByPeriod(
            financialSnapshot,
            activeCurrency,
            timeRange as any,
            locale === "pt" ? "pt-PT" : "en-US",
            "monthly"
          );
          mainValue = formatCurrency(filtered.periodGrossRevenueCents);
          comparisonPercentage = filtered.periodComparisonPercentage;
          comparisonLabel = t.widgets.vsPreviousPeriod;
          break;
        }

        case "finance.mrr": {
          const mrrCents = activeTotals?.activeMrrCents || 0;
          mainValue = formatCurrency(mrrCents);
          comparisonLabel = t.widgets.activeRecurringSubs;
          break;
        }

        case "finance.arr": {
          const arrCents = (activeTotals?.activeMrrCents || 0) * 12;
          mainValue = formatCurrency(arrCents);
          comparisonLabel = t.widgets.annualizedRunRate;
          break;
        }

        case "finance.active_subscriptions": {
          const subs = activeTotals?.activeSubscribersCount || 0;
          mainValue = formatCount(subs);
          comparisonLabel = t.widgets.activeRecurringSubs;
          break;
        }

        case "finance.active_customers": {
          const customers = financialSnapshot.totalActiveCustomersCount || 0;
          mainValue = formatCount(customers);
          comparisonLabel = locale === "pt" ? "Clientes únicos pagantes" : "Distinct paying customer accounts";
          break;
        }

        case "finance.refunds": {
          const timeRange = (widget.timeRange === "current" ? "30D" : widget.timeRange) || "30D";
          const filtered = filterFinancialMetricsByPeriod(
            financialSnapshot,
            activeCurrency,
            timeRange as any,
            formatLocale,
            "monthly"
          );
          const refundsCents = filtered.periodRefundsCents ?? (activeTotals?.totalRefundsCents || 0);
          mainValue = formatCurrency(refundsCents);
          comparisonLabel = locale === "pt" ? `Total reembolsado (${timeRange})` : `Processed refunds (${timeRange})`;
          break;
        }

        case "finance.pulse_strip": {
          const netRev = activeTotals?.netRevenueCents || 0;
          mainValue = formatCurrency(netRev);
          comparisonLabel = locale === "pt" ? "Receita líquida total" : "Total net revenue";
          break;
        }

        default:
          mainValue = "—";
      }
    }
  } else if (capability?.category === "workspace") {
    switch (widget.metricId) {
      case "workspace.projects_count":
        mainValue = formatCount(projectsCount ?? 0);
        comparisonLabel = locale === "pt" ? "Projetos ativos" : "Active projects in workspace";
        break;
      case "workspace.decisions_count":
        mainValue = formatCount(decisionsCount ?? 0);
        comparisonLabel = locale === "pt" ? "Decisões ADR registadas" : "Architecture decision records";
        break;
      case "workspace.pages_count":
        mainValue = formatCount(pagesCount ?? 0);
        comparisonLabel = locale === "pt" ? "Páginas documentadas" : "Documented knowledge pages";
        break;
      case "workspace.connections_count":
        mainValue = formatCount(connectionCount ?? totalConnections ?? 0);
        comparisonLabel = locale === "pt" ? "Conexões mapeadas" : "Verified graph connections";
        break;
      case "workspace.tasks_count":
      case "workspace.tasks":
        mainValue = formatCount(tasksCount ?? 0);
        comparisonLabel = locale === "pt" ? "Tarefas no sprint" : "Tasks in active workspace";
        break;
      case "workspace.goals_count":
      case "workspace.goals":
        mainValue = formatCount(goalsCount ?? 0);
        comparisonLabel = locale === "pt" ? "Objetivos definidos" : "Defined strategic goals";
        break;
      case "workspace.pulse_kpis":
        mainValue = formatCount((projectsCount ?? 0) + (decisionsCount ?? 0) + (pagesCount ?? 0));
        comparisonLabel = locale === "pt" ? "Total de artefactos" : "Total workspace artifacts";
        break;
      default:
        mainValue = "0";
        comparisonLabel = locale === "pt" ? "Métrica ativa" : "Active metric";
    }
  } else if (capability?.category === "github") {
    switch (widget.metricId) {
      case "github.open_prs":
        if (githubData && Array.isArray(githubData.prs)) {
          mainValue = formatCount(githubData.prs.length);
          comparisonLabel = locale === "pt" ? "PRs abertos em acompanhamento" : "Open pull requests tracked";
        } else {
          mainValue = "—";
          comparisonLabel = locale === "pt" ? "GitHub não ligado" : "GitHub integration not connected";
        }
        break;
      case "github.repo_activity":
        if (githubData && Array.isArray(githubData.repos)) {
          mainValue = formatCount(githubData.repos.length);
          comparisonLabel = locale === "pt" ? "Repositórios sincronizados" : "Synchronized repositories";
        } else {
          mainValue = "—";
          comparisonLabel = locale === "pt" ? "GitHub não ligado" : "GitHub integration not connected";
        }
        break;
      default:
        mainValue = "—";
    }
  } else if (capability?.category === "calendar") {
    switch (widget.metricId) {
      case "calendar.upcoming_meetings":
        if (calendarEvents) {
          mainValue = formatCount(calendarEvents.length);
          comparisonLabel = locale === "pt" ? "Reuniões agendadas" : "Scheduled meetings";
        } else {
          mainValue = "—";
          comparisonLabel = locale === "pt" ? "Calendário não conectado" : "Calendar not connected";
        }
        break;
      case "calendar.weekly_meeting_hours":
        if (calendarEvents) {
          const totalHours = calendarEvents.reduce((acc, ev) => {
            if (!ev.startTime) return acc;
            const start = new Date(ev.startTime).getTime();
            const end = ev.endTime ? new Date(ev.endTime).getTime() : start + 30 * 60 * 1000;
            const dur = Math.max(0, (end - start) / (1000 * 60 * 60));
            return acc + dur;
          }, 0);
          mainValue = `${totalHours.toFixed(1)}h`;
          comparisonLabel = locale === "pt" ? "Horas de reuniões (semana)" : "Meeting hours this week";
        } else {
          mainValue = "—";
          comparisonLabel = locale === "pt" ? "Calendário não conectado" : "Calendar not connected";
        }
        break;
      default:
        mainValue = "—";
    }
  } else if (capability?.category === "integrations") {
    switch (widget.metricId) {
      case "integrations.status_overview":
        mainValue = `${connectionCount ?? 0}/${totalConnections ?? 5}`;
        comparisonLabel = locale === "pt" ? "Integrações ativas" : "Active connected integrations";
        break;
      default:
        mainValue = "—";
    }
  }

  const showTrend = widget.options?.showTrend !== false && comparisonPercentage !== null;
  const isPositive = (comparisonPercentage || 0) > 0;
  const isZero = comparisonPercentage === 0;

  return (
    <div className={`space-y-2 select-none ${className || ""}`}>
      {/* Primary Value */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
          {mainValue}
        </span>
      </div>

      {/* Comparison & Metadata Row */}
      <div className="flex items-center gap-2 text-xs">
        {showTrend && comparisonPercentage !== null && (
          <span
            className={`inline-flex items-center gap-1 font-medium font-mono text-[11px] ${
              isZero
                ? "text-muted-foreground"
                : isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isZero ? (
              <Minus className="h-3 w-3" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {comparisonPercentage.toFixed(1)}%
            </span>
          </span>
        )}

        {comparisonLabel && (
          <span className="text-muted-foreground text-[11px] truncate">
            {comparisonLabel}
          </span>
        )}
      </div>
    </div>
  );
}
