import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";
import { getStripeClient } from "@/lib/stripe/client";
import type Stripe from "stripe";

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
  arpuCents?: number; // Average Revenue Per User (activeMrrCents / activeSubscribersCount)
  churnRatePercentage?: number; // Cancellations / (Active + Canceled) * 100
  trialConversionRatePercentage?: number; // Active / (Active + Trialing) * 100
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
 * Calculates start of 12-month window aligned with timezone.
 */
function getTwelveMonthsAgoTimestamp(timezone: string): number {
  try {
    const now = new Date();
    // 12 calendar months back roughly 365 days
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    return Math.floor(twelveMonthsAgo.getTime() / 1000);
  } catch {
    return Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
  }
}

/**
 * Calculates discount deductions on a subscription.
 * Distinguishes percentage vs fixed amount, recurring (forever, repeating) vs once, and expired discounts.
 */
export function calculateSubscriptionDiscount(
  grossMonthlyCents: number,
  sub: Stripe.Subscription
): {
  discountMonthlyCents: number;
  discountType: "percentage" | "fixed_amount" | "none";
  discountDescription: string;
  isRecurringDiscount: boolean;
} {
  if (grossMonthlyCents <= 0) {
    return {
      discountMonthlyCents: 0,
      discountType: "none",
      discountDescription: "Nenhum",
      isRecurringDiscount: false,
    };
  }

  // Retrieve discount object (support both sub.discount and sub.discounts array)
  const discountObj =
    sub.discount ||
    (Array.isArray((sub as unknown as { discounts?: Stripe.Discount[] }).discounts) &&
      (sub as unknown as { discounts: Stripe.Discount[] }).discounts[0]) ||
    null;

  if (!discountObj || !discountObj.coupon) {
    return {
      discountMonthlyCents: 0,
      discountType: "none",
      discountDescription: "Nenhum",
      isRecurringDiscount: false,
    };
  }

  const coupon = discountObj.coupon;
  const nowSec = Math.floor(Date.now() / 1000);

  // Check expiration if discount has an end timestamp
  if (discountObj.end && nowSec > discountObj.end) {
    return {
      discountMonthlyCents: 0,
      discountType: "none",
      discountDescription: "Desconto expirado",
      isRecurringDiscount: false,
    };
  }

  const isRecurring = coupon.duration === "forever" || coupon.duration === "repeating";

  // Case A: Percentage discount (e.g. 20% off)
  if (coupon.percent_off != null && coupon.percent_off > 0) {
    const pct = Math.min(100, Math.max(0, coupon.percent_off));
    const deduction = Math.round((grossMonthlyCents * pct) / 100);
    const finalDiscountCents = Math.min(deduction, grossMonthlyCents);

    return {
      discountMonthlyCents: finalDiscountCents,
      discountType: "percentage",
      discountDescription: `${pct}% de desconto (${coupon.duration})`,
      isRecurringDiscount: isRecurring,
    };
  }

  // Case B: Fixed amount discount (e.g. 10.00 EUR off per billing cycle)
  if (coupon.amount_off != null && coupon.amount_off > 0) {
    // Determine interval from items to normalize amount_off to monthly
    const firstItem = sub.items?.data?.[0];
    const interval = firstItem?.price?.recurring?.interval || "month";
    const intervalCount = firstItem?.price?.recurring?.interval_count || 1;

    let normalizedDiscount = coupon.amount_off;
    if (interval === "year") {
      normalizedDiscount = Math.round(coupon.amount_off / (12 * intervalCount));
    } else if (interval === "week") {
      normalizedDiscount = Math.round((coupon.amount_off * 52) / (12 * intervalCount));
    } else if (interval === "day") {
      normalizedDiscount = Math.round(coupon.amount_off * 30 * intervalCount);
    } else if (interval === "month") {
      normalizedDiscount = Math.round(coupon.amount_off / intervalCount);
    }

    const finalDiscountCents = Math.min(normalizedDiscount, grossMonthlyCents);

    return {
      discountMonthlyCents: finalDiscountCents,
      discountType: "fixed_amount",
      discountDescription: `${(coupon.amount_off / 100).toFixed(2)} ${coupon.currency?.toUpperCase() || ""} (${coupon.duration})`,
      isRecurringDiscount: isRecurring,
    };
  }

  return {
    discountMonthlyCents: 0,
    discountType: "none",
    discountDescription: "Nenhum",
    isRecurringDiscount: false,
  };
}

