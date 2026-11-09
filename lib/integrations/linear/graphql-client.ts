// ==============================================================================
// KogSync: Linear Typed GraphQL Client with SSRF Guard, Rate-Limit & Auto-Refresh
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";
import { LINEAR_GRAPHQL_ENDPOINT } from "./config";
import { refreshLinearTokenWithLock } from "./oauth";
import { LinearGraphQLResponse, LinearGraphQLError } from "./types";
import {
  executeWithRateLimitRetry,
  parseRetryAfterHeader,
  ProviderRateLimitError,
  RateLimitMetadata,
} from "../rate-limiting";

export class LinearAuthExpiredError extends Error {
  constructor(message = "Linear authentication token is expired or revoked.") {
    super(message);
    this.name = "LinearAuthExpiredError";
  }
}

export class LinearRateLimitError extends Error {
  public readonly status = 429;
  public resetTime?: number;
  public retryAfterSeconds: number;
  public isComplexity?: boolean;
  public requestsRemaining?: number;

  constructor(
    message = "Linear API rate limit exceeded.",
    resetTime?: number,
    retryAfterSeconds = 2,
    isComplexity = false,
    requestsRemaining?: number
  ) {
    super(message);
    this.name = "LinearRateLimitError";
    this.resetTime = resetTime;
    this.retryAfterSeconds = retryAfterSeconds;
    this.isComplexity = isComplexity;
    this.requestsRemaining = requestsRemaining;
  }
}

export class LinearGraphQLExecutionError extends Error {
  public errors: LinearGraphQLError[];
  constructor(message: string, errors: LinearGraphQLError[]) {
    super(message);
    this.name = "LinearGraphQLExecutionError";
    this.errors = errors;
  }
}

/**
 * Checks if a GraphQL error payload indicates rate limiting or query complexity exhaustion.
 */
export function isLinearRateLimitGraphQLError(err: LinearGraphQLError): boolean {
  const code = (err.extensions?.code || "").toString().toUpperCase();
  const type = (err.extensions?.type || "").toString().toUpperCase();
  const msg = (err.message || "").toLowerCase();
  return (
    code === "RATELIMITED" ||
    type === "RATELIMITERROR" ||
    msg.includes("rate limit") ||
    msg.includes("complexity") ||
    msg.includes("too many requests") ||
    msg.includes("throttled")
  );
}

/**
 * Parses Linear rate limit headers.
 */
export function parseLinearRateLimitHeaders(headers: Headers): {
  retryAfterSeconds: number;
  resetEpochSeconds?: number;
  requestsRemaining?: number;
  isComplexity?: boolean;
} {
  const retryAfterHeader = headers.get("Retry-After");
  const resetHeader = headers.get("X-RateLimit-Requests-Reset");
  const remainingHeader = headers.get("X-RateLimit-Requests-Remaining");
  const complexityReset = headers.get("X-Complexity-Reset");
  const complexityRemaining = headers.get("X-Complexity-Remaining");

  let retryAfterSeconds = parseRetryAfterHeader(retryAfterHeader, 2);
  let resetEpochSeconds: number | undefined;

  const targetReset = complexityReset || resetHeader;
  if (targetReset) {
    const parsed = parseInt(targetReset, 10);
    if (!Number.isNaN(parsed)) {
      if (parsed > 1000000000) {
        resetEpochSeconds = parsed;
        const diff = Math.ceil(parsed - Date.now() / 1000);
        if (!retryAfterHeader && diff > 0) {
          retryAfterSeconds = diff;
        }
      } else if (parsed > 0 && !retryAfterHeader) {
        retryAfterSeconds = parsed;
      }
    }
  }

  const remStr = complexityRemaining || remainingHeader;
  const requestsRemaining = remStr ? parseInt(remStr, 10) : undefined;

  return {
    retryAfterSeconds,
    resetEpochSeconds,
    requestsRemaining: Number.isNaN(requestsRemaining) ? undefined : requestsRemaining,
    isComplexity: Boolean(complexityReset || complexityRemaining),
  };
}

/**
 * Retrieves the decrypted access token and refresh token for an organization.
 * Strictly scoped per tenant; never ambient.
 */
export async function getDecryptedLinearTokens(organizationId: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  accountEmail?: string;
  workspaceName?: string;
} | null> {
  const supabase = await createClient();

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, encrypted_access_token, encrypted_refresh_token, token_expires_at, account_email, metadata, status")
    .eq("organization_id", organizationId)
    .eq("provider", "linear")
    .maybeSingle();

  if (error || !integration || !integration.encrypted_access_token) {
    return null;
  }

  if (integration.status === "disconnected" || integration.status === "needs_reauth") {
    return null;
  }

  try {
    const accessToken = decryptToken(integration.encrypted_access_token);
    const refreshToken = integration.encrypted_refresh_token
      ? decryptToken(integration.encrypted_refresh_token)
      : undefined;

    return {
      accessToken,
      refreshToken,
      tokenExpiresAt: integration.token_expires_at,
      accountEmail: integration.account_email || undefined,
      workspaceName: (integration.metadata as any)?.workspace_name,
    };
  } catch (err) {
    logger.error("Failed to decrypt Linear OAuth tokens", err, { organizationId });
    return null;
  }
}

