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
      comparisonLabel = t.widgets.stripeNotConnected;
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
          const refundsCents = activeTotals?.totalRefundsCents || 0;
          mainValue = formatCurrency(refundsCents);
          comparisonLabel = locale === "pt" ? "Total deduzido em reembolsos" : "Processed customer refunds";
          break;
        }

        default:
          mainValue = "—";
      }
    }
  } else if (capability?.category === "workspace") {
    switch (widget.metricId) {
      case "workspace.projects_count":
        mainValue = formatCount(projectsCount || 0);
        comparisonLabel = locale === "pt" ? "Projetos ativos" : "Active projects in workspace";
        break;
      case "workspace.decisions_count":
        mainValue = formatCount(decisionsCount || 0);
        comparisonLabel = locale === "pt" ? "Decisões ADR registadas" : "Architecture decision records";
        break;
      case "workspace.pages_count":
        mainValue = formatCount(pagesCount || 0);
        comparisonLabel = locale === "pt" ? "Páginas documentadas" : "Documented knowledge pages";
        break;
      case "workspace.connections_count":
        mainValue = formatCount(connectionCount ?? totalConnections ?? 0);
        comparisonLabel = locale === "pt" ? "Conexões mapeadas" : "Verified graph connections";
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
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
          {mainValue}
        </span>
      </div>

      {/* Comparison & Metadata Row */}
      <div className="flex items-center gap-2 text-xs">
        {showTrend && comparisonPercentage !== null && (
          <span
            className={`inline-flex items-center gap-1 font-medium font-mono text-[11px] ${
              isZero
                ? "text-zinc-500 dark:text-zinc-400"
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
          <span className="text-zinc-500 dark:text-zinc-400 text-[11px] truncate">
            {comparisonLabel}
          </span>
        )}
      </div>
    </div>
  );
}
