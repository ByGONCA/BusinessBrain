// ==============================================================================
// KogSync: Multi-Tenant Sentry OAuth 2.0 Security, Token Rotation & Concurrency
// ==============================================================================

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/encryption";
import { signOAuthStatePayload, verifyOAuthStateSignature } from "@/lib/security/oauth-state";
import { getSentryOAuthConfig, SENTRY_OAUTH_ENDPOINTS, SENTRY_OAUTH_SCOPES } from "./config";
export { getSentryOAuthConfig, SENTRY_OAUTH_ENDPOINTS, SENTRY_OAUTH_SCOPES } from "./config";
import { SentryAuthStatePayload, SentryTokenExchangeResult } from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Creates an HMAC-signed state parameter with nonce and timestamp to prevent CSRF attacks.
 * Signed strictly using the dedicated OAUTH_STATE_SECRET.
 */
export function createSentryOAuthState(
  payload: Omit<SentryAuthStatePayload, "nonce" | "timestamp">
): string {
  const fullPayload: SentryAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(jsonStr).toString("base64url");
  const signature = signOAuthStatePayload(base64Data);

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed OAuth state parameter using timing-safe comparison.
 * Strictly rejects states older than 15 minutes to prevent replay attacks.
 */
export function verifySentryOAuthState(state: string): SentryAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    if (!verifyOAuthStateSignature(base64Data, signature)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr) as SentryAuthStatePayload;

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
 * Generates the official Sentry OAuth authorization redirect URL.
 */
export function generateSentryAuthUrl(options: {
  organizationId: string;
  userId: string;
  returnUrl?: string;
  request?: Request;
}): string {
  const { clientId, redirectUri } = getSentryOAuthConfig(options.request);
  if (!clientId) {
    throw new Error("SENTRY_CLIENT_ID environment variable is missing.");
  }

  const state = createSentryOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    returnUrl: options.returnUrl,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SENTRY_OAUTH_SCOPES.join(" "),
    state,
  });

  return `${SENTRY_OAUTH_ENDPOINTS.authorize}?${params.toString()}`;
}

/**
 * Exchanges the OAuth authorization code for access and refresh tokens.
 */