/**
 * Normalizes a subscription price to monthly cents, accurately computing both
 * Gross Contractual MRR (de tabela) and Net Effective MRR (após descontos vigentes).
 */
export function normalizeSubscriptionToMonthlyCents(
  sub: Stripe.Subscription
): SubscriptionNormalizationResult {
  const currency = sub.currency ? sub.currency.toLowerCase() : "usd";

  // Check if paused
  const isPaused = sub.status === "paused" || Boolean(sub.pause_collection);

  // Check cancellation or terminal status
  if (sub.status === "canceled" || sub.status === "incomplete_expired" || sub.status === "unpaid") {
    return {
      monthlyAmountCents: 0,
      grossMonthlyCents: 0,
      netEffectiveMonthlyCents: 0,
      discountMonthlyCents: 0,
      discountType: "none",
      discountDescription: "Cancelado / Não pago",
      isRecurringDiscount: false,
      currency,
      isPaused: false,
      isAtRiskDunning: false,
      isExcluded: true,
      dunningDaysElapsed: 0,
    };
  }

  // Calculate annual/interval normalization for all items in subscription
  let totalGrossCents = 0;
  if (sub.items && Array.isArray(sub.items.data)) {
    for (const item of sub.items.data) {
      const price = item.price;
      if (!price || !price.unit_amount) continue;

      const unitAmount = price.unit_amount * (item.quantity || 1);
      const interval = price.recurring?.interval || "month";
      const intervalCount = price.recurring?.interval_count || 1;

      let monthlyCents = 0;
      if (interval === "month") {
        monthlyCents = Math.round(unitAmount / intervalCount);
      } else if (interval === "year") {
        monthlyCents = Math.round(unitAmount / (12 * intervalCount));
      } else if (interval === "week") {
        monthlyCents = Math.round((unitAmount * 52) / (12 * intervalCount));
      } else if (interval === "day") {
        monthlyCents = Math.round(unitAmount * 30 * intervalCount);
      } else {
        monthlyCents = unitAmount;
      }

      totalGrossCents += monthlyCents;
    }
  }

  // Calculate discounts
  const discountCalc = calculateSubscriptionDiscount(totalGrossCents, sub);
  const netEffectiveCents = Math.max(0, totalGrossCents - discountCalc.discountMonthlyCents);

  // Paused subscriptions contribute 0 to MRR
  if (isPaused) {
    return {
      monthlyAmountCents: 0,
      grossMonthlyCents: totalGrossCents,
      netEffectiveMonthlyCents: 0,
      discountMonthlyCents: discountCalc.discountMonthlyCents,
      discountType: discountCalc.discountType,
      discountDescription: "Pausada",
      isRecurringDiscount: discountCalc.isRecurringDiscount,
      currency,
      isPaused: true,
      isAtRiskDunning: false,
      isExcluded: false,
      dunningDaysElapsed: 0,
    };
  }

  // Handle past_due (Dunning)
  if (sub.status === "past_due") {
    const referenceTimestamp =
      sub.current_period_start || sub.start_date || Math.floor(Date.now() / 1000);
    const daysElapsed = Math.max(0, Math.floor((Date.now() / 1000 - referenceTimestamp) / 86400));

    if (daysElapsed <= DEFAULT_DUNNING_GRACE_PERIOD_DAYS) {
      return {
        monthlyAmountCents: netEffectiveCents,
        grossMonthlyCents: totalGrossCents,
        netEffectiveMonthlyCents: netEffectiveCents,
        discountMonthlyCents: discountCalc.discountMonthlyCents,
        discountType: discountCalc.discountType,
        discountDescription: discountCalc.discountDescription,
        isRecurringDiscount: discountCalc.isRecurringDiscount,
        currency,
        isPaused: false,
        isAtRiskDunning: true, // Handled separately! Never summed into active MRR
        isExcluded: false,
        dunningDaysElapsed: daysElapsed,
      };
    } else {
      // Exceeded grace period without resolution -> Excluded from MRR
      return {
        monthlyAmountCents: 0,
        grossMonthlyCents: totalGrossCents,
        netEffectiveMonthlyCents: 0,
        discountMonthlyCents: discountCalc.discountMonthlyCents,
        discountType: discountCalc.discountType,
        discountDescription: "Dunning expirado (> 14 dias)",
        isRecurringDiscount: discountCalc.isRecurringDiscount,
        currency,
        isPaused: false,
        isAtRiskDunning: false,
        isExcluded: true,
        dunningDaysElapsed: daysElapsed,
      };
    }
  }

  return {
    monthlyAmountCents: netEffectiveCents,
    grossMonthlyCents: totalGrossCents,
    netEffectiveMonthlyCents: netEffectiveCents,
    discountMonthlyCents: discountCalc.discountMonthlyCents,
    discountType: discountCalc.discountType,
    discountDescription: discountCalc.discountDescription,
    isRecurringDiscount: discountCalc.isRecurringDiscount,
    currency,
    isPaused: false,
    isAtRiskDunning: false,
    isExcluded: false,
    dunningDaysElapsed: 0,
  };
}

