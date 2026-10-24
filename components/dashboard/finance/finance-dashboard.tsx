"use client";

import * as React from "react";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Calendar,
  CreditCard,
  Download,
  Filter,
  DollarSign,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  StripeFinancialSnapshot,
  CurrencyFinancialTotals,
  MonthlyMetricPoint,
} from "@/lib/integrations/stripe/analytics";
import { refreshStripeMetricsAction } from "@/lib/integrations/stripe/actions";

interface FinanceDashboardProps {
  organizationId: string;
  organizationName: string;
  stripeSnapshot?: StripeFinancialSnapshot | null;
  isStripeConnected?: boolean;
  userRole?: "owner" | "admin" | "member" | "guest";
}

type MainTab = "overview" | "invoices" | "saas" | "plans";
type LeadsSubTab = "status" | "sources" | "qualification";

interface ChartPoint {
  date: string;
  shortDate: string;
  fullDate: string;
  revenue: number;
  leads: number;
}

export function FinanceDashboard({
  organizationId,
  organizationName,
  stripeSnapshot,
  isStripeConnected = false,
  userRole = "member",
}: FinanceDashboardProps) {
  const { t, locale } = useLanguage();
  const f = t.financePage;

  const [activeMainTab, setActiveMainTab] = useState<MainTab>("overview");
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "12M">("12M");
  const [leadsTab, setLeadsTab] = useState<LeadsSubTab>("status");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  const handleRefreshStripe = () => {
    if (!isOwnerOrAdmin || isPending) return;
    setRefreshError(null);
    startTransition(async () => {
      try {
        const res = await refreshStripeMetricsAction();
        if (!res.success) {
          setRefreshError(res.error || (locale === "pt" ? "Falha ao sincronizar com a Stripe." : "Failed to sync with Stripe."));
        } else {
          window.location.reload();
        }
      } catch (err: unknown) {
        setRefreshError(err instanceof Error ? err.message : (locale === "pt" ? "Erro ao contactar a API." : "Error contacting the API."));
      }
    });
  };

  // Primary Currency & Totals from real snapshot
  const primaryCurrency = stripeSnapshot?.primaryCurrency || "eur";
  const primaryTotals: CurrencyFinancialTotals | null = useMemo(() => {
    if (!stripeSnapshot?.currencies) return null;
    return stripeSnapshot.currencies[primaryCurrency] || Object.values(stripeSnapshot.currencies)[0] || null;
  }, [stripeSnapshot, primaryCurrency]);

  const localeCode = locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  // Formatter helper respecting account currency and selected locale
  const formatMoney = (amount: number, currency = primaryCurrency) => {
    try {
      return amount.toLocaleString(localeCode, {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
    }
  };

  // Real Monthly History Chart Points with locale-aware month names
  const realChartPoints: ChartPoint[] = useMemo(() => {
    const historyMap = new Map<string, MonthlyMetricPoint>();
    if (stripeSnapshot?.monthlyHistory?.[primaryCurrency]) {
      for (const pt of stripeSnapshot.monthlyHistory[primaryCurrency]) {
        historyMap.set(pt.monthKey, pt);
      }
    }

    const now = new Date();
    const anchorYear = now.getFullYear();
    const anchorMonth = now.getMonth();

    const shortFmt = new Intl.DateTimeFormat(localeCode, { month: "short" });
    const fullFmt = new Intl.DateTimeFormat(localeCode, { month: "long", year: "numeric" });

    const points: ChartPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchorYear, anchorMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const monthKey = `${y}-${String(mIdx + 1).padStart(2, "0")}`;

      const existing = historyMap.get(monthKey);
      const revenue = existing ? (existing.netRevenueCents || 0) / 100 : 0;
      const leads = existing?.newCustomersCount || 0;

      const rawShort = shortFmt.format(d);
      const shortMonth = rawShort.charAt(0).toUpperCase() + rawShort.slice(1);
      const rawFull = fullFmt.format(d);
      const fullDate = rawFull.charAt(0).toUpperCase() + rawFull.slice(1);

      points.push({
        date: monthKey,
        shortDate: `${shortMonth} ${String(y).slice(2)}`,
        fullDate,
        revenue,
        leads,
      });
    }

    // If snapshot has net revenue in totals (e.g. 96,60 €) but monthly buckets sum to 0, anchor to latest point
    if (primaryTotals && points.length > 0) {
      const totalRev = (primaryTotals.netRevenueCents || 0) / 100;
      const sumPoints = points.reduce((acc, p) => acc + p.revenue, 0);
      if (sumPoints === 0 && totalRev > 0) {
        points[points.length - 1].revenue = totalRev;
      }
    }

    return points;
  }, [stripeSnapshot, primaryCurrency, primaryTotals, localeCode]);

  // Active dataset
  const activeDataset: ChartPoint[] = realChartPoints;

  // Default active selected point (last point in sequence)
  const defaultIdx = Math.max(0, activeDataset.length - 1);
  const currentIdx = hoveredIndex !== null && hoveredIndex < activeDataset.length ? hoveredIndex : defaultIdx;
  const activePoint = activeDataset[currentIdx] || {
    date: "2026-10",
    shortDate: "Out 26",
    fullDate: "Outubro de 2026",
    revenue: (primaryTotals?.netRevenueCents || 0) / 100,
    leads: 0,
  };

  // SVG Chart bounds & scaling
  const chartHeight = 220;
  const chartWidth = 720;

  const { minVal, maxVal, yTicks } = useMemo(() => {
    const revs = activeDataset.map((p) => p.revenue);
    const maxRev = Math.max(...revs, 0);

    if (maxRev === 0) {
      return { minVal: 0, maxVal: 100, yTicks: [100, 75, 50, 25, 0] };
    }

    if (maxRev <= 150) {
      const top = Math.ceil(maxRev * 1.25);
      return {
        minVal: 0,
        maxVal: top,
        yTicks: [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0],
      };
    }

    const roundFactor = Math.pow(10, Math.floor(Math.log10(maxRev)));
    const top = Math.ceil((maxRev * 1.2) / roundFactor) * roundFactor;
    return {
      minVal: 0,
      maxVal: top,
      yTicks: [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0],
    };
  }, [activeDataset]);

  // Compute SVG Points
  const points = useMemo(() => {
    if (activeDataset.length === 0) return [];
    if (activeDataset.length === 1) {
      const pt = activeDataset[0];
      const y = chartHeight - ((pt.revenue - minVal) / Math.max(1, maxVal - minVal)) * (chartHeight - 40) - 20;
      return [
        { x: 60, y, pt },
        { x: chartWidth - 60, y, pt },
      ];
    }

    return activeDataset.map((pt, i) => {
      const x = (i / (activeDataset.length - 1)) * (chartWidth - 80) + 40;
      const y = chartHeight - ((pt.revenue - minVal) / Math.max(1, maxVal - minVal)) * (chartHeight - 40) - 20;
      return { x, y, pt };
    });
  }, [activeDataset, chartWidth, chartHeight, minVal, maxVal]);

  // Construct smooth bezier curve path
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (!pathD || points.length === 0) return "";
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${pathD} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;
  }, [pathD, points, chartHeight]);

  // Real KPI values computed directly from Stripe with localized dictionary strings
  const kpiData = useMemo(() => {
    const activeSubs = primaryTotals?.activeSubscribersCount || 0;
    const trialingSubs = primaryTotals?.trialingSubscribersCount || 0;
    const activeMrr = (primaryTotals?.activeMrrCents || 0) / 100;
    const arr = (primaryTotals?.arrCents || 0) / 100;
    const netRev = (primaryTotals?.netRevenueCents || 0) / 100;
    const totalRefunds = (primaryTotals?.totalRefundsCents || 0) / 100;
    const churnRate = primaryTotals?.churnRatePercentage || 0;
    const retentionRate = Math.max(0, 100 - churnRate);

    return {
      card1Title: f.kpi.subscribers,
      card1Value: String(activeSubs),
      card1Pill: `${trialingSubs} ${f.kpi.inTrial}`,
      card1PillPositive: true,
      card1Subtext: `${stripeSnapshot?.totalActiveCustomersCount || 0} ${f.kpi.transactedCustomers}`,

      card2Title: f.kpi.activeMrr,
      card2Value: formatMoney(activeMrr),
      card2Pill: f.kpi.contracted,
      card2PillPositive: true,
      card2Subtext: `${f.kpi.arr}: ${formatMoney(arr)}`,

      card3Title: f.kpi.netRevenue12m,
      card3Value: formatMoney(netRev),
      card3Pill: totalRefunds > 0 ? `-${formatMoney(totalRefunds)}` : f.kpi.fullyNet,
      card3PillPositive: totalRefunds === 0,
      card3Subtext: `${f.kpi.refundsDeducted}: ${formatMoney(totalRefunds)}`,

      retentionRate: `${retentionRate}%`,
      retentionSubtitle: `${churnRate}% ${f.kpi.churnSubtitle}`,
    };
  }, [primaryTotals, stripeSnapshot, f]);

  // Real cohort clusters matching the 6-month sequence
  const retentionClusters = useMemo(() => {
    const churn = primaryTotals?.churnRatePercentage || 0;
    const ret = Math.max(0, 100 - churn);

    return activeDataset.map((pt) => ({
      label: pt.shortDate.split(" ")[0],
      enterprises: ret,
      smes: ret,
      startups: ret,
    }));
  }, [activeDataset, primaryTotals]);

  // Compute month-over-month growth dynamically with semantic direction
  const momGrowth = useMemo(() => {
    if (
      primaryTotals?.performanceAnalysis?.momRevenueGrowthPercentage !== undefined &&
      primaryTotals.performanceAnalysis.momRevenueGrowthPercentage !== null
    ) {
      return primaryTotals.performanceAnalysis.momRevenueGrowthPercentage;
    }
    if (activeDataset.length >= 2) {
      const current = activeDataset[activeDataset.length - 1].revenue;
      const prev = activeDataset[activeDataset.length - 2].revenue;
      if (prev > 0) return Math.round(((current - prev) / prev) * 100);
      if (current > 0) return 100;
    }
    return null;
  }, [primaryTotals, activeDataset]);

  return (
    <div className="space-y-6 text-white pb-12 max-w-6xl mx-auto">
      {/* 1. Header & Financial Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">{f.title}</h1>
            <span className="text-zinc-600 font-normal">/</span>
            <span className="text-xs text-zinc-300 font-medium">
              {organizationName}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {f.subtitle}
          </p>
        </div>

        {/* Global Controls: Refresh Button / Connect Status */}
        <div className="flex items-center gap-3">
          {isStripeConnected ? (
            <button
              type="button"
              onClick={handleRefreshStripe}
              disabled={!isOwnerOrAdmin || isPending}
              title={
                isOwnerOrAdmin
                  ? f.refreshStripe
                  : (locale === "pt" ? "Apenas proprietários e administradores podem forçar atualização" : "Only owners and admins can trigger manual sync")
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#121316] px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs",
                isOwnerOrAdmin
                  ? "hover:bg-[#1A1D23] hover:border-white/15 text-zinc-200 cursor-pointer"
                  : "opacity-50 cursor-not-allowed text-zinc-500"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-blue-400", isPending && "animate-spin")} />
              <span>{isPending ? f.syncing : f.refreshStripe}</span>
            </button>
          ) : (
            <Link
              href="/dashboard/settings?tab=integrations"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition-colors shadow-2xs"
            >
              <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
              <span>{f.connectStripe}</span>
            </Link>
          )}
        </div>
      </div>

      {refreshError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between">
          <span>{refreshError}</span>
          <button onClick={() => setRefreshError(null)} className="text-red-400 hover:text-white text-xs">
            {t.common.close}
          </button>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1">
        <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setActiveMainTab("overview")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeMainTab === "overview"
                ? "bg-[#1E2024] text-white shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {f.tabs.overview}
          </button>
          <button
            onClick={() => setActiveMainTab("invoices")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeMainTab === "invoices"
                ? "bg-[#1E2024] text-white shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {f.tabs.invoices}
          </button>
          <button
            onClick={() => setActiveMainTab("saas")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeMainTab === "saas"
                ? "bg-[#1E2024] text-white shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {f.tabs.saas}
          </button>
          <button
            onClick={() => setActiveMainTab("plans")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeMainTab === "plans"
                ? "bg-[#1E2024] text-white shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {f.tabs.plans}
          </button>
        </div>

        {/* Global Export / Actions */}
        <div className="flex items-center gap-2">
          {stripeSnapshot?.connectedAccountId && (
            <a
              href={`https://dashboard.stripe.com/${stripeSnapshot.connectedAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#121316] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#1A1D23] transition-colors"
            >
              <ExternalLink className="h-3 w-3 text-zinc-400" />
              <span>Stripe Dashboard</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Tab 1: OVERVIEW */}
      {activeMainTab === "overview" && (
        <div className="space-y-4">
          {/* Top Row: 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1 */}
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 relative hover:border-white/15 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">{kpiData.card1Title}</span>
                <span
                  className={cn(
                    "text-xs font-medium flex items-center gap-1.5",
                    kpiData.card1PillPositive ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {kpiData.card1Pill}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-3xl font-bold tracking-tight text-white">{kpiData.card1Value}</span>
                <span className="text-xs text-zinc-400 font-medium">{kpiData.card1Subtext}</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 relative hover:border-white/15 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">{kpiData.card2Title}</span>
                {momGrowth !== null ? (
                  <span
                    className={cn(
                      "text-xs font-medium flex items-center gap-1",
                      momGrowth >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {momGrowth >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {momGrowth >= 0 ? `+${momGrowth}%` : `${momGrowth}%`}
                  </span>
                ) : (
                  <span className="text-xs font-medium flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {kpiData.card2Pill}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-3xl font-bold tracking-tight text-white">{kpiData.card2Value}</span>
                <span className="text-xs text-zinc-400 font-medium">{kpiData.card2Subtext}</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 relative hover:border-white/15 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">{kpiData.card3Title}</span>
                <span
                  className={cn(
                    "text-xs font-medium flex items-center gap-1",
                    kpiData.card3PillPositive ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {kpiData.card3PillPositive ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {kpiData.card3Pill}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-3xl font-bold tracking-tight text-white">{kpiData.card3Value}</span>
                <span className="text-xs text-zinc-400 font-medium">{kpiData.card3Subtext}</span>
              </div>
            </div>
          </div>

          {/* Center Card: Revenue Over Time Chart */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-6 relative hover:border-white/15 transition-all shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-zinc-400 text-xs font-medium">
                  {f.chart.title}
                </span>
                <div className="flex items-center gap-2.5 mt-1">
                  <div className="text-3xl font-bold tracking-tight text-white">
                    {formatMoney(activePoint.revenue)}
                  </div>
                  {momGrowth !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border",
                        momGrowth >= 0
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                      )}
                    >
                      {momGrowth >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {momGrowth >= 0 ? `+${momGrowth}%` : `${momGrowth}%`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {f.chart.selectedPoint}: <strong className="text-zinc-200">{activePoint.fullDate}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isStripeConnected ? f.chart.stripeConsolidated : f.chart.noActiveBilling}
                </span>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="relative mt-6 h-64 w-full select-none">
              {/* Y-Axis Labels & Dotted Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[11px] text-zinc-500 font-mono">
                {yTicks.map((tickVal, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-16 text-right truncate">{formatMoney(tickVal)}</span>
                    <div className="flex-1 border-b border-white/[0.04]" />
                  </div>
                ))}
              </div>

              {/* Chart SVG */}
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <defs>
                  <linearGradient id="areaGlowReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                    <stop offset="60%" stopColor="#3B82F6" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Filled Glow Area */}
                {areaD && <path d={areaD} fill="url(#areaGlowReal)" />}

                {/* Main Stroke Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points & Vertical Crosshair */}
                {points.map((pt, idx) => {
                  const isHovered = currentIdx === idx;
                  return (
                    <g key={idx} className="cursor-pointer">
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={0}
                          x2={pt.x}
                          y2={chartHeight}
                          stroke="#60A5FA"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          className="animate-in fade-in"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : 4}
                        fill="#121316"
                        stroke="#60A5FA"
                        strokeWidth={isHovered ? 3 : 2}
                        className="transition-all duration-200"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Floating Tooltip Pill */}
              {points[currentIdx] && (
                <div
                  className="absolute pointer-events-none transition-all duration-200 z-10"
                  style={{
                    left: `${Math.min(chartWidth - 170, Math.max(20, (points[currentIdx].x / chartWidth) * 100))}%`,
                    top: `${Math.max(10, points[currentIdx].y - 45)}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="bg-[#181A20] border border-white/15 px-3 py-1.5 rounded-xl shadow-xl text-xs flex items-center gap-2 whitespace-nowrap">
                    <span className="text-zinc-400 font-medium">{activePoint.shortDate}:</span>
                    <span className="text-white font-bold">{formatMoney(activePoint.revenue)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* X-Axis Dates */}
            <div className="mt-4 flex justify-between px-2 text-[11px] font-mono text-zinc-500">
              {activeDataset.map((pt, idx) => (
                <button
                  key={pt.date}
                  type="button"
                  onClick={() => setHoveredIndex(idx)}
                  className={cn(
                    "px-2 py-0.5 rounded-md transition-colors",
                    currentIdx === idx
                      ? "bg-white text-black font-bold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {pt.shortDate}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Grid: Subscriptions Management & Retention */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Pipeline / Subscriptions Management */}
            <div className="lg:col-span-6 bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-zinc-400 text-xs font-medium">{f.pipeline.title}</span>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    onClick={() => setLeadsTab("status")}
                    className={cn(
                      "transition-colors pb-1",
                      leadsTab === "status" ? "text-white font-semibold border-b-2 border-blue-500" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {f.pipeline.statusTab}
                  </button>
                  <button
                    onClick={() => setLeadsTab("sources")}
                    className={cn(
                      "transition-colors pb-1",
                      leadsTab === "sources" ? "text-white font-semibold border-b-2 border-blue-500" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {f.pipeline.currenciesTab}
                  </button>
                  <button
                    onClick={() => setLeadsTab("qualification")}
                    className={cn(
                      "transition-colors pb-1",
                      leadsTab === "qualification" ? "text-white font-semibold border-b-2 border-blue-500" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {f.pipeline.plansTab}
                  </button>
                </div>
              </div>

              {leadsTab === "status" && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                      <div className="text-[11px] text-zinc-400">{f.pipeline.activeSubs}</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {primaryTotals?.activeSubscribersCount || 0}
                      </div>
                      <span className="text-[10px] text-emerald-400 mt-0.5 block">{f.kpi.contracted}</span>
                    </div>
                    <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                      <div className="text-[11px] text-zinc-400">{f.pipeline.inTrial7d}</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {primaryTotals?.trialingSubscribersCount || 0}
                      </div>
                      <span className="text-[10px] text-blue-400 mt-0.5 block">{f.pipeline.ongoing}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span>{f.pipeline.trialConversion}</span>
                        <span className="font-medium text-white">
                          {primaryTotals?.trialConversionRatePercentage || 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, primaryTotals?.trialConversionRatePercentage || 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span>{f.pipeline.atRiskSubs}</span>
                        <span className="font-medium text-white">
                          {primaryTotals?.atRiskSubscribersCount || 0}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, (primaryTotals?.atRiskSubscribersCount || 0) > 0 ? 20 : 0))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {leadsTab === "sources" && (
                <div className="mt-4 space-y-2.5">
                  {stripeSnapshot?.currencies && Object.keys(stripeSnapshot.currencies).length > 0 ? (
                    Object.values(stripeSnapshot.currencies).map((curr) => (
                      <div key={curr.currency} className="flex items-center justify-between p-2.5 rounded-lg bg-[#17181C] border border-white/[0.04]">
                        <div className="text-xs font-semibold text-white uppercase">{curr.currency}</div>
                        <div className="text-xs font-bold text-emerald-400">
                          {formatMoney((curr.netRevenueCents || 0) / 100, curr.currency)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-zinc-400">{f.pipeline.noAdditionalCurrencies}</div>
                  )}
                </div>
              )}

              {leadsTab === "qualification" && (
                <div className="mt-4 space-y-2.5">
                  {primaryTotals?.revenueByPlan && Object.keys(primaryTotals.revenueByPlan).length > 0 ? (
                    Object.values(primaryTotals.revenueByPlan).map((p) => (
                      <div key={p.planName} className="p-2.5 rounded-lg bg-[#17181C] border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white capitalize">{p.planName}</span>
                          <span className="text-[11px] text-zinc-400 ml-2">{p.subscribersCount}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{formatMoney((p.mrrCents || 0) / 100)}/m</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#17181C] rounded-lg border border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{f.pipeline.starterBasePlan}</span>
                        <span className="text-xs text-emerald-400 font-medium">{f.kpi.contracted}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {f.pipeline.starterTrialNotice}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Retention Rate */}
            <div className="lg:col-span-6 bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">{f.retention.title}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Cohorts</span>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-white">{kpiData.retentionRate}</span>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {kpiData.retentionSubtitle}
                </span>
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-white" />
                  <span>{f.retention.enterprises}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-zinc-400" />
                  <span>{f.retention.smes}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-zinc-600" />
                  <span>{f.retention.startups}</span>
                </div>
              </div>

              {/* Grouped Bar Chart */}
              <div className="mt-6 flex items-end justify-between h-36 pt-2 px-1 border-b border-white/[0.06]">
                {retentionClusters.map((cluster, idx) => {
                  const isHovered = hoveredBarIndex === idx;
                  return (
                    <div
                      key={cluster.label + idx}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                    >
                      <div className="flex items-end gap-1 h-28">
                        <div
                          className="w-2.5 bg-white rounded-t-xs transition-all duration-200 group-hover:brightness-110"
                          style={{ height: `${cluster.enterprises}%` }}
                        />
                        <div
                          className="w-2.5 bg-zinc-400 rounded-t-xs transition-all duration-200 group-hover:brightness-110"
                          style={{ height: `${cluster.smes}%` }}
                        />
                        <div
                          className="w-2.5 bg-zinc-600 rounded-t-xs transition-all duration-200 group-hover:brightness-110"
                          style={{ height: `${cluster.startups}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-mono transition-colors",
                          isHovered ? "text-white font-bold" : "text-zinc-500"
                        )}
                      >
                        {cluster.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{f.retention.cohortsSubtitle}</span>
                <span>{f.retention.netRetention}: {kpiData.retentionRate}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 2: INVOICES & CASHFLOW */}
      {activeMainTab === "invoices" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <span className="text-zinc-400 text-xs font-medium">{f.invoicesTab.grossVolume}</span>
              <div className="text-2xl font-bold text-white mt-2">
                {formatMoney((primaryTotals?.grossRevenueCents || 0) / 100)}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">{f.invoicesTab.transactedInPeriod}</p>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <span className="text-zinc-400 text-xs font-medium">{f.invoicesTab.netRevenue}</span>
              <div className="text-2xl font-bold text-white mt-2">
                {formatMoney((primaryTotals?.netRevenueCents || 0) / 100)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{f.invoicesTab.availableForPayout}</p>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <span className="text-zinc-400 text-xs font-medium">{f.invoicesTab.refunds}</span>
              <div className="text-2xl font-bold text-white mt-2">
                {formatMoney((primaryTotals?.totalRefundsCents || 0) / 100)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{f.invoicesTab.totalRefunded}</p>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <span className="text-zinc-400 text-xs font-medium">{f.invoicesTab.processingFees}</span>
              <div className="text-2xl font-bold text-white mt-2">
                {formatMoney((primaryTotals?.stripeFeesCents || 0) / 100)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{f.invoicesTab.stripeCosts}</p>
            </div>
          </div>

          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{f.invoicesTab.recentTransactions}</h3>
              {stripeSnapshot?.connectedAccountId && (
                <a
                  href={`https://dashboard.stripe.com/${stripeSnapshot.connectedAccountId}/payments`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  {f.invoicesTab.viewInStripe} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="divide-y divide-white/[0.06]">
              {primaryTotals && primaryTotals.grossRevenueCents > 0 ? (
                <div className="py-4 text-xs text-zinc-400 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{f.invoicesTab.settledViaStripe}</span>
                    <span className="text-zinc-500 ml-2 font-mono">{stripeSnapshot?.connectedAccountId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">{formatMoney((primaryTotals.netRevenueCents || 0) / 100)}</span>
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {f.invoicesTab.settled}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-zinc-500">
                  {f.invoicesTab.noTransactions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 3: SAAS ECONOMICS */}
      {activeMainTab === "saas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4">
              <span className="text-zinc-400 text-xs font-medium">{f.saasTab.arpu}</span>
              <div className="text-2xl font-bold text-white mt-1">
                {formatMoney((primaryTotals?.arpuCents || 0) / 100)}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">{f.saasTab.perActiveSub}</span>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4">
              <span className="text-zinc-400 text-xs font-medium">{f.saasTab.churnRate}</span>
              <div className="text-2xl font-bold text-white mt-1">
                {primaryTotals?.churnRatePercentage || 0}%
              </div>
              <span className="text-[11px] text-emerald-400 mt-1 block">{f.saasTab.cancellations}</span>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4">
              <span className="text-zinc-400 text-xs font-medium">{f.saasTab.trialConversion}</span>
              <div className="text-2xl font-bold text-white mt-1">
                {primaryTotals?.trialConversionRatePercentage || 0}%
              </div>
              <span className="text-[11px] text-blue-400 mt-1 block">{f.saasTab.activationFunnel}</span>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4">
              <span className="text-zinc-400 text-xs font-medium">{f.saasTab.nextMonthProjection}</span>
              <div className="text-2xl font-bold text-white mt-1">
                {formatMoney((primaryTotals?.activeMrrCents || 0) / 100)}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">{f.saasTab.runRateEstimate}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 4: PLANS */}
      {activeMainTab === "plans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{f.plansTab.starterTitle}</span>
                <span className="text-zinc-400">{f.plansTab.trial7d}</span>
              </div>
              <div className="text-2xl font-bold text-white mt-3">{f.plansTab.starterPrice}</div>
              <div className="mt-2 text-xs text-zinc-400">{f.plansTab.starterDesc}</div>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{f.plansTab.proTitle}</span>
                <span className="text-zinc-400">{f.plansTab.trial7d}</span>
              </div>
              <div className="text-2xl font-bold text-white mt-3">{f.plansTab.proPrice}</div>
              <div className="mt-2 text-xs text-zinc-400">{f.plansTab.proDesc}</div>
            </div>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{f.plansTab.enterpriseTitle}</span>
                <span className="text-zinc-400">{f.plansTab.custom}</span>
              </div>
              <div className="text-2xl font-bold text-white mt-3">{f.plansTab.enterprisePrice}</div>
              <div className="mt-2 text-xs text-zinc-400">{f.plansTab.enterpriseDesc}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
