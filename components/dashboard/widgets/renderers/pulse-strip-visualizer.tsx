"use client";

import * as React from "react";
import NextLink from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import {
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
  CurrencyFinancialTotals,
} from "@/lib/integrations/stripe/analytics";
import { useLanguage, en } from "@/lib/i18n";

export interface PulseStripVisualizerProps {
  widget: WidgetInstanceConfig;
  financialSnapshot?: StripeFinancialSnapshot | null;
  isStripeConnected?: boolean;
  stripeStatus?: MetricFreshnessStatus;
  currency?: string;
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
  className?: string;
}

export function PulseStripVisualizer({
  widget: _widget,
  financialSnapshot,
  isStripeConnected = false,
  stripeStatus = "fresh",
  currency,
  onDemoNavigate,
  demoMode,
  className,
}: PulseStripVisualizerProps) {
  const { t, locale } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;
  const intlLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  const primaryCurrency = currency || financialSnapshot?.primaryCurrency || "eur";
  const primaryTotals: CurrencyFinancialTotals | null = financialSnapshot?.currencies
    ? financialSnapshot.currencies[primaryCurrency] ||
      Object.values(financialSnapshot.currencies)[0] ||
      null
    : null;

  const netRevenueFormatted = primaryTotals
    ? (primaryTotals.netRevenueCents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: primaryTotals.currency.toUpperCase(),
        minimumFractionDigits: 2,
      })
    : !isStripeConnected
    ? h.stripeNotConnected
    : stripeStatus === "error"
    ? "—"
    : stripeStatus === "syncing"
    ? t?.financePage?.syncing || "Syncing..."
    : (0).toLocaleString(intlLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      });

  const mrrFormatted = primaryTotals
    ? (primaryTotals.activeMrrCents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: primaryTotals.currency.toUpperCase(),
        minimumFractionDigits: 2,
      })
    : !isStripeConnected
    ? "—"
    : stripeStatus === "error"
    ? "—"
    : stripeStatus === "syncing"
    ? t?.financePage?.syncing || "Syncing..."
    : (0).toLocaleString(intlLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      });

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
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-1 select-none",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {h.financialPulseTitle}
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {primaryCurrency.toUpperCase()} • {isStripeConnected ? (locale === "pt" ? "Conectado" : "Connected") : h.stripeNotConnected}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        {/* Net Settled Revenue */}
        <div className="text-right">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            {h.netRevenueLabel}
          </span>
          <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight font-mono">
            {netRevenueFormatted}
          </div>
        </div>

        {/* Monthly Recurring Revenue (MRR) */}
        <div className="text-right hidden sm:block">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            {h.mrrLabel}
          </span>
          <div className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-300 tracking-tight font-mono">
            {mrrFormatted}
          </div>
        </div>

        <LinkWrapper
          href="/dashboard/finance"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs group"
        >
          <span>{h.openFinanceTab}</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </LinkWrapper>
      </div>
    </div>
  );
}
