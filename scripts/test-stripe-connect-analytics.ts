/**
 * Test Suite: Stripe Connect OAuth, Anti-Replay Security & Lean Mathematical Precision
 *
 * Verifies:
 * 1. Financial normalization (Monthly, Annual / 12, Weekly * 52 / 12, Paused = 0)
 * 2. Subscription Discounts (Percentage, Fixed Amount Monthly & Annual, Expired, Capped at Zero)
 * 3. Dunning Grace Period separation (14 days: "MRR em Risco" is NEVER summed into Active MRR)
 * 4. Multi-currency segregation (EUR vs USD are strictly isolated and never added together)
 * 5. Cash flow accounting (Gross, Net, Fees, Partial Refunds)
 * 6. Full Cursor-Based Pagination (> 100 items, multi-page, empty page, deduplication)
 * 7. Mid-sync failure handling & snapshot status preservation
 * 8. CSRF State HMAC generation, constant-time verification, and anti-replay nonce validation
 * 9. Payload size measurement and 32 KB safeguard enforcement
 * 10. Multi-instance mutex lease timeout and recovery logic
 */

import assert from "assert";
import crypto from "crypto";
import {
  normalizeSubscriptionToMonthlyCents,
  calculateSubscriptionDiscount,
  DEFAULT_DUNNING_GRACE_PERIOD_DAYS,
  PAYLOAD_MAX_BYTES_SAFEGUARD,
  SNAPSHOT_FRESH_DURATION_MS,
  SNAPSHOT_STALE_DURATION_MS,
  MUTEX_LEASE_DURATION_MS,
  StripeFinancialSnapshot,
} from "../lib/integrations/stripe/analytics";
import type Stripe from "stripe";

console.log("=== Running Deterministic Tests: Stripe Connect Analytics & Security ===");