/**
 * Computes financial metrics directly from the Stripe API with full cursor-based pagination
 * and deduplication, without storing raw transaction dumps.
 */
export async function computeStripeMetricsFromApi(params: {
  connectedAccountId: string;
  accessToken: string;
  timezone: string;
  organizationId: string;
}): Promise<StripeFinancialSnapshot> {
  const stripe = getStripeClient();
  const twelveMonthsAgo = getTwelveMonthsAgoTimestamp(params.timezone);

  const requestOptions: Stripe.RequestOptions = {
    stripeAccount: params.connectedAccountId,
  };

  const currencyMap: Record<string, CurrencyFinancialTotals> = {};
  const monthlyHistoryMap: Record<string, Record<string, MonthlyMetricPoint>> = {};
  const activeCustomerIds = new Set<string>();
  const atRiskCustomerIds = new Set<string>();

  function getCurrencyBucket(curr: string): CurrencyFinancialTotals {
    const c = curr.toLowerCase();
    if (!currencyMap[c]) {
      currencyMap[c] = {
        currency: c,
        activeMrrCents: 0,
        grossContractualMrrCents: 0,
        discountSavingsMrrCents: 0,
        atRiskDunningMrrCents: 0,
        arrCents: 0,
        arpuCents: 0,
        churnRatePercentage: 0,
        trialConversionRatePercentage: 0,
        grossRevenueCents: 0,
        netRevenueCents: 0,
        totalRefundsCents: 0,
        openDisputesCents: 0,
        stripeFeesCents: 0,
        activeSubscribersCount: 0,
        trialingSubscribersCount: 0,
        canceledSubscribersCount: 0,
        atRiskSubscribersCount: 0,
        discountedSubscribersCount: 0,
        revenueByPlan: {},
      };
      monthlyHistoryMap[c] = {};
    }
    return currencyMap[c];
  }

  let sampledSubsCount = 0;
  let sampledChargesCount = 0;
  let sampledBalanceTransactionsCount = 0;
  let pagesTraversedSubs = 0;
  let pagesTraversedBt = 0;

  // 1. Fetch Subscriptions with Full Cursor-Based Pagination & Deduplication
  const seenSubscriptionIds = new Set<string>();
  let subStartingAfter: string | undefined = undefined;
  let subHasMore = true;

  try {
    while (subHasMore && pagesTraversedSubs < MAX_PAGES_PER_QUERY_SAFEGUARD) {
      pagesTraversedSubs++;
      const listParams: Stripe.SubscriptionListParams = {
        limit: 100,
        status: "all",
        ...(subStartingAfter ? { starting_after: subStartingAfter } : {}),
      };

      const subsResponse = await stripe.subscriptions.list(listParams, requestOptions);

      if (!subsResponse.data || subsResponse.data.length === 0) {
        break;
      }

      for (const sub of subsResponse.data) {
        // Enforce strict deduplication
        if (seenSubscriptionIds.has(sub.id)) continue;
        seenSubscriptionIds.add(sub.id);
        sampledSubsCount++;

        const norm = normalizeSubscriptionToMonthlyCents(sub);
        const bucket = getCurrencyBucket(norm.currency);
        const custId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (sub.status === "trialing") {
          bucket.trialingSubscribersCount += 1;
        } else if (sub.status === "canceled") {
          bucket.canceledSubscribersCount += 1;
        }

        // Track plan name distribution
        const firstItem = sub.items?.data?.[0];
        const rawPlanName = (
          sub.metadata?.plan ||
          firstItem?.price?.nickname ||
          firstItem?.price?.lookup_key ||
          (firstItem?.price?.recurring?.interval === "year" ? "Anual" : "Mensal")
        ).toString();
        const planName = rawPlanName.charAt(0).toUpperCase() + rawPlanName.slice(1);

        if (!bucket.revenueByPlan) {
          bucket.revenueByPlan = {};
        }
        if (!bucket.revenueByPlan[planName]) {
          bucket.revenueByPlan[planName] = {
            planName,
            mrrCents: 0,
            subscribersCount: 0,
            percentageOfMrr: 0,
          };
        }

        if (norm.isAtRiskDunning) {
          bucket.atRiskDunningMrrCents += norm.netEffectiveMonthlyCents;
          bucket.atRiskSubscribersCount += 1;
          if (custId) atRiskCustomerIds.add(custId);
        } else if (!norm.isExcluded && !norm.isPaused && sub.status === "active") {
          bucket.activeMrrCents += norm.netEffectiveMonthlyCents;
          bucket.grossContractualMrrCents += norm.grossMonthlyCents;
          bucket.discountSavingsMrrCents += norm.discountMonthlyCents;
          bucket.activeSubscribersCount += 1;
          bucket.revenueByPlan[planName].mrrCents += norm.netEffectiveMonthlyCents;
          bucket.revenueByPlan[planName].subscribersCount += 1;
          if (norm.discountMonthlyCents > 0) {
            bucket.discountedSubscribersCount += 1;
          }
          if (custId) activeCustomerIds.add(custId);
        }
      }

      subHasMore = subsResponse.has_more;
      if (subsResponse.data.length > 0) {
        subStartingAfter = subsResponse.data[subsResponse.data.length - 1].id;
      } else {
        break;
      }
    }
  } catch (subErr) {
    logger.error("Failed to query Stripe subscriptions with pagination for connected account", subErr, {
      connectedAccountId: params.connectedAccountId,
      pagesTraversed: pagesTraversedSubs,
    });
    throw subErr;
  }

  // 2. Fetch Balance Transactions with Full Cursor-Based Pagination & Deduplication
  const seenBtIds = new Set<string>();
  let btStartingAfter: string | undefined = undefined;
  let btHasMore = true;

  try {
    while (btHasMore && pagesTraversedBt < MAX_PAGES_PER_QUERY_SAFEGUARD) {
      pagesTraversedBt++;
      const btListParams: Stripe.BalanceTransactionListParams = {
        limit: 100,
        created: { gte: twelveMonthsAgo },
        ...(btStartingAfter ? { starting_after: btStartingAfter } : {}),
      };

      const btResponse = await stripe.balanceTransactions.list(btListParams, requestOptions);

      if (!btResponse.data || btResponse.data.length === 0) {
        break;
      }

      for (const bt of btResponse.data) {
        // Enforce strict deduplication
        if (seenBtIds.has(bt.id)) continue;
        seenBtIds.add(bt.id);
        sampledBalanceTransactionsCount++;

        const bucket = getCurrencyBucket(bt.currency);
        const monthKey = new Date(bt.created * 1000).toISOString().slice(0, 7);

        if (!monthlyHistoryMap[bucket.currency][monthKey]) {
          monthlyHistoryMap[bucket.currency][monthKey] = {
            monthKey,
            grossRevenueCents: 0,
            netRevenueCents: 0,
            newCustomersCount: 0,
          };
        }
        const mPoint = monthlyHistoryMap[bucket.currency][monthKey];

        if (bt.type === "charge" || bt.type === "payment") {
          sampledChargesCount++;
          bucket.grossRevenueCents += bt.amount;
          bucket.netRevenueCents += bt.net;
          bucket.stripeFeesCents += bt.fee;
          mPoint.grossRevenueCents += bt.amount;
          mPoint.netRevenueCents += bt.net;
        } else if (bt.type === "refund") {
          bucket.totalRefundsCents += Math.abs(bt.amount);
          bucket.netRevenueCents += bt.net; // bt.net is negative
          mPoint.netRevenueCents += bt.net;
        } else if (bt.type === "adjustment") {
          bucket.openDisputesCents += Math.abs(bt.amount);
          bucket.netRevenueCents += bt.net;
          mPoint.netRevenueCents += bt.net;
        }
      }

      btHasMore = btResponse.has_more;
      if (btResponse.data.length > 0) {
        btStartingAfter = btResponse.data[btResponse.data.length - 1].id;
      } else {
        break;
      }
    }
  } catch (btErr) {
    logger.error("Failed to query Stripe balance transactions with pagination for connected account", btErr, {
      connectedAccountId: params.connectedAccountId,
      pagesTraversed: pagesTraversedBt,
    });
    throw btErr;
  }

  // Format monthly history sorted
  const formattedMonthlyHistory: Record<string, MonthlyMetricPoint[]> = {};
  for (const c of Object.keys(monthlyHistoryMap)) {
    formattedMonthlyHistory[c] = Object.values(monthlyHistoryMap[c]).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );
  }

  // Compute derived SaaS metrics (ARR, ARPU, Churn, Trial Conversion, Plan Percentages, Performance)
  for (const c of Object.keys(currencyMap)) {
    const bucket = currencyMap[c];
    bucket.arrCents = bucket.activeMrrCents * 12;

    // ARPU = activeMrrCents / activeSubscribersCount
    bucket.arpuCents =
      bucket.activeSubscribersCount > 0
        ? Math.round(bucket.activeMrrCents / bucket.activeSubscribersCount)
        : 0;

    // Churn Rate = Canceled / (Active + Canceled) * 100
    const totalSubsEver = bucket.activeSubscribersCount + bucket.canceledSubscribersCount;
    bucket.churnRatePercentage =
      totalSubsEver > 0
        ? Number(((bucket.canceledSubscribersCount / totalSubsEver) * 100).toFixed(1))
        : 0;

    // Trial Conversion Rate = Active / (Active + Trialing) * 100
    const totalFunnel = bucket.activeSubscribersCount + bucket.trialingSubscribersCount;
    bucket.trialConversionRatePercentage =
      totalFunnel > 0
        ? Number(((bucket.activeSubscribersCount / totalFunnel) * 100).toFixed(1))
        : 0;

    // Plan breakdown percentages
    if (bucket.revenueByPlan) {
      for (const plan of Object.values(bucket.revenueByPlan)) {
        plan.percentageOfMrr =
          bucket.activeMrrCents > 0
            ? Number(((plan.mrrCents / bucket.activeMrrCents) * 100).toFixed(1))
            : 0;
      }
    }

    // Performance analysis & Run-Rate projection (MoM & next month estimate)
    const history = formattedMonthlyHistory[c] || [];
    let momGrowth: number | null = null;
    if (history.length >= 2) {
      const lastMonth = history[history.length - 1].netRevenueCents;
      const prevMonth = history[history.length - 2].netRevenueCents;
      if (prevMonth > 0) {
        momGrowth = Number((((lastMonth - prevMonth) / prevMonth) * 100).toFixed(1));
      }
    }

    bucket.performanceAnalysis = {
      momRevenueGrowthPercentage: momGrowth,
      projectedNextMonthMrrCents: bucket.activeMrrCents,
      isProjectionAnEstimate: true,
    };
  }

  const primaryCurrency = Object.keys(currencyMap)[0] || "eur";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SNAPSHOT_FRESH_DURATION_MS);

  let snapshot: StripeFinancialSnapshot = {
    organizationId: params.organizationId,
    connectedAccountId: params.connectedAccountId,
    livemode: !params.connectedAccountId.startsWith("acct_test") && !params.accessToken.includes("_test_"),
    computedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    freshnessStatus: "fresh",
    primaryCurrency,
    currencies: currencyMap,
    monthlyHistory: formattedMonthlyHistory,
    totalActiveCustomersCount: activeCustomerIds.size,
    totalAtRiskCustomersCount: atRiskCustomerIds.size,
    dunningGracePeriodDays: DEFAULT_DUNNING_GRACE_PERIOD_DAYS,
    timezone: params.timezone,
    provenance: {
      source: "stripe_connect_api",
      apiVersion: "2026-08-26.dahlia",
      sampledChargesCount,
      sampledSubscriptionsCount: sampledSubsCount,
      sampledBalanceTransactionsCount,
      lastSyncedAt: now.toISOString(),
      payloadSizeBytes: 0,
      safeguardPruned: false,
      pagesTraversedSubscriptions: pagesTraversedSubs,
      pagesTraversedBalanceTransactions: pagesTraversedBt,
      hasMoreUnfetched:
        Boolean(subHasMore && pagesTraversedSubs >= MAX_PAGES_PER_QUERY_SAFEGUARD) ||
        Boolean(btHasMore && pagesTraversedBt >= MAX_PAGES_PER_QUERY_SAFEGUARD),
    },
  };

  // Measure payload size and enforce safeguard
  const rawJson = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(rawJson, "utf8");
  snapshot.provenance.payloadSizeBytes = sizeBytes;

  if (sizeBytes > PAYLOAD_MAX_BYTES_SAFEGUARD) {
    logger.warn("Metric snapshot exceeded 32 KB safeguard limit; pruning non-essential history", {
      sizeBytes,
      organizationId: params.organizationId,
    });
    snapshot.monthlyHistory = {};
    snapshot.provenance.safeguardPruned = true;
    snapshot.provenance.payloadSizeBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  }

  return snapshot;
}

