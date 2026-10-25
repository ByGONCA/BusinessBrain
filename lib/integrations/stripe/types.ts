// Default business configuration
export const DEFAULT_DUNNING_GRACE_PERIOD_DAYS = 14;
export const SNAPSHOT_FRESH_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const SNAPSHOT_STALE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MUTEX_LEASE_DURATION_MS = 2 * 60 * 1000; // 2 minutes lease for lock recovery
export const PAYLOAD_MAX_BYTES_SAFEGUARD = 32 * 1024; // 32 KB safeguard limit
export const MAX_PAGES_PER_QUERY_SAFEGUARD = 50; // Safety guard: up to 5,000 items per query

export type MetricFreshnessStatus = "fresh" | "stale" | "expired" | "syncing" | "error";

export interface PlanRevenueBreakdown {
  planName: string;
  mrrCents: number;
  subscribersCount: number;
  percentageOfMrr: number;
}

export interface PerformanceAnalysisSnapshot {
  momRevenueGrowthPercentage: number | null; // Month-over-month growth from monthlyHistory
  projectedNextMonthMrrCents: number; // Linear run-rate estimate
  isProjectionAnEstimate: true; // Explicit safeguard: must be identified as estimate
}

export interface CurrencyFinancialTotals {
  currency: string;
  activeMrrCents: number; // Net effective MRR after discounts (ACTIVE only)
  grossContractualMrrCents: number; // Gross contractual MRR de tabela (antes de descontos)
  discountSavingsMrrCents: number; // Total deduzido por descontos activos
  atRiskDunningMrrCents: number; // Subscriptions in past_due within grace period (SEPARATE)
  arrCents: number; // activeMrrCents * 12
  arpuCents?: number | null; // Average Revenue Per User (activeMrrCents / activeSubscribersCount)
  churnRatePercentage?: number | null; // Cancellations / (Active + Canceled) * 100
  retentionRatePercentage?: number | null; // Active / (Active + Canceled) * 100
  trialConversionRatePercentage?: number | null; // Active / (Active + Trialing) * 100
  mrrChurnCents?: number | null; // Estimated lost MRR from churned subs
  grrPercentage?: number | null; // Gross Revenue Retention
  nrrPercentage?: number | null; // Net Revenue Retention
  ltvCents?: number | null; // Estimated Customer Lifetime Value
  grossRevenueCents: number; // Total volume charged in period
  netRevenueCents: number; // Gross - refunds - lost disputes - fees
  totalRefundsCents: number; // Deducted refunds
  openDisputesCents: number; // Funds currently held in open disputes
  stripeFeesCents: number; // Processing fees
  activeSubscribersCount: number;
  trialingSubscribersCount: number; // Subscriptions in trial period (trialing)
  canceledSubscribersCount: number; // Subscriptions canceled or terminated
  atRiskSubscribersCount: number;
  discountedSubscribersCount: number;
  revenueByPlan?: Record<string, PlanRevenueBreakdown>;
  performanceAnalysis?: PerformanceAnalysisSnapshot;
}

export interface MonthlyMetricPoint {
  monthKey: string; // YYYY-MM
  grossRevenueCents: number;
  netRevenueCents: number;
  newCustomersCount: number;
}

export type TimeRange = "30D" | "90D" | "12M" | "YTD" | "ALL";
export type ChartGranularity = "daily" | "weekly" | "monthly";

export interface FilteredPeriodChartPoint {
  date: string;
  shortDate: string;
  fullDate: string;
  revenue: number;
  grossRevenue: number;
  netRevenue: number;
  isCurrentPeriod: boolean;
}

export interface FilteredPeriodMetrics {
  timeRange: TimeRange;
  currency: string;
  granularity?: ChartGranularity;
  periodNetRevenueCents: number;
  periodGrossRevenueCents: number;
  periodRefundsCents: number;
  previousPeriodNetRevenueCents: number | null;
  periodComparisonPercentage: number | null;
  hasBaselineComparison: boolean;
  chartPoints: FilteredPeriodChartPoint[];
}

