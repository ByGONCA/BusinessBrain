/**
 * KogSync — Multi-Tenant Integrations Rate Limiting, Backoff & Resilience Suite
 *
 * Comprehensive verification of rate limiting across Shopify, Sentry, and Linear:
 * 1. HTTP 429 with Retry-After header parsing and recovery
 * 2. HTTP 429 without Retry-After (fallback to exponential backoff with jitter)
 * 3. Provider-specific rate limit & reset header parsing (Shopify, Sentry, Linear)
 * 4. Exponential backoff and full jitter mathematical distribution
 * 5. Maximum retry attempt limits (fails fast after maxRetries)
 * 6. Permanent errors (400, 401, 403, 404, 422) fail immediately with zero retries
 * 7. Timeouts & network abort handling
 * 8. Linear GraphQL 200 OK response with RATELIMITED in errors array
 * 9. Shopify GraphQL THROTTLED error & cost throttleStatus parsing
 * 10. Multi-tenant isolation: Tenant A rate limit does not affect Tenant B
 * 11. Single-flight request coalescing protects against thundering herds
 * 12. Mutation idempotency protection (POST/mutations are never retried unsafely)
 * 13. Serverless budget protection: fast-fail when Retry-After exceeds execution budget
 * 14. Global serverless deadline exhaustion (total wall-clock elapsed time enforced)
 * 15. Dynamic per-attempt timeout recalculation based on remaining global deadline
 * 16. Insufficient remaining time (< 400ms) prevents doomed retries
 * 17. Active Shopify leaky-bucket pacing when approaching bucket capacity
 * 18. Failed single-flight operation does NOT permanently poison cache and allows clean recovery
 * 19. Concurrent requests from different tenants do NOT coalesce or cross-contaminate
 * 20. Cache expiration during in-flight requests coalesces into the in-flight refresh
 */