/**
 * Computes a SHA-256 checksum for a snapshot payload to guarantee auditability.
 */
function computeSnapshotChecksum(snapshot: StripeFinancialSnapshot): string {
  const content = JSON.stringify({
    org: snapshot.organizationId,
    currencies: snapshot.currencies,
    computedAt: snapshot.computedAt,
  });
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Retrieves the current financial snapshot or fetches on demand with multi-instance mutex protection.
 */
export async function getOrFetchStripeFinancialSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{ snapshot: StripeFinancialSnapshot | null; status: MetricFreshnessStatus; error?: string }> {
  // 1. Fetch organization integration for Stripe
  const { data: integrations, error: intError } = await supabase
    .from("organization_integrations")
    .select("provider_account_id, encrypted_access_token, status, metadata")
    .eq("organization_id", organizationId)
    .eq("provider", "stripe")
    .order("updated_at", { ascending: false })
    .limit(1);

  const integration = integrations?.[0];

  if (intError || !integration || integration.status !== "connected") {
    return { snapshot: null, status: "error", error: "Stripe not connected for this workspace." };
  }

  const connectedAccountId = integration.provider_account_id;
  const accessToken = integration.encrypted_access_token
    ? decryptToken(integration.encrypted_access_token)
    : "";

  // 2. Fetch organization timezone and currency
  const { data: orgData } = await supabase
    .from("organizations")
    .select("default_timezone, default_currency")
    .eq("id", organizationId)
    .single();

  const timezone = orgData?.default_timezone || "Europe/Lisbon";

  // 3. Check existing snapshot in database
  const { data: existingSnapshot } = await supabase
    .from("organization_metric_snapshots")
    .select("payload, computed_at, expires_at, status, sync_lock_until, error_details")
    .eq("organization_id", organizationId)
    .eq("metric_type", "stripe_financial_overview")
    .maybeSingle();

  const now = new Date();

  // Evaluate existing snapshot freshness
  if (existingSnapshot && !options.forceRefresh) {
    const computedAtDate = new Date(existingSnapshot.computed_at);
    const expiresAtDate = new Date(existingSnapshot.expires_at);
    const ageMs = now.getTime() - computedAtDate.getTime();

    const snapshotPayload = existingSnapshot.payload as StripeFinancialSnapshot;

    if (now <= expiresAtDate && existingSnapshot.status === "fresh") {
      return { snapshot: snapshotPayload, status: "fresh" };
    }

    if (ageMs < SNAPSHOT_STALE_DURATION_MS) {
      // Return stale snapshot immediately to prevent UI blocking
      snapshotPayload.freshnessStatus = "stale";
      return { snapshot: snapshotPayload, status: "stale" };
    }
  }

  // 4. Concurrency Mutex: check if another instance holds an active lease
  const lockExpires = existingSnapshot?.sync_lock_until
    ? new Date(existingSnapshot.sync_lock_until)
    : null;

  if (lockExpires && now < lockExpires) {
    // Another instance is currently syncing -> return existing snapshot as stale or wait
    if (existingSnapshot?.payload) {
      const snap = existingSnapshot.payload as StripeFinancialSnapshot;
      snap.freshnessStatus = "syncing";
      return { snapshot: snap, status: "syncing" };
    }
  }

  // 5. Acquire lease-based mutex (2 minutes duration) with resilience
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const privilegedDb = createServiceClient();
    const newLockUntil = new Date(now.getTime() + MUTEX_LEASE_DURATION_MS).toISOString();
    await privilegedDb
      .from("organization_metric_snapshots")
      .upsert(
        {
          organization_id: organizationId,
          metric_type: "stripe_financial_overview",
          status: "syncing",
          sync_lock_until: newLockUntil,
        },
        { onConflict: "organization_id,metric_type" }
      );
  } catch (lockErr) {
    logger.warn("Could not acquire snapshot mutex in database, continuing computation in memory", { lockErr });
  }

  // 6. Execute Stripe API computation with full cursor pagination
  try {
    const computedSnapshot = await computeStripeMetricsFromApi({
      connectedAccountId,
      accessToken,
      timezone,
      organizationId,
    });

    const checksum = computeSnapshotChecksum(computedSnapshot);

    // 7. Persist lean snapshot (1 row) and release mutex (resilient to DB write restrictions)
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const privilegedDb = createServiceClient();
      await privilegedDb
        .from("organization_metric_snapshots")
        .upsert(
          {
            organization_id: organizationId,
            metric_type: "stripe_financial_overview",
            payload: computedSnapshot,
            currency_summaries: computedSnapshot.currencies,
            computed_at: computedSnapshot.computedAt,
            expires_at: computedSnapshot.expiresAt,
            status: "fresh",
            checksum,
            payload_size_bytes: computedSnapshot.provenance.payloadSizeBytes,
            sync_lock_until: null,
            error_details: null,
          },
          { onConflict: "organization_id,metric_type" }
        );
    } catch (persistErr) {
      logger.warn("Could not persist computed snapshot to database cache, returning in-memory snapshot", { persistErr });
    }

    return { snapshot: computedSnapshot, status: "fresh" };
  } catch (apiErr: unknown) {
    const errorMessage = apiErr instanceof Error ? apiErr.message : "Stripe API communication failed.";
    logger.error("Error computing Stripe financial snapshot", apiErr, { organizationId });

    // Release lock and mark error or preserve last snapshot with stale flag
    try {
      await supabase
        .from("organization_metric_snapshots")
        .update({
          status: "error",
          sync_lock_until: null,
          error_details: errorMessage,
        })
        .eq("organization_id", organizationId)
        .eq("metric_type", "stripe_financial_overview");
    } catch {
      // Ignore cache release error
    }

    if (existingSnapshot?.payload) {
      const stalePayload = existingSnapshot.payload as StripeFinancialSnapshot;
      stalePayload.freshnessStatus = "error";
      stalePayload.errorDetails = errorMessage;
      return { snapshot: stalePayload, status: "error", error: errorMessage };
    }

    return { snapshot: null, status: "error", error: errorMessage };
  }
}
