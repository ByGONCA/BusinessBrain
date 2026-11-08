// ==============================================================================
// KogSync: Linear Typed GraphQL Client with SSRF Guard & Auto-Refresh
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";
import { LINEAR_GRAPHQL_ENDPOINT } from "./config";
import { refreshLinearTokenWithLock } from "./oauth";
import { LinearGraphQLResponse, LinearGraphQLError } from "./types";

export class LinearAuthExpiredError extends Error {
  constructor(message = "Linear authentication token is expired or revoked.") {
    super(message);
    this.name = "LinearAuthExpiredError";
  }
}

export class LinearRateLimitError extends Error {
  public resetTime?: number;
  constructor(message = "Linear API rate limit exceeded.", resetTime?: number) {
    super(message);
    this.name = "LinearRateLimitError";
    this.resetTime = resetTime;
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
 * rate limit handling, and strict GraphQL error checking.
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

  const response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${tokenData.accessToken}`,
      "User-Agent": "KogSync-Intelligence-Engine/1.0",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  // Handle Rate Limiting (HTTP 429)
  if (response.status === 429) {
    const resetHeader = response.headers.get("X-RateLimit-Requests-Reset");
    const resetTime = resetHeader ? parseInt(resetHeader, 10) : undefined;
    throw new LinearRateLimitError("Linear GraphQL rate limit exceeded.", resetTime);
  }

  // Handle 401 Unauthorized with reactive refresh
  if (response.status === 401 && tokenData.refreshToken) {
    try {
      const refreshed = await refreshLinearTokenWithLock(organizationId, tokenData.refreshToken);
      // Retry once with new token
      const retryResponse = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${refreshed.access_token}`,
          "User-Agent": "KogSync-Intelligence-Engine/1.0",
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });

      if (!retryResponse.ok) {
        throw new LinearAuthExpiredError("Linear session expired after refresh attempt.");
      }

      const retryJson: LinearGraphQLResponse<T> = await retryResponse.json();
      if (retryJson.errors && retryJson.errors.length > 0) {
        throw new LinearGraphQLExecutionError(
          `Linear GraphQL error: ${retryJson.errors[0].message}`,
          retryJson.errors
        );
      }

      if (!retryJson.data) {
        throw new Error("Linear GraphQL response contained empty data payload.");
      }

      return retryJson.data;
    } catch (retryErr) {
      throw new LinearAuthExpiredError("Linear session expired or revoked. Please reconnect.");
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Linear API request failed (${response.status}): ${errorText}`);
  }

  const json: LinearGraphQLResponse<T> = await response.json();

  // Crucial requirement: Check errors array even on HTTP 200 OK
  if (json.errors && json.errors.length > 0) {
    throw new LinearGraphQLExecutionError(
      `Linear GraphQL returned errors: ${json.errors[0].message}`,
      json.errors
    );
  }

  if (!json.data) {
    throw new Error("Linear GraphQL response contained empty data payload.");
  }

  return json.data;
}
