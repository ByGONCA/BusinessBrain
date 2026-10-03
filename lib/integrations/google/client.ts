import { createClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/crypto/encryption";
import { refreshGoogleAccessToken } from "./oauth";

export interface AuthenticatedGoogleClient {
  organizationId: string;
  accountEmail: string;
  accessToken: string;
  googleFetch: (endpoint: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Retrieves the organization's Google integration, verifies token freshness,
 * automatically performs an OAuth refresh if the access token is near expiry,
 * and returns an authenticated fetch client.
 */
export async function getAuthenticatedGoogleClient(
  organizationId: string
): Promise<AuthenticatedGoogleClient> {
  const supabase = await createClient();

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !integration) {
    throw new Error("No active Google integration found for this organization.");
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
    googleFetch,
  };
}