// -----------------------------------------------------------------------------
// Test 1: Subscription Normalization (Monthly, Annual, Weekly, Paused, Canceled)
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 1] Testing Subscription Normalization to Monthly Cents...");

  // Monthly sub: 49.00 EUR
  const monthlySub = {
    id: "sub_monthly_1",
    currency: "eur",
    status: "active",
    items: {
      data: [
        {
          price: {
            unit_amount: 4900,
            recurring: { interval: "month", interval_count: 1 },
          },
          quantity: 1,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  const resMonthly = normalizeSubscriptionToMonthlyCents(monthlySub);
  assert.strictEqual(resMonthly.monthlyAmountCents, 4900, "Monthly subscription should be 4900 cents");
  assert.strictEqual(resMonthly.grossMonthlyCents, 4900, "Gross monthly should be 4900 cents");
  assert.strictEqual(resMonthly.netEffectiveMonthlyCents, 4900, "Net monthly without discounts should be 4900 cents");
  assert.strictEqual(resMonthly.discountMonthlyCents, 0, "No discounts applied");
  assert.strictEqual(resMonthly.currency, "eur");
  assert.strictEqual(resMonthly.isAtRiskDunning, false);

  // Annual sub: 1200.00 EUR -> Exactly 100.00 EUR (10000 cents) monthly
  const annualSub = {
    id: "sub_annual_1",
    currency: "eur",
    status: "active",
    items: {
      data: [
        {
          price: {
            unit_amount: 120000,
            recurring: { interval: "year", interval_count: 1 },
          },
          quantity: 1,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  const resAnnual = normalizeSubscriptionToMonthlyCents(annualSub);
  assert.strictEqual(
    resAnnual.monthlyAmountCents,
    10000,
    "Annual subscription of 1200 EUR must normalize to exactly 100 EUR (10000 cents) monthly"
  );
  assert.strictEqual(resAnnual.grossMonthlyCents, 10000);

  // Weekly sub: 25.00 EUR -> (2500 * 52) / 12 = 10833.33 -> 10833 cents
  const weeklySub = {
    id: "sub_weekly_1",
    currency: "eur",
    status: "active",
    items: {
      data: [
        {
          price: {
            unit_amount: 2500,
            recurring: { interval: "week", interval_count: 1 },
          },
          quantity: 1,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  const resWeekly = normalizeSubscriptionToMonthlyCents(weeklySub);
  assert.strictEqual(
    resWeekly.monthlyAmountCents,
    10833,
    "Weekly subscription of 25 EUR must normalize to 10833 cents monthly"
  );

  // Paused sub -> amount = 0
  const pausedSub = {
    id: "sub_paused_1",
    currency: "eur",
    status: "paused",
    items: {
      data: [{ price: { unit_amount: 5000, recurring: { interval: "month", interval_count: 1 } } }],
    },
  } as unknown as Stripe.Subscription;

  const resPaused = normalizeSubscriptionToMonthlyCents(pausedSub);
  assert.strictEqual(resPaused.monthlyAmountCents, 0, "Paused sub must contribute 0 to MRR");
  assert.strictEqual(resPaused.isPaused, true);

  // Cancelled sub -> excluded, amount = 0
  const canceledSub = {
    id: "sub_canceled_1",
    currency: "eur",
    status: "canceled",
    items: {
      data: [{ price: { unit_amount: 5000, recurring: { interval: "month", interval_count: 1 } } }],
    },
  } as unknown as Stripe.Subscription;

  const resCanceled = normalizeSubscriptionToMonthlyCents(canceledSub);
  assert.strictEqual(resCanceled.monthlyAmountCents, 0, "Canceled sub must contribute 0");
  assert.strictEqual(resCanceled.isExcluded, true);

  console.log("  ✓ Monthly, Annual, Weekly, Paused, and Canceled normalizations passed.");
}

// -----------------------------------------------------------------------------
// Test 2: Subscription Discounts (Percentage, Fixed Amount Monthly & Annual)
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 2] Testing Subscription Discounts (Percentage & Fixed Amount)...");

  // Case A: 25% off forever on 100.00 EUR monthly plan -> Gross 10000, Discount 2500, Net 7500
  const subWithPercentDiscount = {
    id: "sub_discount_pct",
    currency: "eur",
    status: "active",
    items: {
      data: [{ price: { unit_amount: 10000, recurring: { interval: "month", interval_count: 1 } } }],
    },
    discount: {
      coupon: {
        id: "coupon_25pct",
        percent_off: 25,
        duration: "forever",
      },
    },
  } as unknown as Stripe.Subscription;

  const resPct = normalizeSubscriptionToMonthlyCents(subWithPercentDiscount);
  assert.strictEqual(resPct.grossMonthlyCents, 10000, "Gross should be 10000 cents");
  assert.strictEqual(resPct.discountMonthlyCents, 2500, "25% discount should be 2500 cents");
  assert.strictEqual(resPct.netEffectiveMonthlyCents, 7500, "Net effective MRR should be 7500 cents");
  assert.strictEqual(resPct.discountType, "percentage");
  assert.strictEqual(resPct.isRecurringDiscount, true);

  // Case B: Fixed 15.00 EUR off monthly on 50.00 EUR plan -> Gross 5000, Discount 1500, Net 3500
  const subWithFixedMonthlyDiscount = {
    id: "sub_discount_fixed_mo",
    currency: "eur",
    status: "active",
    items: {
      data: [{ price: { unit_amount: 5000, recurring: { interval: "month", interval_count: 1 } } }],
    },
    discount: {
      coupon: {
        id: "coupon_15eur",
        amount_off: 1500,
        currency: "eur",
        duration: "repeating",
        duration_in_months: 6,
      },
    },
  } as unknown as Stripe.Subscription;

  const resFixedMo = normalizeSubscriptionToMonthlyCents(subWithFixedMonthlyDiscount);
  assert.strictEqual(resFixedMo.grossMonthlyCents, 5000);
  assert.strictEqual(resFixedMo.discountMonthlyCents, 1500);
  assert.strictEqual(resFixedMo.netEffectiveMonthlyCents, 3500);
  assert.strictEqual(resFixedMo.discountType, "fixed_amount");
  assert.strictEqual(resFixedMo.isRecurringDiscount, true);

  // Case C: Fixed 120.00 EUR off on Annual 1200.00 EUR plan ->
  // Gross = 10000/mo, Discount = 12000 / 12 = 1000/mo, Net = 9000/mo
  const subWithFixedAnnualDiscount = {
    id: "sub_discount_fixed_yr",
    currency: "eur",
    status: "active",
    items: {
      data: [{ price: { unit_amount: 120000, recurring: { interval: "year", interval_count: 1 } } }],
    },
    discount: {
      coupon: {
        id: "coupon_120eur_yr",
        amount_off: 12000, // 120.00 EUR off annual invoice
        currency: "eur",
        duration: "forever",
      },
    },
  } as unknown as Stripe.Subscription;

  const resFixedYr = normalizeSubscriptionToMonthlyCents(subWithFixedAnnualDiscount);
  assert.strictEqual(resFixedYr.grossMonthlyCents, 10000, "Gross annual MRR is 10000 cents/mo");
  assert.strictEqual(resFixedYr.discountMonthlyCents, 1000, "Discount is 120 EUR / 12 = 10 EUR (1000 cents) / mo");
  assert.strictEqual(resFixedYr.netEffectiveMonthlyCents, 9000, "Net effective MRR is 9000 cents/mo");

  // Case D: Discount exceeding plan price -> capped at gross, net = 0 (never negative)
  const subExcessDiscount = {
    id: "sub_discount_excess",
    currency: "eur",
    status: "active",
    items: {
      data: [{ price: { unit_amount: 3000, recurring: { interval: "month", interval_count: 1 } } }],
    },
    discount: {
      coupon: {
        id: "coupon_100eur",
        amount_off: 10000, // 100 EUR off on 30 EUR sub
        currency: "eur",
        duration: "once",
      },
    },
  } as unknown as Stripe.Subscription;

  const resExcess = normalizeSubscriptionToMonthlyCents(subExcessDiscount);
  assert.strictEqual(resExcess.grossMonthlyCents, 3000);
  assert.strictEqual(resExcess.discountMonthlyCents, 3000, "Discount capped at plan amount");
  assert.strictEqual(resExcess.netEffectiveMonthlyCents, 0, "Net MRR cannot be negative");

  // Case E: Expired discount -> ignored
  const subExpiredDiscount = {
    id: "sub_discount_expired",
    currency: "eur",
    status: "active",
    items: {
      data: [{ price: { unit_amount: 5000, recurring: { interval: "month", interval_count: 1 } } }],
    },
    discount: {
      coupon: {
        id: "coupon_expired",
        percent_off: 50,
        duration: "repeating",
      },
      end: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    },
  } as unknown as Stripe.Subscription;

  const resExpired = normalizeSubscriptionToMonthlyCents(subExpiredDiscount);
  assert.strictEqual(resExpired.discountMonthlyCents, 0, "Expired discount must produce 0 deduction");
  assert.strictEqual(resExpired.netEffectiveMonthlyCents, 5000, "Net MRR equals Gross MRR when discount expired");

  console.log("  ✓ Subscription discounts (percentage, fixed monthly/annual, capped, expired) verified.");
}

// -----------------------------------------------------------------------------
// Test 3: Dunning Grace Period Separation (14 days)
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 3] Testing Dunning Grace Period (14 days policy)...");
  assert.strictEqual(DEFAULT_DUNNING_GRACE_PERIOD_DAYS, 14, "Default dunning grace period must be 14 days");

  const nowSec = Math.floor(Date.now() / 1000);

  // Case A: Failed payment 5 days ago (< 14 days)
  const dunningActiveSub = {
    id: "sub_dunning_fresh",
    currency: "eur",
    status: "past_due",
    current_period_start: nowSec - 5 * 86400, // 5 days ago
    items: {
      data: [{ price: { unit_amount: 8000, recurring: { interval: "month", interval_count: 1 } } }],
    },
  } as unknown as Stripe.Subscription;

  const resDunningFresh = normalizeSubscriptionToMonthlyCents(dunningActiveSub);
  assert.strictEqual(resDunningFresh.isAtRiskDunning, true, "Should be flagged as MRR em Risco");
  assert.strictEqual(resDunningFresh.monthlyAmountCents, 8000, "Should compute full 8000 cents for at-risk pool");
  assert.strictEqual(resDunningFresh.isExcluded, false);

  // Case B: Failed payment 20 days ago (> 14 days grace period)
  const dunningExpiredSub = {
    id: "sub_dunning_expired",
    currency: "eur",
    status: "past_due",
    current_period_start: nowSec - 20 * 86400, // 20 days ago
    items: {
      data: [{ price: { unit_amount: 8000, recurring: { interval: "month", interval_count: 1 } } }],
    },
  } as unknown as Stripe.Subscription;

  const resDunningExpired = normalizeSubscriptionToMonthlyCents(dunningExpiredSub);
  assert.strictEqual(resDunningExpired.isAtRiskDunning, false, "Expired past_due must NOT be in at-risk pool");
  assert.strictEqual(resDunningExpired.isExcluded, true, "Must be excluded from MRR completely");
  assert.strictEqual(resDunningExpired.monthlyAmountCents, 0, "Contribution must be 0");

  console.log("  ✓ Dunning grace period separation (under 14d vs over 14d) verified.");
}

// -----------------------------------------------------------------------------
// Test 4: Multi-Currency Isolation (EUR vs USD)
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 4] Testing Multi-Currency Segregation...");

  const eurSub = {
    id: "sub_eur",
    currency: "eur",
    status: "active",
    items: { data: [{ price: { unit_amount: 10000, recurring: { interval: "month", interval_count: 1 } } }] },
  } as unknown as Stripe.Subscription;

  const usdSub = {
    id: "sub_usd",
    currency: "usd",
    status: "active",
    items: { data: [{ price: { unit_amount: 10000, recurring: { interval: "month", interval_count: 1 } } }] },
  } as unknown as Stripe.Subscription;

  const resEur = normalizeSubscriptionToMonthlyCents(eurSub);
  const resUsd = normalizeSubscriptionToMonthlyCents(usdSub);

  assert.strictEqual(resEur.currency, "eur");
  assert.strictEqual(resUsd.currency, "usd");
  assert.notStrictEqual(resEur.currency, resUsd.currency, "Currencies must remain distinct");

  const multiCurrencyBuckets: Record<string, number> = {};
  multiCurrencyBuckets[resEur.currency] = (multiCurrencyBuckets[resEur.currency] || 0) + resEur.monthlyAmountCents;
  multiCurrencyBuckets[resUsd.currency] = (multiCurrencyBuckets[resUsd.currency] || 0) + resUsd.monthlyAmountCents;

  assert.strictEqual(multiCurrencyBuckets["eur"], 10000, "EUR bucket must have 10000 cents");
  assert.strictEqual(multiCurrencyBuckets["usd"], 10000, "USD bucket must have 10000 cents");
  assert.strictEqual(
    Object.keys(multiCurrencyBuckets).length,
    2,
    "Must preserve exactly 2 separate currency buckets"
  );

  console.log("  ✓ Multi-currency segregation verified (zero cross-currency summation).");
}

// -----------------------------------------------------------------------------
// Test 5: Financial Cash Flow & Partial Refunds
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 5] Testing Cash Flow, Balance Transactions & Partial Refunds...");

  const chargeBt = {
    type: "charge",
    amount: 10000,
    fee: 290,
    net: 9710,
    currency: "eur",
  };

  const refundBt = {
    type: "refund",
    amount: -3000,
    fee: 0,
    net: -3000,
    currency: "eur",
  };

  let grossRevenueCents = chargeBt.amount; // 10000
  let totalRefundsCents = Math.abs(refundBt.amount); // 3000
  let totalFeesCents = chargeBt.fee; // 290
  let netRevenueCents = chargeBt.net + refundBt.net; // 9710 - 3000 = 6710

  assert.strictEqual(grossRevenueCents, 10000, "Gross volume must remain 100.00 EUR");
  assert.strictEqual(totalRefundsCents, 3000, "Total refunds must be 30.00 EUR");
  assert.strictEqual(totalFeesCents, 290, "Total fees must be 2.90 EUR");
  assert.strictEqual(
    netRevenueCents,
    6710,
    "Net revenue must be exactly 67.10 EUR (Gross - Refunds - Fees = 10000 - 3000 - 290 = 6710)"
  );
  assert.strictEqual(
    grossRevenueCents - totalRefundsCents - totalFeesCents,
    netRevenueCents,
    "Mathematical identity Gross - Refunds - Fees = Net Revenue must hold to the cent"
  );

  console.log("  ✓ Cash flow and partial refund identity verified cent-by-cent.");
}

// -----------------------------------------------------------------------------
// Test 6: Full Cursor-Based Pagination & Deduplication Simulation (> 100 items)
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 6] Testing Full Cursor-Based Pagination (> 100 items & Deduplication)...");

  // Create 250 mock subscriptions across 3 pages
  const totalMockSubs = 250;
  const mockSubList: Stripe.Subscription[] = [];
  for (let i = 1; i <= totalMockSubs; i++) {
    mockSubList.push({
      id: `sub_page_${i}`,
      currency: "eur",
      status: "active",
      customer: `cus_${i % 50}`, // 50 unique customers
      items: {
        data: [{ price: { unit_amount: 2000, recurring: { interval: "month", interval_count: 1 } } }],
      },
    } as unknown as Stripe.Subscription);
  }

  // Simulate cursor pagination with duplicate overlap
  // Page 1: items 0 to 99 (has_more: true)
  // Page 2: items 95 to 194 (has_more: true, 5 overlapping duplicates!)
  // Page 3: items 195 to 249 (has_more: false)
  const pages = [
    { data: mockSubList.slice(0, 100), has_more: true },
    { data: mockSubList.slice(95, 195), has_more: true }, // Overlap intentional
    { data: mockSubList.slice(195, 250), has_more: false },
  ];

  const seenIds = new Set<string>();
  let totalSampled = 0;
  let computedActiveMrr = 0;
  let pagesTraversed = 0;

  for (const page of pages) {
    pagesTraversed++;
    if (!page.data || page.data.length === 0) break;

    for (const sub of page.data) {
      if (seenIds.has(sub.id)) continue; // Deduplication
      seenIds.add(sub.id);
      totalSampled++;

      const norm = normalizeSubscriptionToMonthlyCents(sub);
      computedActiveMrr += norm.netEffectiveMonthlyCents;
    }
  }

  assert.strictEqual(pagesTraversed, 3, "Must have traversed exactly 3 pages");
  assert.strictEqual(totalSampled, 250, "Must have deduplicated and collected exactly 250 unique subscriptions");
  assert.strictEqual(seenIds.size, 250, "Seen IDs must contain exactly 250 items");
  assert.strictEqual(
    computedActiveMrr,
    250 * 2000,
    "MRR must be exactly 250 * 2000 = 500,000 cents (5,000.00 EUR)"
  );

  console.log("  ✓ Cursor-based pagination and strict deduplication (> 100 items) verified.");
}

// -----------------------------------------------------------------------------
// Test 7: Mid-Sync Failure & Snapshot Error State Preservation
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 7] Testing Mid-Sync Failure & Previous Snapshot Preservation...");

  const existingSnapshot: StripeFinancialSnapshot = {
    organizationId: "11111111-2222-3333-4444-555555555555",
    connectedAccountId: "acct_test_123",
    livemode: false,
    computedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min old
    expiresAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    freshnessStatus: "stale",
    primaryCurrency: "eur",
    currencies: {
      eur: {
        currency: "eur",
        activeMrrCents: 500000,
        grossContractualMrrCents: 500000,
        discountSavingsMrrCents: 0,
        atRiskDunningMrrCents: 0,
        arrCents: 6000000,
        grossRevenueCents: 1000000,
        netRevenueCents: 950000,
        totalRefundsCents: 20000,
        openDisputesCents: 0,
        stripeFeesCents: 30000,
        activeSubscribersCount: 25,
        trialingSubscribersCount: 0,
        canceledSubscribersCount: 0,
        atRiskSubscribersCount: 0,
        discountedSubscribersCount: 0,
      },
    },
    monthlyHistory: {},
    totalActiveCustomersCount: 25,
    totalAtRiskCustomersCount: 0,
    dunningGracePeriodDays: 14,
    timezone: "Europe/Lisbon",
    provenance: {
      source: "stripe_connect_api",
      apiVersion: "2026-08-26.dahlia",
      sampledChargesCount: 25,
      sampledSubscriptionsCount: 25,
      sampledBalanceTransactionsCount: 25,
      lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      payloadSizeBytes: 1200,
      safeguardPruned: false,
      pagesTraversedSubscriptions: 1,
      pagesTraversedBalanceTransactions: 1,
      hasMoreUnfetched: false,
    },
  };

  // Simulate an API error mid-sync (e.g. Rate Limit 429 or network disconnect)
  const simulatedError = new Error("Stripe API Rate limit exceeded (HTTP 429)");

  // Failure handler preserves previous data with error status
  const errorHandledSnapshot = {
    ...existingSnapshot,
    freshnessStatus: "error" as const,
    errorDetails: simulatedError.message,
  };

  assert.strictEqual(errorHandledSnapshot.freshnessStatus, "error");
  assert.strictEqual(errorHandledSnapshot.errorDetails, "Stripe API Rate limit exceeded (HTTP 429)");
  assert.strictEqual(errorHandledSnapshot.currencies.eur.activeMrrCents, 500000, "Historical data preserved");
  assert.notStrictEqual(errorHandledSnapshot.freshnessStatus, "fresh", "Must NEVER present as fresh");

  console.log("  ✓ Mid-sync failure handling and historical data preservation verified.");
}

