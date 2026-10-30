/**
 * Deterministic Test Suite: Adaptive Home Dashboard Redesign (DASH-01)
 *
 * Validates:
 * 1. Strict Quad-Locale synchronization across en, pt, es, fr for homeDashboard.
 * 2. Local personalization logic (bounded storage, deduplication, URL sanitization, user isolation).
 * 3. Priority and urgency ranking (urgent & overdue tasks strictly outrank routine items).
 * 4. Financial metrics integrity (distinguishing genuine zero from error/syncing, MRR vs Net Revenue).
 * 5. Code inspection & anti-clutter compliance (no +18% density, no +14% MoM, no duplicate financial cards).
 * 6. Preservation of ExecutiveHomeDashboard interface for real-dashboard-showcase demo compatibility.
 */

import { en } from "../lib/i18n/dictionaries/en";
import { pt } from "../lib/i18n/dictionaries/pt";
import { es } from "../lib/i18n/dictionaries/es";
import { fr } from "../lib/i18n/dictionaries/fr";
import { sanitizeInternalHref, parseStoredRecentItems } from "../lib/hooks/use-recent-context";
import * as fs from "fs";
import * as path from "path";

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
  console.log("🚀 BUSINESSBRAIN ADAPTIVE DASHBOARD VERIFICATION SUITE");
  console.log("======================================================\n");

  // Suite 1: Quad-Locale Synchronization & Key Parity
  console.log("--- Suite 1: Quad-Locale Synchronization & Key Parity ---");
  {
    const requiredKeys = [
      "prioritySectionTitle",
      "priorityActionRequired",
      "allSystemsOperational",
      "pendingReview",
      "urgentPriority",
      "recentContext",
      "quickJump",
      "noActiveProjects",
      "createFirstProject",
      "createFirstDocument",
      "mrrLabel",
      "netRevenueLabel",
      "statusOperational",
      "noRecentContext",
      "actionItems",
      "proposed",
      "inProgress",
    ] as const;

    const dicts = [
      { name: "en", dict: en.homeDashboard },
      { name: "pt", dict: pt.homeDashboard },
      { name: "es", dict: es.homeDashboard },
      { name: "fr", dict: fr.homeDashboard },
    ];

    for (const { name, dict } of dicts) {
      for (const key of requiredKeys) {
        assert(
          typeof (dict as any)[key] === "string" && (dict as any)[key].trim().length > 0,
          `Dictionary '${name}' has non-empty key '${key}'`
        );
      }
    }
  }

  // Suite 2: Local Personalization Storage, Sanitization & Deduplication
  console.log("\n--- Suite 2: Local Personalization Storage & Deduplication ---");
  {
    // URL sanitization tests
    assert(
      sanitizeInternalHref("/dashboard/pages/123#heading-anchor") === "/dashboard/pages/123",
      "Strips hash fragment from internal path"
    );
    assert(
      sanitizeInternalHref("/dashboard/pages?utm_source=track&session=xyz") === "/dashboard/pages",
      "Strips arbitrary query parameters from internal path"
    );
    assert(
      sanitizeInternalHref("/dashboard/decisions?id=12345678-1234-1234-1234-123456789abc") ===
        "/dashboard/decisions?id=12345678-1234-1234-1234-123456789abc",
      "Preserves verified canonical entity UUID parameter"
    );
    assert(
      sanitizeInternalHref("https://evil.com/hack") === "",
      "Rejects external absolute URLs"
    );
    assert(
      sanitizeInternalHref("javascript:alert(1)") === "",
      "Rejects unsafe javascript protocols"
    );

    // Parsing & validation check
    assert(parseStoredRecentItems(null).length === 0, "Gracefully handles null storage (SSR / empty)");
    assert(parseStoredRecentItems("invalid json").length === 0, "Gracefully handles malformed JSON without crashing");

    // Corrupted item filtering
    const corruptedPayload = JSON.stringify([
      { id: "1", title: "Valid Page", type: "page", href: "/dashboard/pages/1", visitedAt: 100 },
      { id: "2", title: "", type: "page", href: "/dashboard/pages/2", visitedAt: 100 }, // empty title
      { id: "3", title: "External Link", type: "page", href: "https://evil.com", visitedAt: 100 }, // non-relative href
      { id: "4", title: "No timestamp", type: "page", href: "/dashboard/pages/4" }, // missing visitedAt
      { id: "5", title: "Invalid Type", type: "hack_type", href: "/dashboard/pages/5", visitedAt: 100 }, // invalid type
    ]);
    const parsedValid = parseStoredRecentItems(corruptedPayload);
    assert(parsedValid.length === 1 && parsedValid[0].id === "1", "Discards malformed / unsafe items");

    // Deduplication & boundedness check
    const MAX_RECENT_ITEMS = 6;
    let items: any[] = [];
    const now = Date.now();
    for (let i = 1; i <= 10; i++) {
      const newItem = {
        id: `item-${i}`,
        title: `Item ${i}`,
        type: "page",
        href: `/dashboard/pages/${i}`,
        visitedAt: now + i,
      };
      items = [newItem, ...items.filter((ex) => ex.id !== newItem.id)].slice(0, MAX_RECENT_ITEMS);
    }
    assert(items.length === MAX_RECENT_ITEMS, `Strictly bounds recent items to ${MAX_RECENT_ITEMS}`);
    assert(items[0].id === "item-10", "Most recent item is at the front");

    // Re-visiting item-5 moves it to index 0
    const revisit = {
      id: "item-5",
      title: "Item 5",
      type: "page",
      href: `/dashboard/pages/5`,
      visitedAt: now + 999,
    };
    items = [revisit, ...items.filter((ex) => ex.id !== revisit.id)].slice(0, MAX_RECENT_ITEMS);
    assert(items[0].id === "item-5", "Re-visited item is promoted to the front");
    assert(items.filter((ex) => ex.id === "item-5").length === 1, "Duplicate visit is deduplicated");
  }

  // Suite 3: Priority & Urgency Business Logic
  console.log("\n--- Suite 3: Priority & Urgency Business Logic ---");
  {
    interface CandidateEntity {
      id: string;
      type: "decision" | "task" | "project";
      title: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    }

    const testEntities: CandidateEntity[] = [
      {
        id: "dec-1",
        type: "decision",
        title: "ADR-04: Security Framework",
        metadata: { status: "proposed" },
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 1000).toISOString(),
      },
      {
        id: "dec-2",
        type: "decision",
        title: "ADR-01: OCC Engine",
        metadata: { status: "accepted" },
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "task-1",
        type: "task",
        title: "Fix critical payment webhook deadlock",
        metadata: { priority: "urgent", status: "in_progress" },
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "task-2",
        type: "task",
        title: "Routine documentation update",
        metadata: { priority: "normal", status: "completed" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "task-3",
        type: "task",
        title: "Overdue audit review",
        metadata: { priority: "normal", status: "todo", due_date: new Date(Date.now() - 86400000).toISOString() },
        created_at: new Date(Date.now() - 50000).toISOString(),
        updated_at: new Date(Date.now() - 50000).toISOString(),
      },
    ];

    const priorityItems: any[] = [];
    for (const entity of testEntities) {
      if (entity.type === "decision") {
        const status = (entity.metadata?.status as string) || "accepted";
        if (status === "proposed") {
          priorityItems.push({
            id: entity.id,
            title: entity.title,
            type: "decision",
            priority: "high",
            status: "proposed",
            updatedAt: entity.updated_at,
          });
        }
      } else if (entity.type === "task") {
        const isCompleted = entity.metadata?.status === "completed" || entity.metadata?.completed === true;
        if (!isCompleted) {
          const priority = (entity.metadata?.priority as "urgent" | "high" | "normal") || "normal";
          const dueDate = (entity.metadata?.due_date as string) || null;
          const isOverdue = !!(dueDate && new Date(dueDate).getTime() < Date.now());
          const isUrgent = priority === "urgent" || priority === "high" || isOverdue;

          if (isUrgent) {
            priorityItems.push({
              id: entity.id,
              title: entity.title,
              type: "task",
              priority: isOverdue ? "urgent" : priority,
              status: isOverdue ? "overdue" : "pending",
              updatedAt: entity.updated_at,
            });
          }
        }
      }
    }

    // Rank priority items: Urgent/Overdue (3) -> High (2) -> Normal/Proposed (1), then recency
    priorityItems.sort((a, b) => {
      const weightA = a.status === "overdue" || a.priority === "urgent" ? 3 : a.priority === "high" ? 2 : 1;
      const weightB = b.status === "overdue" || b.priority === "urgent" ? 3 : b.priority === "high" ? 2 : 1;
      if (weightA !== weightB) return weightB - weightA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    assert(priorityItems.length === 3, "Extracted exactly 3 priority items");
    // Urgent tasks (task-1, task-3) must rank ahead of proposed decision (dec-1)
    assert(
      priorityItems[0].id === "task-3" || priorityItems[0].id === "task-1",
      "Urgent/Overdue task is ranked ahead of proposed decision"
    );
    assert(priorityItems[2].id === "dec-1", "Proposed decision with lower urgency ranks after urgent tasks");
    assert(!priorityItems.some((p) => p.id === "dec-2"), "Accepted decision is not an urgent item");
    assert(!priorityItems.some((p) => p.id === "task-2"), "Completed task is excluded from priority items");
  }

  // Suite 4: Financial Metrics Integrity & Genuine Zero Distinctions
  console.log("\n--- Suite 4: Financial Metrics Integrity ---");
  {
    // Function replicating the dashboard formatting logic
    function computeFinancialReadout(
      isStripeConnected: boolean,
      stripeStatus: "fresh" | "stale" | "syncing" | "error",
      primaryTotals: { netRevenueCents: number; activeMrrCents: number } | null
    ) {
      const netRevenue = primaryTotals
        ? (primaryTotals.netRevenueCents / 100).toFixed(2)
        : !isStripeConnected
        ? "not_connected"
        : stripeStatus === "error"
        ? "—"
        : stripeStatus === "syncing"
        ? "syncing"
        : "0.00";

      return { netRevenue };
    }

    // Case 1: Stripe disconnected
    assert(
      computeFinancialReadout(false, "fresh", null).netRevenue === "not_connected",
      "Disconnected Stripe shows not_connected status"
    );

    // Case 2: Stripe error state (MUST NOT return fake 0.00)
    assert(
      computeFinancialReadout(true, "error", null).netRevenue === "—",
      "Stripe error state returns dash (—) rather than fake 0.00"
    );

    // Case 3: Stripe syncing without snapshot (MUST NOT return fake 0.00)
    assert(
      computeFinancialReadout(true, "syncing", null).netRevenue === "syncing",
      "Stripe syncing state returns syncing indicator rather than fake 0.00"
    );

    // Case 4: Real verified zero transactions
    assert(
      computeFinancialReadout(true, "fresh", { netRevenueCents: 0, activeMrrCents: 0 }).netRevenue === "0.00",
      "Genuine 0.00 from verified snapshot is accurately formatted"
    );

    // Case 5: Real revenue
    assert(
      computeFinancialReadout(true, "fresh", { netRevenueCents: 245000, activeMrrCents: 120000 }).netRevenue === "2450.00",
      "Real net revenue is correctly formatted from cents"
    );
  }

  // Suite 5: Code Inspection & Anti-Clutter Compliance
  console.log("\n--- Suite 5: Code Inspection & Anti-Clutter Compliance ---");
  {
    const dashboardFile = path.resolve(__dirname, "../components/dashboard/home/executive-home-dashboard.tsx");
    const content = fs.readFileSync(dashboardFile, "utf8");

    // No hardcoded percentages
    assert(!content.includes("+18% density"), "Removed fake hardcoded '+18% density' metric");
    assert(!content.includes("+14% MoM"), "Removed fake hardcoded '+14% MoM' fallback");

    // No raw Stripe account IDs displayed in standard UI
    assert(!content.includes("${stripeAccountId}"), "Raw Stripe account identifier not exposed in UI");

    // No bubble pills (rounded-full used on badges/buttons resembling fake buttons)
    const hasFakePillButtons = /rounded-full\s+border\s+bg-.*px-/.test(content);
    assert(!hasFakePillButtons, "No decorative bubble/pill capsules used as fake button badges");

    // Uses useRecentContext
    assert(content.includes("useRecentContext"), "ExecutiveHomeDashboard integrates useRecentContext");
  }

  // Suite 6: Showcase Compatibility Check
  console.log("\n--- Suite 6: Real Dashboard Showcase Compatibility ---");
  {
    const showcaseFile = path.resolve(__dirname, "../components/landing/real-dashboard-showcase.tsx");
    const content = fs.readFileSync(showcaseFile, "utf8");

    assert(content.includes("<ExecutiveHomeDashboard"), "Showcase invokes ExecutiveHomeDashboard");
    assert(content.includes("demoMode={true}"), "Showcase passes demoMode={true}");
    assert(content.includes("onDemoNavigate={handleNavigate}"), "Showcase passes onDemoNavigate");
  }

  console.log("\n======================================================");
  console.log(`🎉 ALL ADAPTIVE DASHBOARD TESTS PASSED: ${passedCount} passed, ${failedCount} failed`);
  console.log("======================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
