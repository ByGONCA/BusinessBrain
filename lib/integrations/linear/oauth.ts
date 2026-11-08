// ==============================================================================
// KogSync: Linear OAuth 2.0 Security, Token Rotation & Concurrency Manager
// ==============================================================================

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/encryption";
import { signOAuthStatePayload, verifyOAuthStateSignature } from "@/lib/security/oauth-state";
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

/**
 * Creates an HMAC-signed state parameter with nonce and timestamp to prevent CSRF attacks.
 * Signed strictly using the dedicated OAUTH_STATE_SECRET.
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
  const signature = signOAuthStatePayload(base64Data);

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed OAuth state parameter using timing-safe comparison.
 * Verified strictly using the dedicated OAUTH_STATE_SECRET.
 * Strictly rejects states older than 15 minutes to prevent replay attacks.
 */
export function verifyLinearOAuthState(state: string): LinearAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    if (!verifyOAuthStateSignature(base64Data, signature)) {
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

// In-process lock map to coalesce concurrent refresh requests within the same node process
const activeRefreshLocks = new Map<string, Promise<LinearTokenExchangeResult>>();

// In-memory atomic nonce ledger for unit test runners and local mock DBs
const localConsumedNonceLedger = new Set<string>();

/**
 * Atomically validates and consumes an OAuth state nonce to guarantee single-use behavior.
 * Enforces atomic single-use protection across distributed serverless instances via PostgreSQL,
 * with graceful in-memory atomic fallback for local mock testing.
 * Rejects concurrent duplicate callbacks and sequential replay attacks.
 */
export async function consumeLinearOAuthNonceAtomic(
  organizationId: string,
  nonce: string
): Promise<{ success: boolean; reason?: string }> {
  if (!nonce || typeof nonce !== "string") {
    return { success: false, reason: "invalid_nonce" };
  }

  const isProduction = process.env.NODE_ENV === "production";

  try {
    const supabase = await createClient();

    // 1. Attempt atomic RPC consumption via PostgreSQL primary key constraint (00045)
    const { data: rpcData, error: rpcError } = await supabase.rpc("consume_oauth_nonce_atomic", {
      p_nonce: nonce,
      p_org_id: organizationId,
      p_provider: "linear",
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
        provider: "linear",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

    if (!insertError) {
      return { success: true };
    }

    // If PostgreSQL reports unique constraint violation (code 23505), nonce is replayed
    if (insertError.code === "23505") {
      return { success: false, reason: "nonce_already_consumed" };
    }

    if (isProduction) {
      throw new Error(
        `Production OAuth state security failure: oauth_state_nonces table is missing or inaccessible (${insertError.message}). Migration 00045 is required.`
      );
    }
  } catch (err: any) {
    if (isProduction) {
      throw err;
    }
    // Fall through to in-memory atomic ledger in development/test only
  }

  // 3. In-memory atomic CAS ledger fallback (strictly for development and test runners)
  if (localConsumedNonceLedger.has(nonce)) {
    return { success: false, reason: "nonce_already_consumed" };
  }
  localConsumedNonceLedger.add(nonce);
  return { success: true };
}

/**
 * Performs distributed-safe Linear refresh token rotation with bounded concurrency protection.
 * 1. Checks in-process lock map (local optimization).
 * 2. Checks database for recently refreshed tokens (if another distributed worker already refreshed).
 * 3. Acquires an atomic database lease (RPC or conditional update with worker ID).
 * 4. Bounded wait loop with lease crash recovery (15-second TTL).
 * 5. Guards against false `needs_reauth` if a concurrent worker refreshed successfully.
 * 6. Guarantees atomic rotation so stale tokens cannot overwrite newer credentials (OCC).
 * 7. Releases lease strictly owned by this worker in finally block.
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
    const supabase = await createClient();
    const workerId = crypto.randomUUID();
    const leaseSeconds = 15;
    const maxRetries = 10; // 10 * 500ms = max 5.0 seconds bounded wait

    let leaseAcquired = false;
    let currentEncryptedRefresh: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Step A: Check if another worker already refreshed the token
      const { data: current } = await supabase
        .from("organization_integrations")
        .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, metadata, status")
        .eq("organization_id", organizationId)
        .eq("provider", "linear")
        .maybeSingle();

      const expiresAtMs = current?.token_expires_at ? new Date(current.token_expires_at).getTime() : 0;
      if (current && current.status === "connected" && expiresAtMs > Date.now() + 2 * 60 * 1000 && current.encrypted_access_token) {
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
            scope: ["read"],
          };
        } catch {
          // If decryption fails, continue to refresh
        }
      }

      currentEncryptedRefresh = current?.encrypted_refresh_token || null;

      // Step B: Attempt atomic lease acquisition via PostgreSQL RPC
      try {
        const { data: rpcLease, error: rpcError } = await supabase.rpc("acquire_linear_refresh_lease", {
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
              scope: ["read"],
            };
          }

          if (result.success && result.code === "LEASE_ACQUIRED") {
            leaseAcquired = true;
            break;
          }
        } else if (process.env.NODE_ENV === "production" && rpcError) {
          throw new Error(
            `Production distributed refresh error: acquire_linear_refresh_lease RPC failed (${rpcError.message}). Migration 00045 must be applied.`
          );
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === "production") {
          throw err;
        }
        // Fallback to conditional update if RPC not present in development/test only
      }

      // Non-production fallback: conditional metadata update if RPC is unavailable
      if (!leaseAcquired && process.env.NODE_ENV !== "production") {
        const meta = (current?.metadata as Record<string, unknown>) || {};
        const lockUntil = meta.refresh_lock_until ? new Date(meta.refresh_lock_until as string).getTime() : 0;
        const lockWorker = meta.refresh_lock_worker as string | undefined;

        if (lockUntil <= Date.now() || lockWorker === workerId) {
          // Lease is free or expired: acquire it conditionally
          const newMeta = {
            ...meta,
            refresh_lock_until: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
            refresh_lock_worker: workerId,
          };

          const { error: leaseError } = await supabase
            .from("organization_integrations")
            .update({ metadata: newMeta, updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)
            .eq("provider", "linear");

          if (!leaseError) {
            leaseAcquired = true;
            break;
          }
        }
      }

      // Wait 500ms before next retry attempt
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!leaseAcquired) {
      // Re-read DB one final time to see if peer worker finished during our wait
      const { data: finalCheck } = await supabase
        .from("organization_integrations")
        .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, status")
        .eq("organization_id", organizationId)
        .eq("provider", "linear")
        .maybeSingle();

      const finalExpiresMs = finalCheck?.token_expires_at ? new Date(finalCheck.token_expires_at).getTime() : 0;
      if (finalCheck && finalCheck.status === "connected" && finalExpiresMs > Date.now() + 2 * 60 * 1000 && finalCheck.encrypted_access_token) {
        return {
          access_token: decryptToken(finalCheck.encrypted_access_token),
          token_type: "Bearer",
          expires_in: Math.max(60, Math.floor((finalExpiresMs - Date.now()) / 1000)),
          refresh_token: finalCheck.encrypted_refresh_token ? decryptToken(finalCheck.encrypted_refresh_token) : undefined,
          scope: ["read"],
        };
      }

      throw new Error("Unable to acquire Linear token refresh lease: concurrent worker timeout.");
    }

    try {
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

        // Check whether a peer worker succeeded while our request was in flight
        const { data: peerCheck } = await supabase
          .from("organization_integrations")
          .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, status")
          .eq("organization_id", organizationId)
          .eq("provider", "linear")
          .maybeSingle();

        const peerExpiresMs = peerCheck?.token_expires_at ? new Date(peerCheck.token_expires_at).getTime() : 0;
        if (peerCheck && peerCheck.status === "connected" && peerExpiresMs > Date.now() + 2 * 60 * 1000 && peerCheck.encrypted_access_token) {
          return {
            access_token: decryptToken(peerCheck.encrypted_access_token),
            token_type: "Bearer",
            expires_in: Math.max(60, Math.floor((peerExpiresMs - Date.now()) / 1000)),
            refresh_token: peerCheck.encrypted_refresh_token ? decryptToken(peerCheck.encrypted_refresh_token) : undefined,
            scope: ["read"],
          };
        }

        // Genuine authentication failure: mark needs_reauth
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

      const newEncryptedAccess = encryptToken(result.access_token);
      const newEncryptedRefresh = result.refresh_token ? encryptToken(result.refresh_token) : undefined;
      const tokenExpiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();

      // Step C: Atomically commit rotated tokens with OCC
      try {
        const { data: casData, error: casError } = await supabase.rpc("save_linear_refreshed_tokens_cas", {
          p_org_id: organizationId,
          p_worker_id: workerId,
          p_expected_refresh_token: currentEncryptedRefresh,
          p_new_encrypted_access: newEncryptedAccess,
          p_new_encrypted_refresh: newEncryptedRefresh || null,
          p_token_expires_at: tokenExpiresAt,
        });

        if (!casError && casData) {
          if ((casData as any)?.code === "STALE_OVERWRITE_PREVENTED") {
            // Another worker updated newer credentials in the meantime; retrieve and return peer's token
            const { data: latest } = await supabase
              .from("organization_integrations")
              .select("encrypted_access_token, encrypted_refresh_token, token_expires_at")
              .eq("organization_id", organizationId)
              .eq("provider", "linear")
              .single();

            if (latest?.encrypted_access_token) {
              return {
                access_token: decryptToken(latest.encrypted_access_token),
                token_type: "Bearer",
                expires_in: 3600,
                refresh_token: latest.encrypted_refresh_token ? decryptToken(latest.encrypted_refresh_token) : undefined,
                scope: ["read"],
              };
            }
          }
          return result;
        }

        if (process.env.NODE_ENV === "production" && casError) {
          throw new Error(
            `Production token persistence error: save_linear_refreshed_tokens_cas RPC failed (${casError.message}). Migration 00045 must be applied.`
          );
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === "production") {
          throw err;
        }
        // Fallback conditional update in development/test only
      }

      // Direct fallback conditional update if RPC not present
      const { data: latestRow } = await supabase
        .from("organization_integrations")
        .select("metadata")
        .eq("organization_id", organizationId)
        .eq("provider", "linear")
        .maybeSingle();

      const meta = { ...((latestRow?.metadata as Record<string, unknown>) || {}) };
      delete meta.refresh_lock_until;
      delete meta.refresh_lock_worker;

      const updatePayload: Record<string, unknown> = {
        encrypted_access_token: newEncryptedAccess,
        token_expires_at: tokenExpiresAt,
        metadata: meta,
        status: "connected",
        updated_at: new Date().toISOString(),
      };

      if (newEncryptedRefresh) {
        updatePayload.encrypted_refresh_token = newEncryptedRefresh;
      }

      let saveQuery = supabase
        .from("organization_integrations")
        .update(updatePayload)
        .eq("organization_id", organizationId)
        .eq("provider", "linear");

      if (currentEncryptedRefresh) {
        saveQuery = saveQuery.eq("encrypted_refresh_token", currentEncryptedRefresh);
      }

      await saveQuery;

      return result;
    } finally {
      // Step D: Safely release lease owned by this worker
      try {
        await supabase.rpc("release_linear_refresh_lease", {
          p_org_id: organizationId,
          p_worker_id: workerId,
        });
      } catch {
        // Fallback release if RPC not present
        const { data: row } = await supabase
          .from("organization_integrations")
          .select("metadata")
          .eq("organization_id", organizationId)
          .eq("provider", "linear")
          .maybeSingle();

        const currentMeta = (row?.metadata as Record<string, unknown>) || {};
        if (currentMeta.refresh_lock_worker === workerId) {
          delete currentMeta.refresh_lock_until;
          delete currentMeta.refresh_lock_worker;
          await supabase
            .from("organization_integrations")
            .update({ metadata: currentMeta })
            .eq("organization_id", organizationId)
            .eq("provider", "linear");
        }
      }
    }
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