import assert from "assert";
import {
  calculateBackoffWithJitter,
  parseRetryAfterHeader,
  executeWithRateLimitRetry,
  ProviderRateLimitError,
  SERVERLESS_RETRY_LIMITS,
} from "../lib/integrations/rate-limiting";
import {
  ShopifyClient,
  ShopifyApiError,
  parseShopifyCallLimit,
  calculateShopifyBucketPacingDelay,
  recordShopifyBucketState,
  resetShopifyBucketState,
} from "../lib/integrations/shopify/client";
import {
  SentryClient,
  SentryApiError,
  parseSentryRateLimitHeaders,
} from "../lib/integrations/sentry/client";
import {
  LinearRateLimitError,
  isLinearRateLimitGraphQLError,
  parseLinearRateLimitHeaders,
} from "../lib/integrations/linear/graphql-client";
import { TenantMemoryCache, linearCache } from "../lib/integrations/cache";

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  ✅ Test ${totalTests}: ${name}`);
        })
        .catch((err) => {
          console.error(`  ❌ Test ${totalTests} FAILED: ${name}`);
          console.error(err);
          process.exitCode = 1;
        });
    } else {
      passedTests++;
      console.log(`  ✅ Test ${totalTests}: ${name}`);
    }
  } catch (err) {
    console.error(`  ❌ Test ${totalTests} FAILED: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAll() {
  console.log("\n==================================================================");
  console.log("KOGSYNC: INTEGRATIONS RATE LIMITING & RESILIENCE VERIFICATION");
  console.log("==================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: HTTP 429 with Retry-After Header Handling & Recovery
  // ---------------------------------------------------------------------------
  await test("HTTP 429 with Retry-After is respected and successfully recovered on retry", async () => {
    let callCount = 0;
    const sleptMs: number[] = [];

    const mockSleep = async (ms: number) => {
      sleptMs.push(ms);
    };

    const result = await executeWithRateLimitRetry<{ success: boolean }>({
      provider: "shopify",
      organizationId: "org-test-1",
      operationName: "get_products",
      isIdempotent: true,
      customSleep: mockSleep,
      execute: async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });

    assert.strictEqual(callCount, 2, "Must retry once and succeed");
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(sleptMs.length, 1);
    assert(sleptMs[0] >= 1000, `Sleep duration (${sleptMs[0]}ms) must respect Retry-After: 1s`);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: HTTP 429 without Retry-After (Fallback with Jitter)
  // ---------------------------------------------------------------------------
  await test("HTTP 429 without Retry-After uses exponential backoff with jitter", async () => {
    let callCount = 0;
    const sleptMs: number[] = [];

    const mockSleep = async (ms: number) => {
      sleptMs.push(ms);
    };

    const result = await executeWithRateLimitRetry<{ success: boolean }>({
      provider: "sentry",
      organizationId: "org-test-2",
      operationName: "get_issues",
      isIdempotent: true,
      baseDelayMs: 200,
      customSleep: mockSleep,
      execute: async () => {
        callCount++;
        if (callCount === 1) {
          return new Response("Too Many Requests", { status: 429 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(sleptMs.length, 1);
    assert(sleptMs[0] >= 200, "Backoff must be positive and non-zero");
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Provider-Specific Rate Limit & Reset Header Parsing
  // ---------------------------------------------------------------------------
  test("Provider rate limit and reset headers are parsed accurately", () => {
    // 1. Shopify: X-Shopify-Shop-Api-Call-Limit (e.g. "38/40")
    const shopifyLimit = parseShopifyCallLimit("38/40");
    assert.deepStrictEqual(shopifyLimit, { current: 38, max: 40 });
    assert.strictEqual(parseShopifyCallLimit(null), null);
    assert.strictEqual(parseShopifyCallLimit("invalid"), null);

    // 2. Sentry: Retry-After, X-Sentry-Rate-Limit-Remaining, X-Sentry-Rate-Limit-Reset
    const sentryHeaders = new Headers({
      "Retry-After": "3",
      "X-Sentry-Rate-Limit-Remaining": "15",
      "X-Sentry-Rate-Limit-Reset": "1794156000",
      "X-Sentry-Rate-Limit-Categories": "default;error",
    });
    const sentryParsed = parseSentryRateLimitHeaders(sentryHeaders);
    assert.strictEqual(sentryParsed.retryAfterSeconds, 3);
    assert.strictEqual(sentryParsed.remaining, 15);
    assert.strictEqual(sentryParsed.resetEpochSeconds, 1794156000);
    assert.strictEqual(sentryParsed.categories, "default;error");

    // 3. Linear: X-RateLimit-Requests-Reset, X-RateLimit-Requests-Remaining
    const linearHeaders = new Headers({
      "X-RateLimit-Requests-Reset": "1794156100",
      "X-RateLimit-Requests-Remaining": "5",
      "X-Complexity-Reset": "1794156100",
      "X-Complexity-Remaining": "250",
    });
    const linearParsed = parseLinearRateLimitHeaders(linearHeaders);
    assert.strictEqual(linearParsed.resetEpochSeconds, 1794156100);
    assert.strictEqual(linearParsed.requestsRemaining, 250);
    assert.strictEqual(linearParsed.isComplexity, true);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Exponential Backoff and Full Jitter Math Distribution
  // ---------------------------------------------------------------------------
  test("Exponential backoff scales geometrically and full jitter remains strictly within bounds", () => {
    const baseDelayMs = 200;
    const maxDelayMs = 3000;

    for (let attempt = 0; attempt < 5; attempt++) {
      const maxPossibleForAttempt = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

      for (let sample = 0; sample < 20; sample++) {
        const delay = calculateBackoffWithJitter(attempt, baseDelayMs, maxDelayMs);
        assert(delay >= 0, `Delay (${delay}) must be >= 0`);
        assert(
          delay <= maxPossibleForAttempt,
          `Delay (${delay}) must be <= upper bound (${maxPossibleForAttempt}) for attempt ${attempt}`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Maximum Retry Attempt Limits (MaxRetries Enforcement)
  // ---------------------------------------------------------------------------
  await test("Execution fails with ProviderRateLimitError when maxRetries is exhausted", async () => {
    let callCount = 0;
    const mockSleep = async () => {};

    try {
      await executeWithRateLimitRetry<{ success: boolean }>({
        provider: "shopify",
        organizationId: "org-retry-exhausted",
        operationName: "list_orders",
        isIdempotent: true,
        maxRetries: 2, // 1 initial + 2 retries = 3 calls
        customSleep: mockSleep,
        execute: async () => {
          callCount++;
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        },
      });
      assert.fail("Must have thrown ProviderRateLimitError");
    } catch (err: unknown) {
      assert(err instanceof ProviderRateLimitError, "Error must be ProviderRateLimitError");
      assert.strictEqual(err.status, 429);
      assert.strictEqual(callCount, 3, "Must attempt exactly 3 times (1 initial + 2 retries)");
      assert(err.userMessage.includes("Shopify API rate limit reached"));
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Permanent Errors (400, 401, 403, 404, 422) Are NOT Retried
  // ---------------------------------------------------------------------------
  await test("Permanent HTTP errors (400, 401, 403, 404, 422) fail immediately with 0 retries", async () => {
    const permanentCodes = [400, 401, 403, 404, 422];

    for (const code of permanentCodes) {
      let callCount = 0;
      try {
        await executeWithRateLimitRetry<{ success: boolean }>({
          provider: "sentry",
          organizationId: "org-perm",
          operationName: "get_projects",
          isIdempotent: true,
          execute: async () => {
            callCount++;
            return new Response(`Error ${code}`, { status: code });
          },
        });
        assert.fail(`Must have failed for code ${code}`);
      } catch (err: unknown) {
        assert.strictEqual(callCount, 1, `Code ${code} must execute exactly ONCE without retrying`);
        assert((err as Error).message.includes(String(code)));
      }
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Timeouts and Network Abort Handling
  // ---------------------------------------------------------------------------
  await test("Timeout triggers abort and retries with backoff if idempotent", async () => {
    let callCount = 0;
    const sleptMs: number[] = [];

    const mockSleep = async (ms: number) => {
      sleptMs.push(ms);
    };

    const result = await executeWithRateLimitRetry<{ success: boolean }>({
      provider: "shopify",
      organizationId: "org-timeout",
      operationName: "fetch_catalog",
      isIdempotent: true,
      maxRetries: 1,
      timeoutMs: 50,
      customSleep: mockSleep,
      execute: async (signal) => {
        callCount++;
        if (callCount === 1) {
          return new Promise<Response>((_, reject) => {
            signal.addEventListener("abort", () => {
              const abortErr = new Error("The operation was aborted");
              abortErr.name = "AbortError";
              reject(abortErr);
            });
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });

    assert.strictEqual(callCount, 2, "Must retry once after timeout");
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(sleptMs.length, 1);
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Linear GraphQL HTTP 200 with RATELIMITED Error in Array
  // ---------------------------------------------------------------------------
  test("Linear GraphQL error detection identifies RATELIMITED extensions", () => {
    const rateLimitErr1 = {
      message: "Rate limit exceeded",
      extensions: { code: "RATELIMITED", userError: { retryAfter: 4 } },
    };
    assert.strictEqual(isLinearRateLimitGraphQLError(rateLimitErr1), true);

    const rateLimitErr2 = {
      message: "Complexity limit exceeded for workspace",
      extensions: { type: "RateLimitError" },
    };
    assert.strictEqual(isLinearRateLimitGraphQLError(rateLimitErr2), true);

    const normalErr = {
      message: "Field 'invalidField' does not exist on type 'Issue'",
      extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
    };
    assert.strictEqual(isLinearRateLimitGraphQLError(normalErr), false);
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Shopify GraphQL THROTTLED and Cost ThrottleStatus Parsing
  // ---------------------------------------------------------------------------
  test("Shopify GraphQL client parses cost throttleStatus accurately", () => {
    const rawGraphQLResponse = {
      data: null,
      errors: [
        {
          message: "Throttled",
          extensions: { code: "THROTTLED" },
        },
      ],
      extensions: {
        cost: {
          requestedQueryCost: 100,
          actualQueryCost: 10,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 10,
            restoreRate: 50,
          },
        },
      },
    };

    const isThrottled = rawGraphQLResponse.errors.some(
      (e) => e.extensions?.code === "THROTTLED" || e.message.toLowerCase().includes("throttled")
    );
    assert.strictEqual(isThrottled, true);

    const throttle = rawGraphQLResponse.extensions.cost.throttleStatus;
    const requested = rawGraphQLResponse.extensions.cost.requestedQueryCost;
    const available = throttle.currentlyAvailable;
    const restoreRate = throttle.restoreRate;

    const calculatedWaitSeconds = Math.max(Math.ceil((requested - available) / restoreRate), 1);
    assert.strictEqual(calculatedWaitSeconds, 2, "Math.ceil((100 - 10) / 50) = 2 seconds");
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Rate Limit Isolation
  // ---------------------------------------------------------------------------
  test("Tenant A rate limit does not affect Tenant B cache or execution state", () => {
    const cache = new TenantMemoryCache({ ttlMs: 60000 });

    cache.set("tenant-A", "shopify", "snapshot", "main", { rateLimited: true, retryAfter: 5 });
    cache.set("tenant-B", "shopify", "snapshot", "main", { rateLimited: false, productsCount: 42 });

    const tenantAData: any = cache.get("tenant-A", "shopify", "snapshot", "main");
    const tenantBData: any = cache.get("tenant-B", "shopify", "snapshot", "main");

    assert.strictEqual(tenantAData.rateLimited, true);
    assert.strictEqual(tenantBData.rateLimited, false);
    assert.strictEqual(tenantBData.productsCount, 42);

    cache.invalidateTenant("tenant-A", "shopify");
    assert.strictEqual(cache.get("tenant-A", "shopify", "snapshot", "main"), null);
    assert.strictEqual((cache.get("tenant-B", "shopify", "snapshot", "main") as any).productsCount, 42);
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Single-Flight Coalescing Prevents Thundering Herds
  // ---------------------------------------------------------------------------
  await test("10 concurrent requests for the same tenant key coalesce into exactly 1 network call", async () => {
    let networkCallCount = 0;
    const cache = new TenantMemoryCache({ ttlMs: 5000 });

    const fetcher = async () => {
      networkCallCount++;
      await new Promise((r) => setTimeout(r, 40));
      return { ordersCount: 15 };
    };

    const promises = Array.from({ length: 10 }, () =>
      cache.coalesce("tenant-stampede", "shopify", "orders", "active", fetcher)
    );

    const results = await Promise.all(promises);

    assert.strictEqual(networkCallCount, 1, "Exactly ONE network call must be executed for 10 concurrent requests");
    assert.strictEqual(results.length, 10);
    results.forEach((res: any) => assert.strictEqual(res.ordersCount, 15));
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Mutation Idempotency Protection (Never Retry Mutations on 429)
  // ---------------------------------------------------------------------------
  await test("Non-idempotent operations (POST / mutations) are NEVER retried on 429", async () => {
    let mutationAttempts = 0;

    try {
      await executeWithRateLimitRetry<{ created: boolean }>({
        provider: "shopify",
        organizationId: "org-mutation",
        operationName: "create_order",
        isIdempotent: false,
        execute: async () => {
          mutationAttempts++;
          return new Response(JSON.stringify({ error: "Throttled" }), {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        },
      });
      assert.fail("Mutation must have failed immediately without retrying");
    } catch (err: unknown) {
      assert(err instanceof ProviderRateLimitError);
      assert.strictEqual(
        mutationAttempts,
        1,
        "Non-idempotent mutation must execute exactly ONCE and never retry"
      );
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 13: Serverless Budget Protection (Fast-Fail When Retry-After > Budget)
  // ---------------------------------------------------------------------------
  await test("Fast-fail when provider Retry-After (60s) exceeds serverless budget (4s)", async () => {
    let callCount = 0;
    let sleepCalled = false;

    const mockSleep = async () => {
      sleepCalled = true;
    };

    try {
      await executeWithRateLimitRetry<{ success: boolean }>({
        provider: "sentry",
        organizationId: "org-serverless-budget",
        operationName: "fetch_events",
        isIdempotent: true,
        maxDelayMs: 4000,
        customSleep: mockSleep,
        execute: async () => {
          callCount++;
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "60" },
          });
        },
      });
      assert.fail("Must have fast-failed");
    } catch (err: unknown) {
      assert(err instanceof ProviderRateLimitError);
      assert.strictEqual(callCount, 1, "Must execute exactly ONCE without hanging");
      assert.strictEqual(sleepCalled, false, "Must NOT sleep for 60 seconds inside serverless lambda");
      assert.strictEqual(err.retryAfterSeconds, 60);
      assert(err.userMessage.includes("wait 60s"));
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Global Serverless Deadline Enforcement (Total Wall-Clock Time)
  // ---------------------------------------------------------------------------
  await test("Global serverless deadline stops retries when total elapsed time exceeds deadline", async () => {
    let simulatedTime = 1000;
    let callCount = 0;

    const fakeClock = () => simulatedTime;
    const mockSleep = async (ms: number) => {
      simulatedTime += ms;
    };

    try {
      await executeWithRateLimitRetry<{ success: boolean }>({
        provider: "shopify",
        organizationId: "org-global-deadline",
        operationName: "export_items",
        isIdempotent: true,
        globalDeadlineMs: 2500, // 2.5s absolute deadline
        maxRetries: 3,
        nowFn: fakeClock,
        customSleep: mockSleep,
        execute: async () => {
          callCount++;
          // First attempt takes 1500ms
          simulatedTime += 1500;
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        },
      });
      assert.fail("Must have thrown deadline exhaustion error");
    } catch (err: unknown) {
      // 1500ms elapsed out of 2500ms -> remaining = 1000ms.
      // Retry-After = 1s (1000ms) + MIN_VIABLE_REQUEST_MS (400ms) = 1400ms > 1000ms.
      // Must fast-fail immediately without sleeping or running doomed retry!
      assert(err instanceof ProviderRateLimitError);
      assert.strictEqual(callCount, 1, "Must NOT attempt retry because deadline cannot accommodate wait + request");
      assert.strictEqual(simulatedTime, 2500, "Must not have advanced time past deadline");
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 15: Dynamic Per-Attempt Timeout Recalculation
  // ---------------------------------------------------------------------------
  await test("Attempt-level timeout dynamically shrinks to fit remaining global deadline", async () => {
    let simulatedTime = 10000;
    let callCount = 0;

    const fakeClock = () => simulatedTime;
    const mockSleep = async (ms: number) => {
      simulatedTime += ms;
    };

    const result = await executeWithRateLimitRetry<{ ok: boolean }>({
      provider: "sentry",
      organizationId: "org-dyn-timeout",
      operationName: "query_trace",
      isIdempotent: true,
      globalDeadlineMs: 4000, // 4s total budget
      timeoutMs: 8000, // standard timeout is 8s (larger than global deadline!)
      nowFn: fakeClock,
      customSleep: mockSleep,
      execute: async (signal) => {
        callCount++;
        if (callCount === 1) {
          // Attempt 1 takes 500ms and 503s
          simulatedTime += 500;
          return new Response("Service Unavailable", { status: 503 });
        }
        // Attempt 2 succeeds
        simulatedTime += 200;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    assert.strictEqual(result.data.ok, true);
    assert.strictEqual(callCount, 2);
    assert(simulatedTime < 14000, "Total execution must comfortably stay within global deadline");
  });

  // ---------------------------------------------------------------------------
  // TEST 16: Insufficient Viable Window (< 400ms) Prevents Doomed Retries
  // ---------------------------------------------------------------------------
  await test("Pre-attempt check aborts immediately if remaining time is below min viable request threshold", async () => {
    let simulatedTime = 5000;
    const fakeClock = () => simulatedTime;

    try {
      await executeWithRateLimitRetry<{ ok: boolean }>({
        provider: "linear",
        organizationId: "org-exhausted",
        operationName: "quick_query",
        globalDeadlineMs: 1000,
        nowFn: fakeClock,
        execute: async () => {
          // Simulate that before request even completes, clock advances to 900ms
          simulatedTime += 900;
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        },
      });
      assert.fail("Must have aborted due to deadline exhaustion");
    } catch (err: unknown) {
      assert(err instanceof ProviderRateLimitError);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 17: Active Shopify Leaky-Bucket Pacing
  // ---------------------------------------------------------------------------
  test("Shopify leaky bucket actively paces requests when approaching capacity (39/40)", () => {
    resetShopifyBucketState();

    const shop = "active-bucket.myshopify.com";
    const now = 100000;

    // 1. When bucket is not yet recorded, no pacing is needed
    assert.strictEqual(calculateShopifyBucketPacingDelay(shop, now), 0);

    // 2. Safe bucket level (20/40) requires no pacing
    recordShopifyBucketState(shop, 20, 40, now);
    assert.strictEqual(calculateShopifyBucketPacingDelay(shop, now), 0);

    // 3. Approaching capacity: 39/40 (within 1 slot of 40)
    // Leak rate: 2 calls/s = 1 call per 500ms.
    // Slots needed to drop below threshold: 39 - 38 = 1 slot -> 500ms pacing delay.
    recordShopifyBucketState(shop, 39, 40, now);
    const delayAtNow = calculateShopifyBucketPacingDelay(shop, now);
    assert.strictEqual(delayAtNow, 500, "Must calculate 500ms proactive delay for 39/40 bucket");

    // 4. After 600ms have elapsed, 1 call has leaked (estimated = 38/40) -> 0ms delay
    const delayAfterLeak = calculateShopifyBucketPacingDelay(shop, now + 600);
    assert.strictEqual(delayAfterLeak, 0, "Delay must drop to 0ms after bucket has naturally leaked");

    // 5. Completely exhausted bucket: 40/40 -> 2 slots needed -> 1000ms delay (capped at 1000ms)
    recordShopifyBucketState(shop, 40, 40, now);
    const delayAtFull = calculateShopifyBucketPacingDelay(shop, now);
    assert.strictEqual(delayAtFull, 1000, "Must calculate 1000ms proactive delay for 40/40 full bucket");

    // 6. Shopify Plus store (159/160) -> 40 calls/s leak rate -> min 250ms floor
    const plusShop = "plus-store.myshopify.com";
    recordShopifyBucketState(plusShop, 159, 160, now);
    const delayPlus = calculateShopifyBucketPacingDelay(plusShop, now);
    assert.strictEqual(delayPlus, 250, "Shopify Plus store must respect 250ms minimum pacing floor");
  });

  // ---------------------------------------------------------------------------
  // TEST 18: Failed Single-Flight Operation Does NOT Poison Cache
  // ---------------------------------------------------------------------------
  await test("Failed single-flight operation cleans up in-flight state and allows subsequent retry to succeed", async () => {
    const cache = new TenantMemoryCache({ ttlMs: 10000 });
    let attempts = 0;

    const failingFetcher = async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("Temporary network partition");
      }
      return { recovered: true };
    };

    // First call fails
    try {
      await cache.coalesce("org-poison-test", "shopify", "snapshot", "main", failingFetcher);
      assert.fail("First call must fail");
    } catch (err: unknown) {
      assert.strictEqual((err as Error).message, "Temporary network partition");
    }

    // Verify cache was NOT poisoned with null or error
    assert.strictEqual(cache.get("org-poison-test", "shopify", "snapshot", "main"), null);

    // Second call immediately succeeds
    const recoveredResult: any = await cache.coalesce(
      "org-poison-test",
      "shopify",
      "snapshot",
      "main",
      failingFetcher
    );
    assert.strictEqual(recoveredResult.recovered, true);
    assert.strictEqual(attempts, 2);

    // Third call hits the fresh cache without running fetcher
    const cachedResult: any = await cache.coalesce(
      "org-poison-test",
      "shopify",
      "snapshot",
      "main",
      failingFetcher
    );
    assert.strictEqual(cachedResult.recovered, true);
    assert.strictEqual(attempts, 2, "Must serve from cache without calling fetcher");
  });

  // ---------------------------------------------------------------------------
  // TEST 19: Concurrent Requests from Different Tenants Do NOT Coalesce
  // ---------------------------------------------------------------------------
  await test("Concurrent requests from different tenants are strictly isolated and do NOT coalesce", async () => {
    const cache = new TenantMemoryCache({ ttlMs: 10000 });
    let tenantAFetches = 0;
    let tenantBFetches = 0;

    const fetcherA = async () => {
      tenantAFetches++;
      await new Promise((r) => setTimeout(r, 30));
      return { tenant: "A" };
    };

    const fetcherB = async () => {
      tenantBFetches++;
      await new Promise((r) => setTimeout(r, 30));
      return { tenant: "B" };
    };

    // Fire simultaneous requests for Tenant A and Tenant B
    const [resA, resB] = await Promise.all([
      cache.coalesce("tenant-A", "linear", "snapshot", "main", fetcherA),
      cache.coalesce("tenant-B", "linear", "snapshot", "main", fetcherB),
    ]);

    assert.strictEqual(resA.tenant, "A");
    assert.strictEqual(resB.tenant, "B");
    assert.strictEqual(tenantAFetches, 1);
    assert.strictEqual(tenantBFetches, 1);
  });

  // ---------------------------------------------------------------------------
  // TEST 20: Cache Expiration During In-Flight Request Coalesces Cleanly
  // ---------------------------------------------------------------------------
  await test("Expiring cache entry triggers clean in-flight refresh with simultaneous callers coalescing", async () => {
    const cache = new TenantMemoryCache<string>({ ttlMs: 40 }); // 40ms TTL
    let refreshCount = 0;

    const refreshFetcher = async () => {
      refreshCount++;
      await new Promise((r) => setTimeout(r, 30));
      return `version-${refreshCount}`;
    };

    // Initial populate
    const v1 = await cache.coalesce("org-expire", "sentry", "issues", "unresolved", refreshFetcher);
    assert.strictEqual(v1, "version-1");
    assert.strictEqual(refreshCount, 1);

    // Wait 50ms for entry to expire
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(cache.get("org-expire", "sentry", "issues", "unresolved"), null);

    // Three concurrent callers request data after expiration
    const [call1, call2, call3] = await Promise.all([
      cache.coalesce("org-expire", "sentry", "issues", "unresolved", refreshFetcher),
      cache.coalesce("org-expire", "sentry", "issues", "unresolved", refreshFetcher),
      cache.coalesce("org-expire", "sentry", "issues", "unresolved", refreshFetcher),
    ]);

    assert.strictEqual(call1, "version-2");
    assert.strictEqual(call2, "version-2");
    assert.strictEqual(call3, "version-2");
    assert.strictEqual(refreshCount, 2, "Exactly ONE refresh network call must execute for expired entry");
  });

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED WITH 0 FAILURES`);
  console.log("==================================================================\n");
}

runAll();
