// ==============================================================================
// KogSync: Linear OAuth 2.0 Security, Token Rotation & Concurrency Manager
// ==============================================================================

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";

export const LINEAR_OAUTH_SCOPES = ["read"] as const;

export const LINEAR_OAUTH_ENDPOINTS = {
  authorize: "https://linear.app/oauth/authorize",
  token: "https://api.linear.app/oauth/token",
  revoke: "https://api.linear.app/oauth/revoke",
} as const;

export interface LinearAuthStatePayload {
  organizationId: string;
  userId: string;
  returnUrl?: string;
  nonce: string;
  timestamp: number;
}

export interface LinearTokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string[];
}

export function getLinearConfig() {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const redirectUri =
    process.env.LINEAR_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/linear/callback`;

  return {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

function getHmacSecret(): string {
  const secret =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.STRIPE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATION_TOKEN_ENCRYPTION_KEY or STRIPE_SECRET_KEY is required in production for OAuth state integrity."
      );
    }
    return "kogsync-linear-oauth-dev-secret-key-32b";
  }

  return secret;
}

/**
 * Creates an HMAC-signed state parameter with nonce and timestamp to prevent CSRF attacks.
 */
export function createLinearOAuthState(
  payload: Omit<LinearAuthStatePayload, "nonce" | "timestamp">
): string {
  const fullPayload: LinearAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getHmacSecret())
    .update(base64Data)
    .digest("base64url");

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed OAuth state parameter using timing-safe comparison.
 * Strictly rejects states older than 15 minutes to prevent replay attacks.
 */
export function verifyLinearOAuthState(state: string): LinearAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", getHmacSecret())
      .update(base64Data)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr) as LinearAuthStatePayload;

    // Reject state older than 15 minutes
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - payload.timestamp > fifteenMinutes) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates the official Linear OAuth authorization redirect URL.
 */
export function generateLinearAuthUrl(options: {
  organizationId: string;
  userId: string;
  returnUrl?: string;
}): string {
  const { clientId, redirectUri } = getLinearConfig();
  if (!clientId) {
    throw new Error("LINEAR_CLIENT_ID environment variable is missing.");
  }

  const state = createLinearOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    returnUrl: options.returnUrl,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: LINEAR_OAUTH_SCOPES.join(","),
    state,
    prompt: "consent",
  });

  return `${LINEAR_OAUTH_ENDPOINTS.authorize}?${params.toString()}`;
}

/**
 * Exchanges the OAuth authorization code for access and refresh tokens.
 */
export async function exchangeLinearCodeForToken(code: string): Promise<LinearTokenExchangeResult> {
  const { clientId, clientSecret, redirectUri } = getLinearConfig();
  if (!clientId || !clientSecret) {
    throw new Error("LINEAR_CLIENT_ID or LINEAR_CLIENT_SECRET is missing.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(LINEAR_OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Linear token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Linear OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    expires_in: data.expires_in || 3600,
    refresh_token: data.refresh_token,
    scope: data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : ["read"],
  };
}

// In-process lock map to prevent concurrent refresh races across multiple incoming requests
const activeRefreshLocks = new Map<string, Promise<LinearTokenExchangeResult>>();

/**
 * Performs atomic Linear refresh token rotation with concurrency protection.
 * If multiple requests trigger refresh concurrently for the same organization,
 * only ONE network call is executed; all other requests await the active promise.
 */
export async function refreshLinearTokenWithLock(
  organizationId: string,
  refreshTokenPlaintext: string
): Promise<LinearTokenExchangeResult> {
  const existingLock = activeRefreshLocks.get(organizationId);
  if (existingLock) {
    return existingLock;
  }

  const refreshPromise = (async () => {
    const { clientId, clientSecret } = getLinearConfig();
    if (!clientId || !clientSecret) {
      throw new Error("LINEAR_CLIENT_ID or LINEAR_CLIENT_SECRET is missing.");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenPlaintext,
    });

    const response = await fetch(LINEAR_OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If refresh token was revoked or invalid, update organization_integrations status
      const supabase = await createClient();
      await supabase
        .from("organization_integrations")
        .update({
          status: "needs_reauth",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("provider", "linear");

      throw new Error(`Linear token refresh failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Linear refresh error: ${data.error_description || data.error}`);
    }

    const result: LinearTokenExchangeResult = {
      access_token: data.access_token,
      token_type: data.token_type || "Bearer",
      expires_in: data.expires_in || 3600,
      refresh_token: data.refresh_token,
      scope: data.scope ? (Array.isArray(data.scope) ? data.scope : [data.scope]) : ["read"],
    };

    // Atomically persist newly rotated tokens
    const supabase = await createClient();
    const newEncryptedAccess = encryptToken(result.access_token);
    const newEncryptedRefresh = result.refresh_token ? encryptToken(result.refresh_token) : undefined;
    const tokenExpiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();

    const updatePayload: Record<string, unknown> = {
      encrypted_access_token: newEncryptedAccess,
      token_expires_at: tokenExpiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    };

    if (newEncryptedRefresh) {
      updatePayload.encrypted_refresh_token = newEncryptedRefresh;
    }

    await supabase
      .from("organization_integrations")
      .update(updatePayload)
      .eq("organization_id", organizationId)
      .eq("provider", "linear");

    return result;
  })();

  activeRefreshLocks.set(organizationId, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    activeRefreshLocks.delete(organizationId);
  }
}

/**
 * Revokes a Linear OAuth token. Idempotent and fails gracefully.
 */
export async function revokeLinearToken(accessTokenPlaintext: string): Promise<boolean> {
  if (!accessTokenPlaintext) return false;

  try {
    const response = await fetch(LINEAR_OAUTH_ENDPOINTS.revoke, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: accessTokenPlaintext }).toString(),
    });

    return response.ok;
  } catch (err) {
    logger.warn("Linear token revocation call failed or was unreachable", { err });
    return false;
  }
}