export interface StripeFinancialSnapshot {
  organizationId: string;
  connectedAccountId: string;
  accountEmail?: string;
  livemode: boolean;
  computedAt: string;
  expiresAt: string;
  freshnessStatus: MetricFreshnessStatus;
  primaryCurrency: string;
  currencies: Record<string, CurrencyFinancialTotals>;
  monthlyHistory: Record<string, MonthlyMetricPoint[]>; // currency -> 12-month points
  totalActiveCustomersCount: number; // Deduplicated customer IDs across all active subs/charges
  totalAtRiskCustomersCount: number;
  dunningGracePeriodDays: number;
  timezone: string;
  provenance: {
    source: "stripe_connect_api";
    apiVersion: string;
    sampledChargesCount: number;
    sampledSubscriptionsCount: number;
    sampledBalanceTransactionsCount: number;
    lastSyncedAt: string;
    payloadSizeBytes: number;
    safeguardPruned: boolean;
    pagesTraversedSubscriptions: number;
    pagesTraversedBalanceTransactions: number;
    hasMoreUnfetched: boolean;
  };
  errorDetails?: string;
}

export interface SubscriptionNormalizationResult {
  monthlyAmountCents: number; // Net effective monthly amount (for backward compat)
  grossMonthlyCents: number; // List price MRR before discounts
  netEffectiveMonthlyCents: number; // Effective MRR after active discounts
  discountMonthlyCents: number; // Amount saved per month due to discount
  discountType: "percentage" | "fixed_amount" | "none";
  discountDescription: string;
  isRecurringDiscount: boolean;
  currency: string;
  isPaused: boolean;
  isAtRiskDunning: boolean;
  isExcluded: boolean;
  dunningDaysElapsed: number;
}

/**
 * Masks a Stripe Connected Account ID safely for executive UI display (e.g. acct_•••7890).
 */
export function maskAccountId(accountId?: string | null): string {
  if (!accountId || accountId.length < 8) return accountId || "N/D";
  return `${accountId.slice(0, 5)}•••${accountId.slice(-4)}`;
}

/**
 * Filters and aggregates financial snapshot metrics by period (30D, 90D, 12M, YTD, ALL)
 * and dynamic granularity (daily, weekly, monthly).
 * Computes deterministic comparisons against the previous adjacent matching window
 * without dividing by zero or producing misleading fake 100% deltas.
 */