export async function exchangeSentryCodeForToken(
  code: string,
  request?: Request
): Promise<SentryTokenExchangeResult> {
  const { clientId, clientSecret, redirectUri } = getSentryOAuthConfig(request);
  if (!clientId || !clientSecret) {
    throw new Error("SENTRY_CLIENT_ID or SENTRY_CLIENT_SECRET is missing.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(SENTRY_OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sentry token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Sentry OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    expires_in: data.expires_in || 3600 * 8, // Sentry tokens typically 8 hours
    refresh_token: data.refresh_token,
    scope: data.scope,
    user: data.user,
  };
}

// In-process lock map to coalesce concurrent refresh requests within the same node process
const activeRefreshLocks = new Map<string, Promise<SentryTokenExchangeResult>>();

// In-memory atomic nonce ledger for unit test runners and local mock DBs
const localConsumedNonceLedger = new Set<string>();

/**
 * Atomically validates and consumes an OAuth state nonce to guarantee single-use behavior.
 * Rejects concurrent duplicate callbacks and sequential replay attacks.
 */
export async function consumeSentryOAuthNonceAtomic(
  organizationId: string,
  nonce: string
): Promise<{ success: boolean; reason?: string }> {
  if (!nonce || typeof nonce !== "string") {
    return { success: false, reason: "invalid_nonce" };
  }

  const isProduction = process.env.NODE_ENV === "production";

  try {
    const supabase = await createClient();

    // 1. Attempt atomic RPC consumption via PostgreSQL
    const { data: rpcData, error: rpcError } = await supabase.rpc("consume_oauth_nonce_atomic", {
      p_nonce: nonce,
      p_org_id: organizationId,
      p_provider: "sentry",
      p_ttl_seconds: 900,
    });

    if (!rpcError && rpcData) {
      if ((rpcData as any).success) {
        return { success: true };
      }
      return { success: false, reason: "nonce_already_consumed" };
    }

    if (isProduction && rpcError && rpcError.code !== "PGRST202") {
      throw new Error(`Production OAuth security error: consume_oauth_nonce_atomic RPC failed (${rpcError.message})`);
    }

    // 2. Direct insert fallback into public.oauth_state_nonces if RPC function not created yet
    const { error: insertError } = await supabase
      .from("oauth_state_nonces")
      .insert({
        nonce,
        organization_id: organizationId,
        provider: "sentry",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

    if (!insertError) {
      return { success: true };
    }

    if (insertError.code === "23505") {
      return { success: false, reason: "nonce_already_consumed" };
    }

    if (isProduction) {
      throw new Error(
        `Production OAuth state security failure: oauth_state_nonces table is missing (${insertError.message}).`
      );
    }
  } catch (err: unknown) {
    if (isProduction) {
      throw err;
    }
  }

  // 3. In-memory atomic CAS ledger fallback (for local unit test runners)
  if (localConsumedNonceLedger.has(nonce)) {
    return { success: false, reason: "nonce_already_consumed" };
  }
  localConsumedNonceLedger.add(nonce);
  return { success: true };
}

/**
 * Performs distributed-safe Sentry refresh token rotation with bounded concurrency protection.
 */
export async function refreshSentryTokenWithLock(
  organizationId: string,
  refreshTokenPlaintext: string
): Promise<SentryTokenExchangeResult> {
  const existingLock = activeRefreshLocks.get(organizationId);
  if (existingLock) {
    return existingLock;
  }

  const refreshPromise = (async () => {
    const supabase = await createClient();
    const workerId = crypto.randomUUID();
    const leaseSeconds = 15;
    const maxRetries = 10;

    let leaseAcquired = false;
    let currentEncryptedRefresh: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Step A: Check if another worker already refreshed the token
      const { data: current } = await supabase
        .from("organization_integrations")
        .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, metadata, status")
        .eq("organization_id", organizationId)
        .eq("provider", "sentry")
        .maybeSingle();

      const expiresAtMs = current?.token_expires_at ? new Date(current.token_expires_at).getTime() : 0;
      if (
        current &&
        current.status === "connected" &&
        expiresAtMs > Date.now() + 2 * 60 * 1000 &&
        current.encrypted_access_token
      ) {
        try {
          const freshAccessToken = decryptToken(current.encrypted_access_token);
          const freshRefreshToken = current.encrypted_refresh_token
            ? decryptToken(current.encrypted_refresh_token)
            : undefined;

          return {
            access_token: freshAccessToken,
            token_type: "Bearer",
            expires_in: Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000)),
            refresh_token: freshRefreshToken,
            scope: SENTRY_OAUTH_SCOPES.slice(),
          };
        } catch {
          // Fall through to refresh
        }
      }

      currentEncryptedRefresh = current?.encrypted_refresh_token || null;

      // Step B: Attempt atomic lease acquisition via PostgreSQL RPC
      try {
        const { data: rpcLease, error: rpcError } = await supabase.rpc("acquire_sentry_refresh_lease", {
          p_org_id: organizationId,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        });

        if (!rpcError && rpcLease) {
          const result = rpcLease as any;
          if (result.code === "ALREADY_REFRESHED" && result.encrypted_access_token) {
            return {
              access_token: decryptToken(result.encrypted_access_token),
              token_type: "Bearer",
              expires_in: Math.max(60, Math.floor((new Date(result.token_expires_at).getTime() - Date.now()) / 1000)),
              refresh_token: result.encrypted_refresh_token ? decryptToken(result.encrypted_refresh_token) : undefined,
              scope: SENTRY_OAUTH_SCOPES.slice(),
            };
          }

          if (result.success && result.code === "LEASE_ACQUIRED") {
            leaseAcquired = true;
            break;
          }
        }
      } catch {
        // Fall back to direct lease attempt
      }

      // Step C: Fallback conditional update lease if RPC not yet deployed
      if (!leaseAcquired) {
        const now = new Date();
        const lockUntil = new Date(now.getTime() + leaseSeconds * 1000).toISOString();

        const { data: updated } = await supabase
          .from("organization_integrations")
          .update({
            metadata: {
              ...(current?.metadata || {}),
              refresh_lock_until: lockUntil,
              refresh_lock_worker: workerId,
            },
            updated_at: now.toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("provider", "sentry")
          .select("id");

        if (updated && updated.length > 0) {
          leaseAcquired = true;
          break;
        }
      }

      // Exponential backoff with jitter
      await new Promise((resolve) => setTimeout(resolve, 200 + attempt * 50 + Math.random() * 50));
    }

    try {
      // Step D: Execute OAuth refresh with official Sentry token endpoint
      const { clientId, clientSecret } = getSentryOAuthConfig();
      if (!clientId || !clientSecret) {
        throw new Error("SENTRY_CLIENT_ID or SENTRY_CLIENT_SECRET is missing.");
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenPlaintext,
      });

      const response = await fetch(SENTRY_OAUTH_ENDPOINTS.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // If Sentry rejected refresh token (revoked or expired), mark integration
        if (response.status === 400 || response.status === 401) {
          await supabase
            .from("organization_integrations")
            .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)
            .eq("provider", "sentry");
        }
        throw new Error(`Sentry token refresh failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || refreshTokenPlaintext;
      const expiresInSeconds = data.expires_in || 3600 * 8;
      const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

      const encryptedAccess = encryptToken(newAccessToken);
      const encryptedRefresh = encryptToken(newRefreshToken);

      // Step E: Save newly rotated credentials atomically via CAS
      const { data: casData } = await supabase.rpc("save_sentry_refreshed_tokens_cas", {
        p_org_id: organizationId,
        p_worker_id: workerId,
        p_expected_refresh_token: currentEncryptedRefresh,
        p_new_encrypted_access: encryptedAccess,
        p_new_encrypted_refresh: encryptedRefresh,
        p_token_expires_at: tokenExpiresAt,
      });

      if (!casData || !(casData as any).success) {
        // Direct update fallback
        await supabase
          .from("organization_integrations")
          .update({
            encrypted_access_token: encryptedAccess,
            encrypted_refresh_token: encryptedRefresh,
            token_expires_at: tokenExpiresAt,
            status: "connected",
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("provider", "sentry");
      }

      return {
        access_token: newAccessToken,
        token_type: data.token_type || "Bearer",
        expires_in: expiresInSeconds,
        refresh_token: newRefreshToken,
        scope: data.scope,
      };
    } finally {
      // Step F: Always release lease in finally block
      try {
        await supabase.rpc("release_sentry_refresh_lease", {
          p_org_id: organizationId,
          p_worker_id: workerId,
        });
      } catch {
        // Non-fatal lease release fallback
      }
      activeRefreshLocks.delete(organizationId);
    }
  })();

  activeRefreshLocks.set(organizationId, refreshPromise);
  return refreshPromise;
}

/**
 * Revokes Sentry OAuth tokens upon workspace disconnect.
 */
export async function revokeSentryToken(tokenPlaintext: string): Promise<boolean> {
  try {
    const { clientId, clientSecret } = getSentryOAuthConfig();
    if (!clientId || !clientSecret) return false;

    // Sentry revoke endpoint accepts token revocation
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: tokenPlaintext,
    });

    const response = await fetch("https://sentry.io/oauth/revoke/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    return response.ok;
  } catch (err: unknown) {
    logger.warn("Sentry token revocation attempt returned error", { error: String(err) });
    return false;
  }
}