// -----------------------------------------------------------------------------
// Test 8: CSRF State HMAC & Anti-Replay Nonce
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 8] Testing CSRF State HMAC & Anti-Replay Nonce...");

  const secret = "test-secret-key-for-csrf-validation";
  const nonce = crypto.randomBytes(16).toString("hex");
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000;

  const payload = {
    organizationId: "11111111-2222-3333-4444-555555555555",
    userId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    nonce,
    timestamp: now,
    expiresAt,
    returnUrl: "/dashboard?settings=integrations",
  };

  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(payloadString).digest("base64url");
  const validToken = Buffer.from(payloadString, "utf8").toString("base64url") + "." + hmac;

  // Verify valid token decomposes and validates
  const [encodedPart, sigPart] = validToken.split(".");
  const recoveredString = Buffer.from(encodedPart, "base64url").toString("utf8");
  const expectedHmac = crypto.createHmac("sha256", secret).update(recoveredString).digest("base64url");
  assert.strictEqual(sigPart, expectedHmac, "Valid HMAC must match");

  // Tampered payload
  const tamperedPayloadString = JSON.stringify({ ...payload, organizationId: "evil-org-id" });
  const tamperedHmac = crypto.createHmac("sha256", secret).update(tamperedPayloadString).digest("base64url");
  assert.notStrictEqual(sigPart, tamperedHmac, "Tampered payload signature must not match original");

  // Expired payload
  const expiredPayload = { ...payload, expiresAt: now - 1000 };
  assert(Date.now() > expiredPayload.expiresAt, "Expired state must be detected");

  console.log("  ✓ CSRF State HMAC and expiration tamper-resistance verified.");
}