/**
 * Executes a typed GraphQL query/mutation against Linear's official API.
 * Features: SSRF validation, Bearer token injection, automatic token refresh,
 * rate limit handling (HTTP 429 & GraphQL 200 errors), exponential backoff with full jitter,
 * and mutation idempotency safeguards.
 */
export async function linearGraphQLFetch<T>(
  organizationId: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let tokenData = await getDecryptedLinearTokens(organizationId);
  if (!tokenData) {
    throw new LinearAuthExpiredError("Linear integration is not connected or token is unavailable.");
  }

  // Check near-expiry (< 3 minutes)
  const expiresAtMs = tokenData.tokenExpiresAt ? new Date(tokenData.tokenExpiresAt).getTime() : 0;
  const isNearExpiry = expiresAtMs > 0 && Date.now() + 3 * 60 * 1000 > expiresAtMs;

  if (isNearExpiry && tokenData.refreshToken) {
    try {
      const refreshed = await refreshLinearTokenWithLock(organizationId, tokenData.refreshToken);
      tokenData.accessToken = refreshed.access_token;
    } catch (refreshErr) {
      logger.warn("Proactive Linear token refresh failed, proceeding with current token", { refreshErr });
    }
  }

  // SSRF guard
  if (!LINEAR_GRAPHQL_ENDPOINT.startsWith("https://api.linear.app/graphql")) {
    throw new Error("Invalid Linear API endpoint: SSRF protection violation.");
  }

  const isMutation = query.trim().startsWith("mutation");
  const isIdempotent = !isMutation;

  try {
    const { data } = await executeWithRateLimitRetry<T>({
      provider: "linear",
      organizationId,
      operationName: "graphql_query",
      isIdempotent,
      execute: async (signal) => {
        let resp = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${tokenData!.accessToken}`,
            "User-Agent": "KogSync-Intelligence-Engine/1.0",
          },
          body: JSON.stringify({ query, variables }),
          cache: "no-store",
        });

        // Handle 401 Unauthorized with reactive refresh once
        if (resp.status === 401 && tokenData?.refreshToken) {
          try {
            const refreshed = await refreshLinearTokenWithLock(organizationId, tokenData.refreshToken);
            tokenData.accessToken = refreshed.access_token;

            resp = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
              method: "POST",
              signal,
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${refreshed.access_token}`,
                "User-Agent": "KogSync-Intelligence-Engine/1.0",
              },
              body: JSON.stringify({ query, variables }),
              cache: "no-store",
            });
          } catch {
            throw new LinearAuthExpiredError("Linear session expired or revoked. Please reconnect.");
          }
        }

        return resp;
      },
      parseRateLimit: (res: Response): RateLimitMetadata => {
        const parsed = parseLinearRateLimitHeaders(res.headers);
        return {
          provider: "linear",
          retryAfterSeconds: parsed.retryAfterSeconds,
          remaining: parsed.requestsRemaining,
          resetEpochSeconds: parsed.resetEpochSeconds,
          isGraphQL: true,
        };
      },
      onSuccess: async (res) => {
        const json: LinearGraphQLResponse<T> = await res.json();

        // Crucial requirement: Check errors array even on HTTP 200 OK
        if (json.errors && json.errors.length > 0) {
          // Check if any error in the array indicates a rate limit / complexity exhaustion
          const rateLimitErr = json.errors.find(isLinearRateLimitGraphQLError);
          if (rateLimitErr) {
            const extRetryAfter = (rateLimitErr.extensions as any)?.userError?.retryAfter || (rateLimitErr.extensions as any)?.retryAfter;
            const parsed = parseLinearRateLimitHeaders(res.headers);
            const retryAfterSeconds = extRetryAfter ? Math.max(Math.ceil(extRetryAfter), 1) : parsed.retryAfterSeconds;

            throw new ProviderRateLimitError({
              provider: "linear",
              retryAfterSeconds,
              remaining: parsed.requestsRemaining,
              resetEpochSeconds: parsed.resetEpochSeconds,
              isGraphQL: true,
              reason: rateLimitErr.message,
            });
          }

          // Otherwise permanent domain error
          throw new LinearGraphQLExecutionError(
            `Linear GraphQL error: ${json.errors[0].message}`,
            json.errors
          );
        }

        if (!json.data) {
          throw new Error("Linear GraphQL response contained empty data payload.");
        }

        return json.data;
      },
    });

    return data;
  } catch (err: unknown) {
    if (err instanceof ProviderRateLimitError) {
      throw new LinearRateLimitError(
        err.userMessage,
        err.resetEpochSeconds,
        err.retryAfterSeconds,
        false,
        err.remaining
      );
    }
    throw err;
  }
}
