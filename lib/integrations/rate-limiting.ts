// ==============================================================================
// KogSync: Enterprise Multi-Tenant Rate Limiting & Resilience Subsystem
// Covers Shopify (REST + GraphQL), Sentry, and Linear.
// Features: Exponential backoff with full jitter, global serverless deadline,
// dynamic per-attempt timeout recalculation, mutation idempotency safeguards,
// and clean multi-tenant isolation.
// ==============================================================================

import { logger } from "@/lib/security/logger";

/**
 * Standardized rate limit metadata parsed from provider response headers and payloads.
 */
export interface RateLimitMetadata {
  provider: "shopify" | "sentry" | "linear";
  retryAfterSeconds: number;
  remaining?: number;
  limit?: number;
  resetEpochSeconds?: number;
  category?: string;
  isGraphQL?: boolean;
  throttleStatus?: {
    currentlyAvailable?: number;
    maximumAvailable?: number;
    restoreRate?: number;
  };
  reason?: string;
}

/**
 * Typed Rate Limit Error with safe, user-friendly localized messages
 * and zero internal secret or credential leakage.
 */
export class ProviderRateLimitError extends Error {
  public readonly status = 429;
  public readonly provider: "shopify" | "sentry" | "linear";
  public readonly retryAfterSeconds: number;
  public readonly remaining?: number;
  public readonly resetEpochSeconds?: number;
  public readonly isGraphQL?: boolean;
  public readonly userMessage: string;

  constructor(metadata: RateLimitMetadata) {
    const safeSeconds = Math.max(Math.ceil(metadata.retryAfterSeconds), 1);
    const providerNames = {
      shopify: "Shopify",
      sentry: "Sentry",
      linear: "Linear",
    };
    const providerLabel = providerNames[metadata.provider] || "External Service";
    const userMessage = `${providerLabel} API rate limit reached. Please wait ${safeSeconds}s before retrying.`;

    super(userMessage);
    this.name = "ProviderRateLimitError";
    this.provider = metadata.provider;
    this.retryAfterSeconds = safeSeconds;
    this.remaining = metadata.remaining;
    this.resetEpochSeconds = metadata.resetEpochSeconds;
    this.isGraphQL = metadata.isGraphQL;
    this.userMessage = userMessage;
  }
}

/**
 * Calculates exponential backoff with Full Jitter to avoid thundering herd collisions.
 * Formula: sleep = random_between(0, min(maxDelayMs, baseDelayMs * 2^attempt))
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs = 300,
  maxDelayMs = 4000
): number {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  // Full jitter: uniformly distributed between 0 and exponentialDelay
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Parses HTTP `Retry-After` header value.
 * Supports:
 * - Integer seconds (e.g., "5")
 * - Decimal seconds (e.g., "2.5")
 * - RFC 2822 / IMF-fixdate HTTP-date strings (e.g., "Wed, 21 Oct 2026 07:28:00 GMT")
 */
export function parseRetryAfterHeader(headerValue: string | null | undefined, defaultSeconds = 2): number {
  if (!headerValue || headerValue.trim() === "") {
    return defaultSeconds;
  }

  const trimmed = headerValue.trim();

  // 1. Try numeric seconds (integer or float)
  const numeric = parseFloat(trimmed);
  if (!Number.isNaN(numeric) && numeric >= 0) {
    return Math.max(Math.ceil(numeric), 1);
  }

  // 2. Try HTTP-date parsing
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diffSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
    return Math.max(diffSeconds, 1);
  }

  return defaultSeconds;
}

/**
 * Serverless execution budget parameters.
 * Vercel functions have tight execution deadlines; retries must not hang indefinitely.
 */
export const SERVERLESS_RETRY_LIMITS = {
  MAX_RETRIES: 2, // Total 3 attempts (1 initial + 2 retries)
  MAX_SINGLE_RETRY_WAIT_MS: 4000, // Max 4 seconds for a single sleep
  MAX_TOTAL_RETRY_BUDGET_MS: 5000, // Max 5 seconds total spent in retry sleeps
  DEFAULT_TIMEOUT_MS: 8000, // 8-second request abort timeout
  GLOBAL_DEADLINE_MS: 9500, // 9.5 seconds absolute global operation deadline
  MIN_VIABLE_REQUEST_MS: 400, // Minimum milliseconds needed to dispatch and process an HTTP request
} as const;

