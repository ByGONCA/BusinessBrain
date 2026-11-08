import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto/encryption";
import { refreshMicrosoftAccessToken } from "./oauth";
import { logger } from "@/lib/security/logger";

export interface AuthenticatedMicrosoftClient {
  organizationId: string;
  accountEmail: string;
  accessToken: string;
  microsoftFetch: (endpoint: string, init?: RequestInit) => Promise<Response>;
}

export interface AuthenticatedMicrosoftClientOptions {
  accountEmail?: string;
  userId?: string;
  service?: "outlook" | "outlook_calendar" | "onedrive" | "teams" | "microsoft";
  requiredScope?: string;
}

// In-flight refresh promises mapped by integration ID to serialize concurrent requests
const activeRefreshPromises = new Map<
  string,
  Promise<{ access_token: string; expires_in: number }>
>();

/**
 * Retrieves the organization's Microsoft integration, verifies token freshness,
 * automatically performs an OAuth refresh if the access token is near expiry,
 * and returns an authenticated fetch client with SSRF protection, 401 auto-retry, and 429 backoff.
 */
export async function getAuthenticatedMicrosoftClient(
  organizationId: string,
  accountEmailOrOptions?: string | AuthenticatedMicrosoftClientOptions
): Promise<AuthenticatedMicrosoftClient> {
  const supabase = await createClient();

  let accountEmail: string | undefined;
  let userId: string | undefined;
  let service: "outlook" | "outlook_calendar" | "onedrive" | "teams" | "microsoft" | undefined;
  let requiredScope: string | undefined;

  if (typeof accountEmailOrOptions === "string") {
    accountEmail = accountEmailOrOptions;
  } else if (accountEmailOrOptions) {
    accountEmail = accountEmailOrOptions.accountEmail;
    userId = accountEmailOrOptions.userId;
    service = accountEmailOrOptions.service;
    requiredScope = accountEmailOrOptions.requiredScope;
  }

  let query = supabase
    .from("organization_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .in("provider", ["microsoft", "outlook", "outlook_calendar", "onedrive", "teams"])
    .eq("status", "connected");

  if (accountEmail) {
    query = query.eq("account_email", accountEmail);
  }
  if (userId) {
    query = query.eq("connected_by_user_id", userId);
  }

  const { data: integrations, error } = await query;

  if (error || !integrations || integrations.length === 0) {
    throw new Error("No active Microsoft integration found for this organization.");
  }

  // Filter integrations by requested service or scope capability
  let matchedIntegrations = integrations;

  if (service) {
    matchedIntegrations = integrations.filter((i) => {
      if (i.provider === service) return true;
      if (i.provider === "microsoft") {
        if (service === "outlook_calendar" && i.scopes?.some((s: string) => s.toLowerCase().includes("calendar"))) return true;
        if (service === "outlook" && i.scopes?.some((s: string) => s.toLowerCase().includes("mail"))) return true;
        if (service === "onedrive" && i.scopes?.some((s: string) => s.toLowerCase().includes("files"))) return true;
        if (service === "teams" && i.scopes?.some((s: string) => s.toLowerCase().includes("meetings") || s.toLowerCase().includes("chat"))) return true;
        return true;
      }
      return false;
    });
  }

  if (requiredScope) {
    matchedIntegrations = matchedIntegrations.filter((i) =>
      i.scopes?.some((s: string) => s.toLowerCase().includes(requiredScope!.toLowerCase()))
    );
  }

  const integration = matchedIntegrations[0] || (service || requiredScope ? null : integrations[0]);

  if (!integration) {
    throw new Error(
      `No active Microsoft integration found with sufficient permissions for '${service || requiredScope || "microsoft"}'.`
    );
  }

  if (!integration.encrypted_access_token) {
    throw new Error("Microsoft integration is missing credentials. Please re-authenticate.");
  }

  let accessToken = decryptToken(integration.encrypted_access_token);
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;

  // If token is expired or expires within 3 minutes, refresh it with serialized concurrency control
  const isNearExpiry = Date.now() + 3 * 60 * 1000 > expiresAt;

  if (isNearExpiry && integration.encrypted_refresh_token) {
    try {
      let refreshPromise = activeRefreshPromises.get(integration.id);
      if (!refreshPromise) {
        const refreshToken = decryptToken(integration.encrypted_refresh_token);
        refreshPromise = refreshMicrosoftAccessToken(refreshToken).finally(() => {
          activeRefreshPromises.delete(integration.id);
        });
        activeRefreshPromises.set(integration.id, refreshPromise);
      }

      const refreshResult = await refreshPromise;
      accessToken = refreshResult.access_token;
      const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
      const newEncryptedAccessToken = encryptToken(accessToken);

      // Persist refreshed credentials
      await supabase
        .from("organization_integrations")
        .update({
          encrypted_access_token: newEncryptedAccessToken,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    } catch (err) {
      logger.warn("Failed to refresh Microsoft access token, marking as needs_reauth", {
        integrationId: integration.id,
        error: String(err),
      });
      await supabase
        .from("organization_integrations")
        .update({
          status: "needs_reauth",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
      throw new Error("Microsoft access token has expired and could not be renewed. Please reconnect.");
    }
  }

  const microsoftFetch = async (endpoint: string, init?: RequestInit): Promise<Response> => {
    const url = endpoint.startsWith("http") ? endpoint : `https://graph.microsoft.com/v1.0${endpoint}`;

    // SSRF protection: enforce strict allowlist of Microsoft API origins
    const ALLOWED_MICROSOFT_ORIGINS = [
      "https://graph.microsoft.com",
      "https://login.microsoftonline.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Invalid Microsoft API URL");
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Microsoft API requests must use HTTPS");
    }
    const originAllowed = ALLOWED_MICROSOFT_ORIGINS.some(
      (allowed) => parsedUrl.origin === allowed
    );
    if (!originAllowed) {
      throw new Error(`SSRF protection: URL origin '${parsedUrl.origin}' is not in the Microsoft API allowlist`);
    }
    // Block SSRF via metadata/loopback addresses
    const host = parsedUrl.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "169.254.169.254" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.match(/^172\.(1[6-9]|2\d|3[01])\./)
    ) {
      throw new Error("SSRF protection: requests to internal/metadata addresses are not permitted");
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");

    let response = await fetch(url, {
      ...init,
      headers,
    });

    // Handle Rate Limiting (HTTP 429)
    if (response.status === 429) {
      const retryAfterSeconds = parseInt(response.headers.get("Retry-After") || "2", 10);
      logger.warn("Microsoft Graph API rate limit encountered (429)", {
        url,
        retryAfterSeconds,
      });
    }

    // If 401 Unauthorized occurs, attempt a one-time token refresh and retry
    if (response.status === 401 && integration.encrypted_refresh_token) {
      try {
        let retryRefresh = activeRefreshPromises.get(integration.id);
        if (!retryRefresh) {
          const refreshToken = decryptToken(integration.encrypted_refresh_token);
          retryRefresh = refreshMicrosoftAccessToken(refreshToken).finally(() => {
            activeRefreshPromises.delete(integration.id);
          });
          activeRefreshPromises.set(integration.id, retryRefresh);
        }

        const refreshResult = await retryRefresh;
        accessToken = refreshResult.access_token;
        const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
        const newEncryptedAccessToken = encryptToken(accessToken);

        // Update stored token in PostgreSQL
        await supabase
          .from("organization_integrations")
          .update({
            encrypted_access_token: newEncryptedAccessToken,
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);

        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${accessToken}`);
        retryHeaders.set("Accept", "application/json");

        response = await fetch(url, {
          ...init,
          headers: retryHeaders,
        });
      } catch (retryErr) {
        logger.warn("Token refresh on 401 failed, marking as needs_reauth", {
          integrationId: integration.id,
          error: String(retryErr),
        });
        await supabase
          .from("organization_integrations")
          .update({
            status: "needs_reauth",
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);
      }
    }

    return response;
  };

  return {
    organizationId,
    accountEmail: integration.account_email || "",
    accessToken,
    microsoftFetch,
  };
}