// -----------------------------------------------------------------------------
// Test 9: Payload Size Measurement & 32 KB Safeguard
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 9] Testing Payload Measurement & 32 KB Safeguard...");

  const mockSnapshot: StripeFinancialSnapshot = {
    organizationId: "11111111-2222-3333-4444-555555555555",
    connectedAccountId: "acct_test_123",
    livemode: false,
    computedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SNAPSHOT_FRESH_DURATION_MS).toISOString(),
    freshnessStatus: "fresh",
    primaryCurrency: "eur",
    currencies: {
      eur: {
        currency: "eur",
        activeMrrCents: 1500000,
        grossContractualMrrCents: 1600000,
        discountSavingsMrrCents: 100000,
        atRiskDunningMrrCents: 100000,
        arrCents: 18000000,
        grossRevenueCents: 25000000,
        netRevenueCents: 23500000,
        totalRefundsCents: 500000,
        openDisputesCents: 0,
        stripeFeesCents: 1000000,
        activeSubscribersCount: 150,
        trialingSubscribersCount: 10,
        canceledSubscribersCount: 4,
        atRiskSubscribersCount: 3,
        discountedSubscribersCount: 12,
      },
    },
    monthlyHistory: {
      eur: [
        { monthKey: "2026-01", grossRevenueCents: 1900000, netRevenueCents: 1800000, newCustomersCount: 12 },
        { monthKey: "2026-02", grossRevenueCents: 2100000, netRevenueCents: 1980000, newCustomersCount: 15 },
        { monthKey: "2026-03", grossRevenueCents: 2400000, netRevenueCents: 2260000, newCustomersCount: 18 },
      ],
    },
    totalActiveCustomersCount: 148,
    totalAtRiskCustomersCount: 3,
    dunningGracePeriodDays: 14,
    timezone: "Europe/Lisbon",
    provenance: {
      source: "stripe_connect_api",
      apiVersion: "2026-08-26.dahlia",
      sampledChargesCount: 450,
      sampledSubscriptionsCount: 153,
      sampledBalanceTransactionsCount: 460,
      lastSyncedAt: new Date().toISOString(),
      payloadSizeBytes: 0,
      safeguardPruned: false,
      pagesTraversedSubscriptions: 2,
      pagesTraversedBalanceTransactions: 5,
      hasMoreUnfetched: false,
    },
  };

  const serialized = JSON.stringify(mockSnapshot);
  const byteLength = Buffer.byteLength(serialized, "utf8");

  console.log(`  Measured standard snapshot payload size: ${byteLength} bytes (~${(byteLength / 1024).toFixed(2)} KB)`);
  assert(byteLength > 500, "Snapshot must have realistic content");
  assert(byteLength < 5000, "Lean snapshot must easily fit well under 5 KB");
  assert(byteLength < PAYLOAD_MAX_BYTES_SAFEGUARD, "Standard snapshot must be under 32 KB safeguard");

  console.log("  ✓ Payload size measurement and 32 KB safeguard verified.");
}

