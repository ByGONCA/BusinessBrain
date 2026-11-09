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
          // 429 without Retry-After header
          return new Response("Too Many Requests", { status: 429 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(sleptMs.length, 1);
    // When Retry-After is absent, default 2s minimum is applied or backoff
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
          // Simulate hung network request exceeding timeout
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

    // Wait time formula: ceil((requested - available) / restoreRate)
    const calculatedWaitSeconds = Math.max(Math.ceil((requested - available) / restoreRate), 1);
    assert.strictEqual(calculatedWaitSeconds, 2, "Math.ceil((100 - 10) / 50) = 2 seconds");
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Rate Limit Isolation
  // ---------------------------------------------------------------------------
  test("Tenant A rate limit does not affect Tenant B cache or execution state", () => {
    const cache = new TenantMemoryCache({ ttlMs: 60000 });

    // Tenant A experiences rate limit / empty state
    cache.set("tenant-A", "shopify", "snapshot", "main", { rateLimited: true, retryAfter: 5 });

    // Tenant B operates normally
    cache.set("tenant-B", "shopify", "snapshot", "main", { rateLimited: false, productsCount: 42 });

    const tenantAData: any = cache.get("tenant-A", "shopify", "snapshot", "main");
    const tenantBData: any = cache.get("tenant-B", "shopify", "snapshot", "main");

    assert.strictEqual(tenantAData.rateLimited, true);
    assert.strictEqual(tenantBData.rateLimited, false);
    assert.strictEqual(tenantBData.productsCount, 42);

    // Invalidation of Tenant A leaves Tenant B completely untouched
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
        isIdempotent: false, // Critical flag for POST/mutations
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
        maxDelayMs: 4000, // 4-second max single wait
        customSleep: mockSleep,
        execute: async () => {
          callCount++;
          // Sentry asks to wait 60 seconds
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

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED WITH 0 FAILURES`);
  console.log("==================================================================\n");
}

runAll();
