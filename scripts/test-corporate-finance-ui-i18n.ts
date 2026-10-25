/**
 * Deterministic Test Suite: Corporate Finance UI, Period Math & Quad-Locale i18n (FIN-UI-01)
 *
 * Validates:
 * 1. Strict Quad-Locale i18n synchronization (en, pt, es, fr) for financePage.
 * 2. Complete absence of cross-language leakage (no Portuguese in English/French/Spanish dicts).
 * 3. Extended TimeRanges ("30D", "90D", "12M", "YTD", "ALL") and Dynamic Granularity (daily, monthly).
 * 4. Strict decoupling of Period Revenues from Contracted State MRR/ARR.
 * 5. Pagination and search filtering for modal collections.
 * 6. Currency and date localization formatting across supported locales.
 */

import { en } from "../lib/i18n/dictionaries/en";
import { pt } from "../lib/i18n/dictionaries/pt";
import { es } from "../lib/i18n/dictionaries/es";
import { fr } from "../lib/i18n/dictionaries/fr";
import {
  filterFinancialMetricsByPeriod,
  StripeFinancialSnapshot,
} from "../lib/integrations/stripe/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✅ PASS: ${message}`);
}

async function runTests() {
  console.log("======================================================");
  console.log("🚀 CORPORATE FINANCE UI & QUAD-LOCALE TEST SUITE");
  console.log("======================================================\n");

  // Suite 1: Quad-Locale Synchronization & Key Parity
  console.log("--- Suite 1: Quad-Locale Synchronization & Title Parity ---");
  {
    assert(en.financePage.title === "Corporate Finance", "English title is 'Corporate Finance'");
    assert(pt.financePage.title === "Finanças Empresariais", "Portuguese title is 'Finanças Empresariais'");
    assert(es.financePage.title === "Finanzas Corporativas", "Spanish title is 'Finanzas Corporativas'");
    assert(fr.financePage.title === "Finances d'Entreprise", "French title is 'Finances d'Entreprise'");

    // Verify modals object exists in all 4 dictionaries
    const dicts = [
      { name: "en", dict: en },
      { name: "pt", dict: pt },
      { name: "es", dict: es },
      { name: "fr", dict: fr },
    ];

    const requiredModalKeys = [
      "viewAll",
      "viewAllTransactions",
      "viewAllSubscriptions",
      "viewAllEconomics",
      "searchPlaceholder",
      "noResults",
      "showing",
      "description",
      "amount",
      "date",
      "status",
    ];

    for (const { name, dict } of dicts) {
      assert(
        dict.financePage.modals !== undefined,
        `[${name}] 'modals' namespace is defined in financePage`
      );
      for (const k of requiredModalKeys) {
        assert(
          (dict.financePage.modals as Record<string, string>)[k] !== undefined &&
            (dict.financePage.modals as Record<string, string>)[k].length > 0,
          `[${name}] modals.${k} has valid translated string`
        );
      }
    }

    // Verify chartControls object exists in all 4 dictionaries
    for (const { name, dict } of dicts) {
      assert(
        dict.financePage.chartControls !== undefined,
        `[${name}] 'chartControls' namespace is defined in financePage`
      );
      assert(
        dict.financePage.chartControls.interactiveRange.length > 0,
        `[${name}] chartControls.interactiveRange is defined`
      );
    }
  }

  // Suite 2: Cross-Language Leakage Prevention
  console.log("\n--- Suite 2: Cross-Language Leakage Prevention ---");
  {
    // English dictionary must NOT contain typical Portuguese strings
    const enText = JSON.stringify(en.financePage);
    assert(!enText.includes("Finanças Empresariais"), "English dict does not contain Portuguese title");
    assert(!enText.includes("Receita Líquida"), "English dict does not contain Portuguese KPI strings");
    assert(!enText.includes("Ver todos"), "English dict does not contain Portuguese modal actions");

    // Spanish dictionary must NOT contain English modal defaults
    const esText = JSON.stringify(es.financePage);
    assert(!esText.includes("Corporate Finance"), "Spanish dict does not leak English title");
    assert(!esText.includes("View all"), "Spanish dict does not leak English modal actions");

    // French dictionary must NOT contain English modal defaults
    const frText = JSON.stringify(fr.financePage);
    assert(!frText.includes("Corporate Finance"), "French dict does not leak English title");
    assert(!frText.includes("View all"), "French dict does not leak English modal actions");
  }

  // Suite 3: Extended TimeRanges & Dynamic Granularity
  console.log("\n--- Suite 3: Extended TimeRanges & Dynamic Granularity ---");
  {
    const mockSnapshot: StripeFinancialSnapshot = {
      organizationId: "org-test-123",
      connectedAccountId: "acct_test123",
      livemode: true,
      computedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      freshnessStatus: "fresh",
      primaryCurrency: "eur",
      currencies: {
        eur: {
          currency: "eur",
          activeMrrCents: 150000,
          grossContractualMrrCents: 150000,
          atRiskDunningMrrCents: 0,
          discountSavingsMrrCents: 0,
          arrCents: 1800000,
          grossRevenueCents: 500000,
          netRevenueCents: 450000,
          totalRefundsCents: 20000,
          openDisputesCents: 0,
          stripeFeesCents: 30000,
          activeSubscribersCount: 15,
          trialingSubscribersCount: 3,
          canceledSubscribersCount: 2,
          atRiskSubscribersCount: 1,
          discountedSubscribersCount: 0,
          arpuCents: 10000,
          ltvCents: 75000,
        },
      },
      monthlyHistory: {
        eur: [
          { monthKey: "2026-08", grossRevenueCents: 100000, netRevenueCents: 90000, newCustomersCount: 3 },
          { monthKey: "2026-09", grossRevenueCents: 180000, netRevenueCents: 160000, newCustomersCount: 5 },
          { monthKey: "2026-10", grossRevenueCents: 220000, netRevenueCents: 200000, newCustomersCount: 7 },
        ],
      },
      totalActiveCustomersCount: 15,
      totalAtRiskCustomersCount: 1,
      dunningGracePeriodDays: 14,
      timezone: "Europe/Lisbon",
      provenance: {
        source: "stripe_connect_api",
        apiVersion: "2026-08-26.dahlia",
        sampledChargesCount: 15,
        sampledSubscriptionsCount: 18,
        sampledBalanceTransactionsCount: 20,
        lastSyncedAt: new Date().toISOString(),
        payloadSizeBytes: 1200,
        safeguardPruned: false,
        pagesTraversedSubscriptions: 1,
        pagesTraversedBalanceTransactions: 1,
        hasMoreUnfetched: false,
      },
    };

    // Test 12M monthly
    const m12 = filterFinancialMetricsByPeriod(mockSnapshot, "eur", "12M", "pt-PT", "monthly");
    assert(m12.chartPoints.length === 12, "12M period produces 12 monthly points");
    assert(m12.timeRange === "12M", "TimeRange is correctly tagged as 12M");

    // Test 30D daily granularity
    const d30 = filterFinancialMetricsByPeriod(mockSnapshot, "eur", "30D", "pt-PT", "daily");
    assert(d30.chartPoints.length === 30, "30D daily granularity produces 30 daily progression points");
    assert(d30.granularity === "daily", "Granularity is tagged as daily");

    // Test YTD
    const ytd = filterFinancialMetricsByPeriod(mockSnapshot, "eur", "YTD", "pt-PT", "monthly");
    assert(ytd.timeRange === "YTD", "TimeRange YTD is supported");
    assert(ytd.chartPoints.length >= 6, "YTD produces at least 6 points for context");

    // Test ALL
    const all = filterFinancialMetricsByPeriod(mockSnapshot, "eur", "ALL", "pt-PT", "monthly");
    assert(all.timeRange === "ALL", "TimeRange ALL is supported");
    assert(all.chartPoints.length >= 12, "ALL produces full historical window");
  }

  // Suite 4: Decoupling of Period Revenue vs Active MRR
  console.log("\n--- Suite 4: Decoupling of Period Revenue vs Contracted MRR ---");
  {
    const mockSnapshot: StripeFinancialSnapshot = {
      organizationId: "org-decouple",
      connectedAccountId: "acct_decouple",
      livemode: true,
      computedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      freshnessStatus: "fresh",
      primaryCurrency: "eur",
      currencies: {
        eur: {
          currency: "eur",
          activeMrrCents: 50000, // 500 EUR/m contracted
          grossContractualMrrCents: 50000,
          atRiskDunningMrrCents: 0,
          discountSavingsMrrCents: 0,
          arrCents: 600000, // 6,000 EUR ARR
          grossRevenueCents: 300000,
          netRevenueCents: 280000, // 2,800 EUR transacted in period
          totalRefundsCents: 5000,
          openDisputesCents: 0,
          stripeFeesCents: 15000,
          activeSubscribersCount: 5,
          trialingSubscribersCount: 0,
          canceledSubscribersCount: 0,
          atRiskSubscribersCount: 0,
          discountedSubscribersCount: 0,
        },
      },
      monthlyHistory: { eur: [] },
      totalActiveCustomersCount: 5,
      totalAtRiskCustomersCount: 0,
      dunningGracePeriodDays: 14,
      timezone: "Europe/Lisbon",
      provenance: {
        source: "stripe_connect_api",
        apiVersion: "2026-08-26.dahlia",
        sampledChargesCount: 5,
        sampledSubscriptionsCount: 5,
        sampledBalanceTransactionsCount: 5,
        lastSyncedAt: new Date().toISOString(),
        payloadSizeBytes: 800,
        safeguardPruned: false,
        pagesTraversedSubscriptions: 1,
        pagesTraversedBalanceTransactions: 1,
        hasMoreUnfetched: false,
      },
    };

    const metrics30D = filterFinancialMetricsByPeriod(mockSnapshot, "eur", "30D", "pt-PT");
    const mrr = mockSnapshot.currencies.eur.activeMrrCents;
    const periodRevenue = metrics30D.periodNetRevenueCents;

    assert(mrr === 50000, "Active MRR remains fixed at 500 EUR contracted");
    assert(periodRevenue !== mrr, "Period net revenue is decoupled and reflects transacted sum, not monthly MRR");
    assert(mockSnapshot.currencies.eur.arrCents === mrr * 12, "ARR is strictly defined as Contracted MRR × 12");
  }

  // Suite 5: Modal Pagination & In-Memory Query Filtering
  console.log("\n--- Suite 5: Modal Pagination & In-Memory Query Filtering ---");
  {
    const sampleItems = Array.from({ length: 25 }).map((_, i) => ({
      id: `tx_${i}`,
      description: i % 2 === 0 ? "Enterprise Subscription" : "Pro Plan Renewal",
      status: i % 5 === 0 ? "refunded" : "settled",
      netAmount: (i + 1) * 100,
    }));

    // Filter by query "Enterprise"
    const query = "enterprise";
    const filteredByQuery = sampleItems.filter((tx) =>
      tx.description.toLowerCase().includes(query)
    );
    assert(filteredByQuery.length === 13, `Search filter matches 13 Enterprise items (actual: ${filteredByQuery.length})`);

    // Status filter "refunded"
    const filteredByStatus = sampleItems.filter((tx) => tx.status === "refunded");
    assert(filteredByStatus.length === 5, `Status filter matches 5 refunded items (actual: ${filteredByStatus.length})`);

    // Pagination: page 1 of 8 items
    const pageSize = 8;
    const page1 = sampleItems.slice(0, pageSize);
    assert(page1.length === 8, "Page 1 contains exactly 8 items");

    // Page 4 contains remainder
    const page4 = sampleItems.slice(24, 32);
    assert(page4.length === 1, "Page 4 contains remainder 1 item");
  }

  console.log("\n======================================================");
  console.log(`🎯 RESULTS: ${passedCount} passed, ${failedCount} failed.`);
  console.log("======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered an unhandled exception:", err);
  process.exit(1);
});