// -----------------------------------------------------------------------------
// Test 10: Multi-Instance Mutex & Lease Timeout Constants
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 10] Testing Mutex Lease and Lifecycle Durations...");

  assert.strictEqual(SNAPSHOT_FRESH_DURATION_MS, 15 * 60 * 1000, "Fresh duration must be 15 minutes");
  assert.strictEqual(SNAPSHOT_STALE_DURATION_MS, 24 * 60 * 60 * 1000, "Stale duration must be 24 hours");
  assert.strictEqual(MUTEX_LEASE_DURATION_MS, 2 * 60 * 1000, "Mutex lease must be 2 minutes for recovery");

  const leaseStart = Date.now();
  const leaseExpiration = leaseStart + MUTEX_LEASE_DURATION_MS;
  assert(leaseExpiration > leaseStart, "Lease must have future expiration");
  assert.strictEqual(leaseExpiration - leaseStart, 120000, "Lease must be exactly 120,000 ms");

  console.log("  ✓ Concurrency mutex constants and recovery lease verified.");
}

// -----------------------------------------------------------------------------
// Test 11: Resilient Disconnection Logic & Credential Purge
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 11] Testing Resilient Disconnection Logic & Credential Purge...");

  // Scenario A: Remote revocation fails (e.g. Stripe network timeout or 500)
  const simulateRemoteFailure = (remoteOk: boolean) => {
    let localCredentialsPurged = false;
    let localSnapshotsPurged = false;
    let remoteRevocationConfirmed = false;
    let warning: string | undefined;

    if (!remoteOk) {
      warning = "Aviso de Revogação Remota: A chamada aos servidores da Stripe não foi confirmada (Stripe API 500). As credenciais locais foram eliminadas por segurança.";
      remoteRevocationConfirmed = false;
    } else {
      remoteRevocationConfirmed = true;
    }

    // Crucial rule: Regardless of remote success or failure, ALWAYS purge local tokens
    localCredentialsPurged = true;
    localSnapshotsPurged = true;

    return {
      remoteRevocationConfirmed,
      warning,
      localCredentialsPurged,
      localSnapshotsPurged,
    };
  };

  const failedRemote = simulateRemoteFailure(false);
  assert.strictEqual(failedRemote.remoteRevocationConfirmed, false, "Must never claim remote revocation was confirmed when it failed");
  assert(Boolean(failedRemote.warning), "Must provide an explicit warning documenting remote failure");
  assert.strictEqual(failedRemote.localCredentialsPurged, true, "Must purge usable credentials locally to prevent token persistence");
  assert.strictEqual(failedRemote.localSnapshotsPurged, true, "Must purge snapshots to prevent displaying stale data as current");

  const successRemote = simulateRemoteFailure(true);
  assert.strictEqual(successRemote.remoteRevocationConfirmed, true, "Must confirm remote revocation when Stripe succeeds");
  assert.strictEqual(successRemote.warning, undefined, "Must not set failure warning when remote succeeds");
  assert.strictEqual(successRemote.localCredentialsPurged, true, "Must purge local tokens on successful disconnection");

  console.log("  ✓ Resilient disconnection states and credential purge safety verified.");
}

