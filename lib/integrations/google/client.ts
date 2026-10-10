import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto/encryption";
import { refreshGoogleAccessToken } from "./oauth";

export interface AuthenticatedGoogleClient {
  organizationId: string;
  accountEmail: string;
  accessToken: string;
  googleFetch: (endpoint: string, init?: RequestInit) => Promise<Response>;
}

export interface AuthenticatedGoogleClientOptions {
  accountEmail?: string;
  userId?: string;
  service?: "gmail" | "google_calendar" | "google_drive" | "google";
  requiredScope?: string;
}

/**
 * Retrieves the organization's Google integration, verifies token freshness,
 * automatically performs an OAuth refresh if the access token is near expiry,
 * and returns an authenticated fetch client.
 */
export async function getAuthenticatedGoogleClient(
  organizationId: string,
  accountEmailOrOptions?: string | AuthenticatedGoogleClientOptions
): Promise<AuthenticatedGoogleClient> {
  const supabase = await createClient();

  let accountEmail: string | undefined;
  let userId: string | undefined;
  let service: "gmail" | "google_calendar" | "google_drive" | "google" | undefined;
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
    .in("provider", ["google", "gmail", "google_calendar", "google_drive"])
    .eq("status", "connected");

  if (accountEmail) {
    query = query.eq("account_email", accountEmail);
  }
  if (userId) {
    query = query.eq("connected_by_user_id", userId);
  }

  const { data: integrations, error } = await query;

  if (error || !integrations || integrations.length === 0) {
    throw new Error("No active Google integration found for this organization.");
  }

  // Filter integration by specific service or scope capability if requested
  let matchedIntegrations = integrations;

  if (service) {
    matchedIntegrations = integrations.filter((i) => {
      if (i.provider === service) return true;
      if (i.provider === "google") {
        if (service === "google_calendar" && i.scopes?.some((s: string) => s.includes("calendar"))) return true;
        if (service === "gmail" && i.scopes?.some((s: string) => s.includes("gmail"))) return true;
        if (service === "google_drive" && i.scopes?.some((s: string) => s.includes("drive"))) return true;
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
      `No active Google integration found with sufficient permissions for '${service || requiredScope || "google"}'.`
    );
  }

  if (!integration.encrypted_access_token) {
    throw new Error("Google integration is missing credentials. Please re-authenticate.");
  }

  let accessToken = decryptToken(integration.encrypted_access_token);
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;

  // If token is expired or expires within 3 minutes, refresh it
  const isNearExpiry = Date.now() + 3 * 60 * 1000 > expiresAt;

  if (isNearExpiry && integration.encrypted_refresh_token) {
    try {
      const refreshToken = decryptToken(integration.encrypted_refresh_token);
      const refreshResult = await refreshGoogleAccessToken(refreshToken);

      accessToken = refreshResult.access_token;
      const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
      const newEncryptedAccessToken = encryptToken(accessToken);

      // Update stored access token and expiration in PostgreSQL
      await supabase
        .from("organization_integrations")
        .update({
          encrypted_access_token: newEncryptedAccessToken,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    } catch (refreshErr) {
      console.error("Failed to auto-refresh Google access token:", refreshErr);
      // Mark as needing re-authentication
      await supabase
        .from("organization_integrations")
        .update({
          status: "needs_reauth",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      throw new Error("Google access token has expired and could not be renewed. Please reconnect.");
    }
  }

  const googleFetch = async (endpoint: string, init?: RequestInit): Promise<Response> => {
    const url = endpoint.startsWith("http") ? endpoint : `https://www.googleapis.com${endpoint}`;

    // SSRF protection: enforce strict allowlist of Google API origins
    const ALLOWED_GOOGLE_ORIGINS = [
      "https://www.googleapis.com",
      "https://gmail.googleapis.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://content.googleapis.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Invalid Google API URL");
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Google API requests must use HTTPS");
    }
    const originAllowed = ALLOWED_GOOGLE_ORIGINS.some(
      (allowed) => parsedUrl.origin === allowed || parsedUrl.hostname.endsWith(".googleapis.com")
    );
    if (!originAllowed) {
      throw new Error(`SSRF protection: URL origin '${parsedUrl.origin}' is not in the Google API allowlist`);
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
      throw new Error(`SSRF protection: requests to internal/metadata addresses are not permitted`);
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");

    const response = await fetch(url, {
      ...init,
      headers,
    });

    // If 401 Unauthorized occurs, attempt a one-time token refresh and retry
    if (response.status === 401 && integration.encrypted_refresh_token) {
      try {
        const refreshToken = decryptToken(integration.encrypted_refresh_token);
        const refreshResult = await refreshGoogleAccessToken(refreshToken);

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

        return fetch(url, {
          ...init,
          headers: retryHeaders,
        });
      } catch (retryErr) {
        // If refresh fails (revoked/invalid refresh token), mark integration as needing reconnection
        await supabase
          .from("organization_integrations")
          .update({
            status: "needs_reauth",
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);

        return response;
      }
    }

    return response;
  };

  return {
    organizationId,
    accountEmail: integration.account_email || "",
    accessToken,
    googleFetch,
  };
}