export interface RateLimitRetryOptions<T> {
  provider: "shopify" | "sentry" | "linear";
  organizationId: string;
  operationName: string;
  isIdempotent?: boolean; // GET and GraphQL queries are idempotent; mutations are NOT
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxTotalBudgetMs?: number;
  timeoutMs?: number;
  globalDeadlineMs?: number;
  execute: (signal: AbortSignal) => Promise<Response>;
  parseRateLimit?: (response: Response) => RateLimitMetadata | null;
  onSuccess?: (response: Response) => Promise<T>;
  customSleep?: (ms: number) => Promise<void>; // Injected for unit testing
  nowFn?: () => number; // Injected clock for deterministic testing
}

/**
 * Universal rate-limit aware HTTP executor with exponential backoff, jitter,
 * global serverless deadline enforcement, dynamic per-attempt timeout recalculation,
 * and mutation safety.
 */
export async function executeWithRateLimitRetry<T>(
  options: RateLimitRetryOptions<T>
): Promise<{ data: T; response: Response }> {
  const {
    provider,
    organizationId,
    operationName,
    isIdempotent = true,
    maxRetries = SERVERLESS_RETRY_LIMITS.MAX_RETRIES,
    baseDelayMs = 300,
    maxDelayMs = SERVERLESS_RETRY_LIMITS.MAX_SINGLE_RETRY_WAIT_MS,
    maxTotalBudgetMs = SERVERLESS_RETRY_LIMITS.MAX_TOTAL_RETRY_BUDGET_MS,
    timeoutMs = SERVERLESS_RETRY_LIMITS.DEFAULT_TIMEOUT_MS,
    globalDeadlineMs = SERVERLESS_RETRY_LIMITS.GLOBAL_DEADLINE_MS,
    execute,
    parseRateLimit,
    onSuccess,
    customSleep,
    nowFn = Date.now,
  } = options;

  const sleepFn = customSleep || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const minViableMs = SERVERLESS_RETRY_LIMITS.MIN_VIABLE_REQUEST_MS;

  const operationStartTime = nowFn();
  const globalDeadlineTime = operationStartTime + globalDeadlineMs;

  let attempt = 0;
  let totalTimeSpentSleepingMs = 0;
  let lastRateLimitMeta: RateLimitMetadata | null = null;

  while (true) {
    const currentTime = nowFn();
    const remainingTimeMs = globalDeadlineTime - currentTime;

    // -------------------------------------------------------------------------
    // 0. GLOBAL DEADLINE CHECK: Check if sufficient time remains before attempt
    // -------------------------------------------------------------------------
    if (remainingTimeMs < minViableMs) {
      logger.warn("Serverless execution budget exhausted before request attempt", {
        provider,
        organizationId,
        operationName,
        attempt,
        remainingTimeMs,
        minViableMs,
        globalDeadlineMs,
      });

      if (lastRateLimitMeta) {
        throw new ProviderRateLimitError(lastRateLimitMeta);
      }
      const deadlineError = new Error(
        `${provider} API request aborted: Global execution deadline of ${globalDeadlineMs}ms exceeded.`
      );
      deadlineError.name = "TimeoutError";
      throw deadlineError;
    }

    // Dynamic per-attempt timeout: Never exceed either timeoutMs OR the remaining global deadline!
    const attemptTimeoutMs = Math.min(timeoutMs, remainingTimeMs);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      const response = await execute(controller.signal);
      clearTimeout(timeoutId);

      // -----------------------------------------------------------------------
      // 1. Success check
      // -----------------------------------------------------------------------
      if (response.ok) {
        let data: T;
        if (onSuccess) {
          data = await onSuccess(response);
        } else {
          data = (await response.json()) as T;
        }
        return { data, response };
      }

      // -----------------------------------------------------------------------
      // 2. HTTP 429 Too Many Requests Handling
      // -----------------------------------------------------------------------
      if (response.status === 429) {
        const rateLimitMeta = parseRateLimit
          ? parseRateLimit(response)
          : {
              provider,
              retryAfterSeconds: parseRetryAfterHeader(response.headers.get("Retry-After")),
            };

        lastRateLimitMeta = rateLimitMeta;
        const retryAfterSeconds = rateLimitMeta?.retryAfterSeconds || 2;
        const requiredWaitMs = retryAfterSeconds * 1000;

        logger.warn("External provider rate limit received (429)", {
          provider,
          organizationId,
          operationName,
          attempt,
          retryAfterSeconds,
          remaining: rateLimitMeta?.remaining,
          category: rateLimitMeta?.category,
        });

        // SAFETY: Non-idempotent operations (POST, PUT, DELETE, mutations) must NOT be retried
        if (!isIdempotent) {
          logger.warn("Skipping retry for non-idempotent operation on 429", {
            provider,
            organizationId,
            operationName,
          });
          throw new ProviderRateLimitError(
            rateLimitMeta || { provider, retryAfterSeconds, reason: "non_idempotent_mutation" }
          );
        }

        const remainingAfterResponse = globalDeadlineTime - nowFn();

        // SERVERLESS BUDGET & DEADLINE CHECK:
        // 1. If provider asks us to wait longer than max allowed single delay (e.g. 60s)
        // 2. If cumulative sleep exceeds sleep budget
        // 3. If max retry attempts reached
        // 4. If required wait plus a viable request window exceeds the remaining global deadline
        if (
          requiredWaitMs > maxDelayMs ||
          totalTimeSpentSleepingMs + requiredWaitMs > maxTotalBudgetMs ||
          attempt >= maxRetries ||
          requiredWaitMs + minViableMs > remainingAfterResponse
        ) {
          logger.info("Failing fast on rate limit: delay exceeds serverless budget or deadline", {
            provider,
            organizationId,
            operationName,
            attempt,
            requiredWaitMs,
            totalTimeSpentSleepingMs,
            maxTotalBudgetMs,
            remainingAfterResponse,
          });
          throw new ProviderRateLimitError(
            rateLimitMeta || { provider, retryAfterSeconds, reason: "serverless_budget_exceeded" }
          );
        }

        // Compute jittered sleep (respecting provider minimum wait time)
        const jitteredDelay = Math.max(
          requiredWaitMs,
          calculateBackoffWithJitter(attempt, baseDelayMs, maxDelayMs)
        );

        // Ensure jittered delay also fits in the remaining global deadline
        if (jitteredDelay + minViableMs > remainingAfterResponse) {
          // If jittered delay doesn't fit but minimum required wait does, clamp to remaining
          if (requiredWaitMs + minViableMs <= remainingAfterResponse) {
            totalTimeSpentSleepingMs += requiredWaitMs;
            attempt++;
            await sleepFn(requiredWaitMs);
            continue;
          }
          throw new ProviderRateLimitError(
            rateLimitMeta || { provider, retryAfterSeconds, reason: "deadline_exceeded" }
          );
        }

        totalTimeSpentSleepingMs += jitteredDelay;
        attempt++;

        await sleepFn(jitteredDelay);
        continue;
      }

      // -----------------------------------------------------------------------
      // 3. Transient Server Errors (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
      // -----------------------------------------------------------------------
      if ([502, 503, 504].includes(response.status)) {
        const remainingAfterResponse = globalDeadlineTime - nowFn();
        const backoffDelay = calculateBackoffWithJitter(attempt, baseDelayMs, maxDelayMs);

        if (
          !isIdempotent ||
          attempt >= maxRetries ||
          totalTimeSpentSleepingMs + backoffDelay > maxTotalBudgetMs ||
          backoffDelay + minViableMs > remainingAfterResponse
        ) {
          const errorText = await response.text().catch(() => "");
          throw new Error(`${provider} API transient error (${response.status}): ${errorText}`);
        }

        totalTimeSpentSleepingMs += backoffDelay;
        attempt++;
        await sleepFn(backoffDelay);
        continue;
      }

      // -----------------------------------------------------------------------
      // 4. Permanent Client Errors (400, 401, 403, 404, 422) — NEVER RETRY
      // -----------------------------------------------------------------------
      const errorText = await response.text().catch(() => "");
      throw new Error(`${provider} API request failed (${response.status}): ${errorText}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ProviderRateLimitError) {
        throw err;
      }

      // Handle AbortError / Network timeout
      const isAbort = (err as Error)?.name === "AbortError";
      const remainingAfterError = globalDeadlineTime - nowFn();

      if (isAbort && isIdempotent && attempt < maxRetries) {
        const backoffDelay = calculateBackoffWithJitter(attempt, baseDelayMs, maxDelayMs);
        if (
          totalTimeSpentSleepingMs + backoffDelay <= maxTotalBudgetMs &&
          backoffDelay + minViableMs <= remainingAfterError
        ) {
          logger.warn("Request timed out, retrying with backoff within budget", {
            provider,
            organizationId,
            operationName,
            attempt,
            remainingAfterError,
          });
          totalTimeSpentSleepingMs += backoffDelay;
          attempt++;
          await sleepFn(backoffDelay);
          continue;
        }
      }

      throw err;
    }
  }
}
