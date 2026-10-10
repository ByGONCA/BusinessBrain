import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto/encryption";
import { refreshMicrosoftAccessToken } from "./oauth";

export interface AuthenticatedMicrosoftClient {
  organizationId: string;
  accountEmail: string;
  accessToken: string;
  microsoftFetch: (endpoint: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Retrieves the organization's Microsoft integration, verifies token freshness,
 * automatically performs an OAuth refresh if the access token is near expiry,
 * and returns an authenticated fetch client with SSRF protection.
 */
export async function getAuthenticatedMicrosoftClient(
  organizationId: string,
  accountEmailOrOptions?: string | { accountEmail?: string; userId?: string }
): Promise<AuthenticatedMicrosoftClient> {
  const supabase = await createClient();

  let accountEmail: string | undefined;
  let userId: string | undefined;

  if (typeof accountEmailOrOptions === "string") {
    accountEmail = accountEmailOrOptions;
  } else if (accountEmailOrOptions) {
    accountEmail = accountEmailOrOptions.accountEmail;
    userId = accountEmailOrOptions.userId;
  }

  let query = supabase
    .from("organization_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .in("provider", ["outlook", "outlook_calendar"])
    .eq("status", "connected");

  if (accountEmail) {
    query = query.eq("account_email", accountEmail);
  }
  if (userId) {
    query = query.eq("connected_by_user_id", userId);
  }

  const { data: integrations, error } = await query;
  const integration = integrations?.[0];

  if (error || !integration) {
    throw new Error("No active Microsoft integration found for this organization.");
  }

  if (!integration.encrypted_access_token) {
    throw new Error("Microsoft integration is missing credentials. Please re-authenticate.");
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
      const refreshResult = await refreshMicrosoftAccessToken(refreshToken);

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
    } catch (err) {
      console.warn("Failed to refresh Microsoft access token, proceeding with existing token", err);
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
      throw new Error(`SSRF protection: requests to internal/metadata addresses are not permitted`);
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");

    return fetch(url, {
      ...init,
      headers,
    });
  };

  return {
    organizationId,
    accountEmail: integration.account_email || "",
    accessToken,
    microsoftFetch,
  };
}