export function filterFinancialMetricsByPeriod(
  snapshot: StripeFinancialSnapshot | null | undefined,
  currency: string,
  timeRange: TimeRange,
  localeCode: string = "pt-PT",
  granularity: ChartGranularity = "monthly"
): FilteredPeriodMetrics {
  const primaryTotals = snapshot?.currencies?.[currency] || null;
  const historyPoints = (snapshot?.monthlyHistory?.[currency] || []).slice().sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  const now = new Date();
  const anchorYear = now.getFullYear();
  const anchorMonth = now.getMonth();

  let monthsCount = 12;
  let chartPointsCount = 12;

  if (timeRange === "30D") {
    monthsCount = 1;
    chartPointsCount = 6;
  } else if (timeRange === "90D") {
    monthsCount = 3;
    chartPointsCount = 6;
  } else if (timeRange === "YTD") {
    monthsCount = Math.max(1, anchorMonth + 1);
    chartPointsCount = Math.max(6, anchorMonth + 1);
  } else if (timeRange === "ALL") {
    monthsCount = Math.max(12, Math.max(12, historyPoints.length));
    chartPointsCount = monthsCount;
  } else {
    monthsCount = 12;
    chartPointsCount = 12;
  }

  const shortFmt = new Intl.DateTimeFormat(localeCode, { month: "short" });
  const fullFmt = new Intl.DateTimeFormat(localeCode, { month: "long", year: "numeric" });
  const dayFmt = new Intl.DateTimeFormat(localeCode, { day: "numeric", month: "short" });

  const historyMap = new Map<string, MonthlyMetricPoint>();
  for (const pt of historyPoints) {
    historyMap.set(pt.monthKey, pt);
  }

  const generatedPoints: FilteredPeriodChartPoint[] = [];

  if (granularity === "daily" && timeRange === "30D") {
    // Generate 30 daily progression points for the current 30-day window
    const currentMonthKey = `${anchorYear}-${String(anchorMonth + 1).padStart(2, "0")}`;
    const monthData = historyMap.get(currentMonthKey);
    const monthNetCents = monthData ? monthData.netRevenueCents : primaryTotals?.netRevenueCents || 0;
    const monthGrossCents = monthData ? monthData.grossRevenueCents : primaryTotals?.grossRevenueCents || 0;

    const daysCount = 30;
    const dailyNetAvgCents = Math.round(monthNetCents / daysCount);
    const dailyGrossAvgCents = Math.round(monthGrossCents / daysCount);

    for (let dayOffset = daysCount - 1; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const shortDate = dayFmt.format(dayDate);
      const fullDate = dayDate.toLocaleDateString(localeCode, { dateStyle: "medium" });

      generatedPoints.push({
        date: dayDate.toISOString().slice(0, 10),
        shortDate,
        fullDate,
        revenue: dailyNetAvgCents / 100,
        grossRevenue: dailyGrossAvgCents / 100,
        netRevenue: dailyNetAvgCents / 100,
        isCurrentPeriod: true,
      });
    }
  } else {
    // Monthly points
    for (let i = chartPointsCount - 1; i >= 0; i--) {
      const d = new Date(anchorYear, anchorMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const monthKey = `${y}-${String(mIdx + 1).padStart(2, "0")}`;

      const existing = historyMap.get(monthKey);
      const netRev = existing ? existing.netRevenueCents : 0;
      const grossRev = existing ? existing.grossRevenueCents : 0;

      const rawShort = shortFmt.format(d);
      const shortMonth = rawShort.charAt(0).toUpperCase() + rawShort.slice(1);
      const rawFull = fullFmt.format(d);
      const fullDate = rawFull.charAt(0).toUpperCase() + rawFull.slice(1);

      generatedPoints.push({
        date: monthKey,
        shortDate: `${shortMonth} ${String(y).slice(2)}`,
        fullDate,
        revenue: netRev / 100,
        grossRevenue: grossRev / 100,
        netRevenue: netRev / 100,
        isCurrentPeriod: i < monthsCount,
      });
    }
  }

  // If snapshot has net revenue in totals but history sum is 0, anchor to last point
  if (primaryTotals && generatedPoints.length > 0) {
    const totalNetCents = primaryTotals.netRevenueCents || 0;
    const totalGrossCents = primaryTotals.grossRevenueCents || 0;
    const sumPointsCents = generatedPoints.reduce((acc, p) => acc + Math.round(p.revenue * 100), 0);
    if (sumPointsCents === 0 && totalNetCents > 0) {
      generatedPoints[generatedPoints.length - 1].revenue = totalNetCents / 100;
      generatedPoints[generatedPoints.length - 1].netRevenue = totalNetCents / 100;
      generatedPoints[generatedPoints.length - 1].grossRevenue = totalGrossCents / 100;
    }
  }

  // Calculate current period net & gross revenue
  const currentPeriodPoints = generatedPoints.slice(-monthsCount);
  const periodNetRevenueCents = currentPeriodPoints.reduce(
    (acc, p) => acc + Math.round(p.netRevenue * 100),
    0
  );
  const periodGrossRevenueCents = currentPeriodPoints.reduce(
    (acc, p) => acc + Math.round(p.grossRevenue * 100),
    0
  );

  // If timeRange is 12M or ALL and periodNetRevenueCents is 0, use primaryTotals if available
  const finalPeriodNetRevenueCents =
    periodNetRevenueCents === 0 && primaryTotals?.netRevenueCents
      ? primaryTotals.netRevenueCents
      : periodNetRevenueCents;

  const finalPeriodGrossRevenueCents =
    periodGrossRevenueCents === 0 && primaryTotals?.grossRevenueCents
      ? primaryTotals.grossRevenueCents
      : periodGrossRevenueCents;

  // Previous period: slice points prior to current period
  const prevStartIndex = Math.max(0, generatedPoints.length - monthsCount * 2);
  const prevEndIndex = generatedPoints.length - monthsCount;
  const prevPeriodPoints =
    prevEndIndex > prevStartIndex ? generatedPoints.slice(prevStartIndex, prevEndIndex) : [];

  let previousPeriodNetRevenueCents: number | null = null;
  if (prevPeriodPoints.length > 0) {
    previousPeriodNetRevenueCents = prevPeriodPoints.reduce(
      (acc, p) => acc + Math.round(p.netRevenue * 100),
      0
    );
  }

  let periodComparisonPercentage: number | null = null;
  let hasBaselineComparison = false;

  if (previousPeriodNetRevenueCents !== null && previousPeriodNetRevenueCents > 0) {
    periodComparisonPercentage = Number(
      (
        ((finalPeriodNetRevenueCents - previousPeriodNetRevenueCents) /
          previousPeriodNetRevenueCents) *
        100
      ).toFixed(1)
    );
    hasBaselineComparison = true;
  }

  return {
    timeRange,
    currency,
    granularity,
    periodNetRevenueCents: finalPeriodNetRevenueCents,
    periodGrossRevenueCents: finalPeriodGrossRevenueCents,
    periodRefundsCents: primaryTotals?.totalRefundsCents || 0,
    previousPeriodNetRevenueCents,
    periodComparisonPercentage,
    hasBaselineComparison,
    chartPoints: generatedPoints,
  };
}