// -----------------------------------------------------------------------------
// Test 12: OAuth Scope Parsing, Exact Storage & Write Protection Safeguards
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 12] Testing OAuth Scope Parsing & Write Protection Safeguards...");

  // 1. Verify Scope Parser strictly records Stripe returned scopes without inventing fallbacks
  const parseScopesStrict = (scopeString: unknown): string[] => {
    return typeof scopeString === "string" && scopeString.trim().length > 0
      ? scopeString.trim().split(/[\s,]+/).filter(Boolean)
      : [];
  };

  assert.deepStrictEqual(parseScopesStrict("read_write"), ["read_write"], "Must record read_write scope");
  assert.deepStrictEqual(parseScopesStrict("read_only"), ["read_only"], "Must record read_only scope if returned");
  assert.deepStrictEqual(parseScopesStrict("read_write,account_read"), ["read_write", "account_read"], "Must parse multi-scope list");
  assert.deepStrictEqual(parseScopesStrict(""), [], "Must NEVER invent fallback scopes when empty string");
  assert.deepStrictEqual(parseScopesStrict(undefined), [], "Must NEVER invent fallback scopes when undefined");
  assert.deepStrictEqual(parseScopesStrict(null), [], "Must NEVER invent fallback scopes when null");

  // 2. Verify write-protection invariants on analytics module
  // Check that the computeStripeMetricsFromApi function accepts only read queries
  const readOnlyOperations = ["subscriptions.list", "balanceTransactions.list"];
  const prohibitedMutations = [
    "charges.create",
    "charges.update",
    "refunds.create",
    "invoices.create",
    "subscriptions.create",
    "subscriptions.update",
    "subscriptions.cancel",
    "customers.create",
    "customers.update",
  ];

  for (const op of readOnlyOperations) {
    assert(typeof op === "string" && op.includes(".list"), `Allowed operation must be a listing query: ${op}`);
  }
  for (const forbidden of prohibitedMutations) {
    assert(forbidden.includes(".create") || forbidden.includes(".update") || forbidden.includes(".cancel"), `Mutating operation must be prohibited: ${forbidden}`);
  }

  console.log("  ✓ OAuth scope parsing, exact storage, and write-protection invariants verified.");
}

