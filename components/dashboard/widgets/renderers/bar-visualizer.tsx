"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { StripeFinancialSnapshot } from "@/lib/integrations/stripe/types";
import { useLanguage } from "@/lib/i18n";

export interface BarVisualizerProps {
  widget: WidgetInstanceConfig;
  financialSnapshot?: StripeFinancialSnapshot | null;
  currency?: string;
  className?: string;
}

export function BarVisualizer({
  widget,
  financialSnapshot,
  currency = "EUR",
  className,
}: BarVisualizerProps) {
  const { locale, t } = useLanguage();
  const formatLocale = locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US";
  const activeCurrency = financialSnapshot?.primaryCurrency || currency;
  const activeTotals = financialSnapshot?.currencies?.[activeCurrency];

  // Helper for formatting currency amounts
  const formatMoney = (cents: number) => {
    try {
      return (cents / 100).toLocaleString(formatLocale, {
        style: "currency",
        currency: activeCurrency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      return `${(cents / 100).toFixed(0)} ${activeCurrency.toUpperCase()}`;
    }
  };

  // Extract plans breakdown
  const plansData = React.useMemo(() => {
    if (!activeTotals?.revenueByPlan) return [];
    return Object.values(activeTotals.revenueByPlan).sort(
      (a, b) => b.mrrCents - a.mrrCents
    );
  }, [activeTotals]);

  const totalMrr = activeTotals?.activeMrrCents || 1;

  if (plansData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4 text-zinc-400 dark:text-zinc-500">
        <p className="text-xs font-medium">
          {t.widgets.noPlansRecorded}
        </p>
      </div>
    );
  }

  const BAR_COLORS = [
    "bg-blue-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
  ];

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {plansData.map((plan, idx) => {
        const percentOfMrr = Math.min(100, Math.round((plan.mrrCents / totalMrr) * 100));
        const colorClass = BAR_COLORS[idx % BAR_COLORS.length];

        return (
          <div key={plan.planName} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`h-2 w-2 rounded-full ${colorClass} shrink-0`} />
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {plan.planName}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  ({plan.subscribersCount} {locale === "pt" ? "subs" : "subs"})
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(plan.mrrCents)}
                </span>
                <span className="text-zinc-400 text-[11px] w-8 text-right">
                  {percentOfMrr}%
                </span>
              </div>
            </div>

            {/* Horizontal Bar */}
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full ${colorClass} transition-all duration-300`}
                style={{ width: `${percentOfMrr}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
