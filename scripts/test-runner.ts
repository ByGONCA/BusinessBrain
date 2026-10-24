/**
 * Unified Test Suite Runner (TEST-01)
 *
 * Runs all deterministic offline test suites for BusinessBrain:
 * 1. Permissions & Discord-style Overrides (PGlite & Resolver)
 * 2. Rate Limiting Schema Alignment & Idempotence (Migration 00028)
 * 3. Stripe Connect OAuth, Anti-Replay & Analytics (13 Suites)
 * 4. Rate Limiting HMAC Cryptographic Security & Sliding Window
 * 5. Connections & Graph Deterministic Engine
 * 6. Graph BFS Shortest Path & Hierarchy Tree
 * 7. Pages Workspace & Autosave State Machine
 * 8. Graph BFS O(V + E) Scale Performance Benchmark
 */

import { exec } from "child_process";
import path from "path";

interface TestSuite {
  name: string;
  file: string;
  description: string;
}

const SUITES: TestSuite[] = [
  {
    name: "Permissions & RLS Engine",
    file: "scripts/test-permissions-system.ts",
    description: "46 tests: Owner bypass, Discord-style Deny precedence, RLS multi-tenant isolation",
  },
  {
    name: "Rate Limit Migration 00028",
    file: "scripts/test-migration-00028.ts",
    description: "16 tests: Idempotent DDL, non-permissive token backfill, anon rejection",
  },
  {
    name: "Stripe Connect & Analytics",
    file: "scripts/test-stripe-connect-analytics.ts",
    description: "13 suites: MRR normalization, currency isolation, 14d Dunning, anti-replay nonce",
  },
  {
    name: "Rate Limiting HMAC & Security",
    file: "scripts/test-rate-limiting.ts",
    description: "23 tests: HMAC tokens, tamper detection, fail-closed policy, sliding window",
  },
  {
    name: "Company Graph Engine",
    file: "scripts/test-company-graph-engine.ts",
    description: "9 tests: Structural edges, deterministic deduplication, spatial layout",
  },
  {
    name: "Connections System & Traversal",
    file: "scripts/test-connections-system.ts",
    description: "27 tests: Inverse relationship semantics, n-hop subgraphs, shortest path",
  },
  {
    name: "Pages Workspace & Autosave",
    file: "scripts/test-pages-workspace.ts",
    description: "13 tests: Deep block cloning, autosave state transitions, navigation",
  },
  {
    name: "Graph BFS O(V + E) Scale Benchmark",
    file: "scripts/test-graph-perf.ts",
    description: "Performance benchmark on 2,000 nodes & 3,384 edges (< 50ms requirement)",
  },
  {
    name: "Surgical Deduplication & Abort",
    file: "scripts/test-dedup-surgical.ts",
    description: "Gap preservation (v1, v3, v5), exact duplicate purge, and explicit abort on conflicting content",
  },
  {
    name: "Semantic Deduplication & Preflight",
    file: "scripts/test-dedup-semantic.ts",
    description: "Full semantic comparison (JSONB, author, org, timestamps) and pre-flight abort",
  },
  {
    name: "Transactional OCC & Snapshots",
    file: "scripts/test-concurrency-occ.ts",
    description: "Pessimistic row locking, OCC expected_updated_at validation, in-flight STALE_WRITE rejection",
  },
  {
    name: "Multilingual Search & Sanitization",
    file: "scripts/test-search-comprehensive.ts",
    description: "Multilingual transliteration (PT/ES/FR/DE), extreme input sanitization, and SQL injection safety",
  },
  {
    name: "100% Non-Destructive Migration Pre-Check",
    file: "scripts/test-dedup-nondestructive.ts",
    description: "Guarantees zero row deletions, aborts non-destructively on historical duplicates, preserves all versions",
  },
  {
    name: "Monotonic Revision-ID OCC Engine",
    file: "scripts/test-revision-occ.ts",
    description: "Clock-independent OCC revision counter, strict token requirement, in-flight rejection on restore",
  },
  {
    name: "Condition 4.1: Snippet OCC Integration",
    file: "scripts/test-snippet-occ.ts",
    description: "addCodeSnippetToPageAction respects OCC, rejects stale tokens, and prevents content clobbering",
  },
  {
    name: "Condition 4.2: Revision Integrity Trigger",
    file: "scripts/test-trigger-revision.ts",
    description: "auto_increment_page_revision invalidates stale tokens on content/title updates without double-incrementing",
  },
  {
    name: "Condition 4.3: Deterministic Lock Ordering",
    file: "scripts/test-reorder-deterministic.ts",
    description: "Multi-page updates sort by id ASC to eliminate lock-ordering deadlocks with bounded retry recovery",
  },
  {
    name: "Condition 4.4: Editor Conflict & Draft Preservation",
    file: "scripts/test-editor-conflict.ts",
    description: "Editor preserves in-memory draft upon STALE_WRITE and provides safe recovery options",
  },
  {
    name: "Storage Security & Granular RLS",
    file: "scripts/test-storage-security.ts",
    description: "17 tests: Direct SDK bypass prevention, granular RLS (files.view/upload/delete), MIME/SVG validation, traversal",
  },
  {
    name: "Phase 4 Integrations & Ecosystem Engine",
    file: "scripts/test-phase4-integrations-and-api.ts",
    description: "50 tests: Migration 00036, multi-tenant isolation, API keys, HMAC signatures, Confluence/Notion transpilers, deduplication",
  },
  {
    name: "Phase 4 Public API Deactivation Guard",
    file: "scripts/test-public-api-disabled.ts",
    description: "23 tests: Strict 404 blocking across all /api/v1/* routes, middleware fail-closed, feature flag isolation, UI removal",
  },
];

async function runSuite(suite: TestSuite): Promise<{ success: boolean; durationMs: number; output: string }> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const command = `npx tsx "${suite.file}"`;

    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      const durationMs = performance.now() - startTime;
      resolve({
        success: !error,
        durationMs,
        output: stdout + (stderr ? "\n" + stderr : ""),
      });
    });
  });
}

async function main() {
  console.log("==================================================================");
  console.log("BUSINESSBRAIN: UNIFIED COMPREHENSIVE TEST RUNNER (TEST-01)");
  console.log("==================================================================");
  console.log(`Discovered ${SUITES.length} deterministic test suites.\n`);

  let passedCount = 0;
  let failedCount = 0;
  const totalStartTime = performance.now();

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    process.stdout.write(`[${i + 1}/${SUITES.length}] Running ${suite.name} ... `);

    const result = await runSuite(suite);

    if (result.success) {
      passedCount++;
      console.log(`✅ PASSED (${(result.durationMs / 1000).toFixed(2)}s)`);
    } else {
      failedCount++;
      console.log(`❌ FAILED (${(result.durationMs / 1000).toFixed(2)}s)`);
      console.error("\n--- Output on Failure ---");
      console.error(result.output);
      console.error("-------------------------\n");
    }
  }

  const totalDuration = (performance.now() - totalStartTime) / 1000;

  console.log("\n==================================================================");
  console.log("TEST RUNNER SUMMARY");
  console.log("==================================================================");
  console.log(`Total Suites Executed : ${SUITES.length}`);
  console.log(`Passed Suites         : ${passedCount}`);
  console.log(`Failed Suites         : ${failedCount}`);
  console.log(`Total Execution Time  : ${totalDuration.toFixed(2)}s`);
  console.log("==================================================================");

  if (failedCount > 0) {
    console.error("❌ Some test suites failed. Exiting with code 1.");
    process.exit(1);
  } else {
    console.log("🎉 All test suites passed successfully with 100% compliance!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