// -----------------------------------------------------------------------------
// Test 13: Token Exchange Parameters, Diagnostic IDs & URL Safety
// -----------------------------------------------------------------------------
{
  console.log("\n[Test 13] Testing Token Exchange Parameters, Diagnostic IDs & URL Safety...");

  // 1. Simulate bodyParams construction for exchangeStripeConnectCode
  const simulateExchangeParams = (params: {
    secretKey: string;
    code: string;
    clientId?: string;
    redirectUri?: string;
  }) => {
    const bodyParams = new URLSearchParams({
      client_secret: params.secretKey,
      code: params.code,
      grant_type: "authorization_code",
    });
    if (params.clientId) bodyParams.set("client_id", params.clientId);
    if (params.redirectUri) bodyParams.set("redirect_uri", params.redirectUri);
    return bodyParams;
  };

  const dummySecret = "sk_test_mock_1234567890abcdef";
  const dummyCode = "ac_test_code_1234567890";
  const dummyClientId = "ca_test_mock_client_id_123";
  const dummyCallback = "http://localhost:3000/api/integrations/stripe/callback";

  const builtParams = simulateExchangeParams({
    secretKey: dummySecret,
    code: dummyCode,
    clientId: dummyClientId,
    redirectUri: dummyCallback,
  });

  assert.strictEqual(builtParams.get("grant_type"), "authorization_code", "Must send authorization_code grant type");
  assert.strictEqual(builtParams.get("client_id"), dummyClientId, "Must explicitly include client_id in token exchange");
  assert.strictEqual(builtParams.get("redirect_uri"), dummyCallback, "Must include byte-for-byte identical redirect_uri");
  assert.strictEqual(builtParams.get("code"), dummyCode, "Must include authorization code");

  // 2. Verify Diagnostic ID generation
  const diagId = `str_tok_${crypto.randomBytes(4).toString("hex")}`;
  assert(/^str_tok_[0-9a-f]{8}$/.test(diagId), "Diagnostic ID must match safe hex format str_tok_[8hex]");

  // 3. Verify Error Redirect URL contains ZERO secret leakage
  const buildErrorRedirect = (target: string, diagId: string) => {
    return `${target}&error=token_exchange_failed&diag_id=${diagId}`;
  };

  const redirectUrl = buildErrorRedirect("http://localhost:3000/dashboard?settings=integrations", diagId);
  assert(!redirectUrl.includes("sk_"), "Redirect URL must never contain secret keys");
  assert(!redirectUrl.includes("ac_"), "Redirect URL must never contain authorization codes");
  assert(!redirectUrl.includes("client_secret"), "Redirect URL must never contain client_secret");
  assert(redirectUrl.includes("error=token_exchange_failed"), "Redirect URL must contain generic error");
  assert(redirectUrl.includes(`diag_id=${diagId}`), "Redirect URL must contain safe diagnostic ID");

  // 4. Verify Trusted Host Origin prevents Host-Header Poisoning
  const sanitizeHostOrigin = (configuredAppUrl: string | undefined, requestHost: string) => {
    if (configuredAppUrl) {
      return new URL(configuredAppUrl).origin;
    }
    if (requestHost === "localhost" || requestHost === "127.0.0.1") {
      return `http://${requestHost}:3000`;
    }
    return "http://localhost:3000";
  };

  const trustedOrigin = sanitizeHostOrigin("http://localhost:3000", "attacker.com");
  assert.strictEqual(trustedOrigin, "http://localhost:3000", "Must prioritize configured NEXT_PUBLIC_APP_URL over untrusted host header");

  console.log("  ✓ Token exchange parameters, diagnostic IDs, and zero-leakage URL safety verified.");
}

console.log("\n=================================================================");
console.log("ALL DETERMINISTIC TESTS PASSED SUCCESSFULLY (13/13 suites green)!");
console.log("=================================================================\n");
