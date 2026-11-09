// ==============================================================================
// KogSync: Multi-Tenant Shopify OAuth 2.0 Security, HMAC & Anti-Replay Engine
// ==============================================================================

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { signOAuthStatePayload, verifyOAuthStateSignature } from "@/lib/security/oauth-state";
import { getShopifyOAuthConfig, sanitizeShopDomain } from "./config";
import { ShopifyOAuthStatePayload, ShopifyTokenExchangeResult } from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Creates an HMAC-signed state parameter bound to organizationId, userId, and shop domain.
 * Signed strictly using the dedicated OAUTH_STATE_SECRET.
 */
export function createShopifyOAuthState(
  payload: Omit<ShopifyOAuthStatePayload, "nonce" | "timestamp">
): string {
  const cleanShop = sanitizeShopDomain(payload.shop);
  if (!cleanShop) {
    throw new Error(`Invalid Shopify store domain: ${payload.shop}`);
  }

  const fullPayload: ShopifyOAuthStatePayload = {
    ...payload,
    shop: cleanShop,
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
export function verifyShopifyOAuthState(state: string): ShopifyOAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    if (!verifyOAuthStateSignature(base64Data, signature)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr) as ShopifyOAuthStatePayload;

    // Reject state older than 15 minutes
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - payload.timestamp > fifteenMinutes) {
      return null;
    }

    if (!payload.organizationId || !payload.userId || !payload.shop || !payload.nonce) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies the official HMAC parameter provided by Shopify in callback requests.
 * Algorithm (RFC / Shopify Developer Spec):
 * 1. Extract `hmac` query parameter.
 * 2. Remove `hmac` and `signature` keys from query dictionary.
 * 3. Sort keys lexicographically.
 * 4. Join key-value pairs with '&' and '='.
 * 5. Compute HMAC-SHA256 hex digest using app client secret.
 * 6. Compare with timing-safe equality.
 */
export function verifyShopifyQueryHmac(
  query: URLSearchParams | Record<string, string>,
  clientSecret: string
): boolean {
  if (!clientSecret) return false;

  const entries: [string, string][] = [];
  let providedHmac = "";

  if (query instanceof URLSearchParams) {
    for (const [k, v] of query.entries()) {
      if (k === "hmac") {
        providedHmac = v;
      } else if (k !== "signature") {
        entries.push([k, v]);
      }
    }
  } else {
    for (const [k, v] of Object.entries(query)) {
      if (k === "hmac") {
        providedHmac = v;
      } else if (k !== "signature") {
        entries.push([k, v]);
      }
    }
  }

  if (!providedHmac) return false;

  // Lexicographical sort by key
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  const message = entries
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const calculatedHmac = crypto
    .createHmac("sha256", clientSecret)
    .update(message, "utf8")
    .digest("hex");

  try {
    const calcBuf = Buffer.from(calculatedHmac, "hex");
    const provBuf = Buffer.from(providedHmac, "hex");
    if (calcBuf.length !== provBuf.length) return false;
    return crypto.timingSafeEqual(calcBuf, provBuf);
  } catch {
    return false;
  }
}

/**
 * Generates the official Shopify OAuth authorization redirect URL.
 */
export function generateShopifyAuthUrl(options: {
  organizationId: string;
  userId: string;
  shop: string;
  returnUrl?: string;
  request?: Request;
}): string {
  const cleanShop = sanitizeShopDomain(options.shop);
  if (!cleanShop) {
    throw new Error("Invalid Shopify store domain. Must end in .myshopify.com");
  }

  const { clientId, redirectUri, scopes } = getShopifyOAuthConfig(options.request);
  if (!clientId) {
    throw new Error("SHOPIFY_API_KEY / SHOPIFY_CLIENT_ID environment variable is missing.");
  }

  const state = createShopifyOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    shop: cleanShop,
    returnUrl: options.returnUrl,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(","),
    redirect_uri: redirectUri,
    state,
  });

  return `https://${cleanShop}/admin/oauth/authorize?${params.toString()}`;
}

// In-memory atomic nonce ledger for unit test runners and local mock DBs
const localConsumedNonceLedger = new Set<string>();

/**
 * Atomically validates and consumes an OAuth state nonce to guarantee single-use behavior.
 * Rejects concurrent duplicate callbacks and sequential replay attacks.
 */
export async function consumeShopifyOAuthNonceAtomic(
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
      p_provider: "shopify",
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
        provider: "shopify",
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
 * Exchanges the OAuth authorization code for an offline merchant access token.
 */
export async function exchangeShopifyCodeForToken(
  shop: string,
  code: string,
  request?: Request
): Promise<ShopifyTokenExchangeResult> {
  const cleanShop = sanitizeShopDomain(shop);
  if (!cleanShop) {
    throw new Error("Invalid Shopify store domain.");
  }

  const { clientId, clientSecret } = getShopifyOAuthConfig(request);
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing.");
  }

  const tokenEndpoint = `https://${cleanShop}/admin/oauth/access_token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KogSync-Enterprise/1.0",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Shopify OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error("Shopify token exchange response did not contain an access_token.");
  }

  return {
    access_token: data.access_token,
    scope: data.scope || "",
    associated_user_scope: data.associated_user_scope,
    associated_user: data.associated_user,
  };
}
