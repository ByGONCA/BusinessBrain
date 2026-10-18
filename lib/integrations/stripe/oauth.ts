import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/security/logger";

const OAUTH_STATE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const STRIPE_CONNECT_AUTHORIZE_URL = "https://connect.stripe.com/oauth/authorize";
const STRIPE_CONNECT_TOKEN_URL = "https://connect.stripe.com/oauth/token";
const STRIPE_CONNECT_DEAUTHORIZE_URL = "https://connect.stripe.com/oauth/deauthorize";

export interface StripeOAuthStatePayload {
  organizationId: string;
  userId: string;
  nonce: string;
  timestamp: number;
  expiresAt: number;
  returnUrl: string;
}

export interface StripeTokenResponse {
  stripe_user_id: string; // The connected account ID (e.g. acct_1234567890)
  access_token: string;
  refresh_token?: string;
  scope: string;
  livemode: boolean;
  token_type: string;
}

function getSigningSecret(): string {
  const secret = process.env.SERVER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SERVER_AUTH_SECRET is required in production for Stripe OAuth signing.");
    }
    return "dev-stripe-connect-hmac-secret-fallback-key";
  }
  return secret;
}

/**
 * Computes a constant-time HMAC-SHA256 signature for a state payload.
 */
function signPayload(payloadString: string): string {
  const hmac = crypto.createHmac("sha256", getSigningSecret());
  hmac.update(payloadString);
  return hmac.digest("base64url");
}

/**
 * Generates the secure Stripe Connect Standard OAuth authorization URL with signed state.
 * Scope is strictly 'read_only' for least privilege.
 */
export async function generateStripeConnectAuthUrl(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  returnUrl?: string;
  redirectUri?: string;
}): Promise<string> {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "STRIPE_CONNECT_CLIENT_ID is not configured. Please set it in your environment variables."
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const now = Date.now();
  const expiresAt = now + OAUTH_STATE_EXPIRY_MS;
  const safeReturnUrl = params.returnUrl || "/dashboard?settings=integrations";

  const statePayload: StripeOAuthStatePayload = {
    organizationId: params.organizationId,
    userId: params.userId,
    nonce,
    timestamp: now,
    expiresAt,
    returnUrl: safeReturnUrl,
  };

  const payloadString = JSON.stringify(statePayload);
  const signature = signPayload(payloadString);
  const stateToken = Buffer.from(payloadString, "utf8").toString("base64url") + "." + signature;

  // Record nonce in the database ledger to enforce single-use / anti-replay
  const { error: ledgerError } = await params.supabase.from("oauth_nonce_ledger").insert({
    organization_id: params.organizationId,
    nonce,
    provider: "stripe",
    created_by_user_id: params.userId,
    expires_at: new Date(expiresAt).toISOString(),
  });

  if (ledgerError) {
    logger.error("Failed to persist OAuth nonce in ledger", ledgerError, {
      organizationId: params.organizationId,
      userId: params.userId,
    });
    throw new Error("Failed to initialize secure OAuth state.");
  }

  const url = new URL(STRIPE_CONNECT_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("state", stateToken);

  if (params.redirectUri) {
    url.searchParams.set("redirect_uri", params.redirectUri);
  }

  return url.toString();
}

/**
 * Validates the HMAC signature and expiration of a Stripe OAuth state parameter.
 */
export function verifyStripeOAuthState(stateToken: string): StripeOAuthStatePayload | null {
  if (!stateToken || typeof stateToken !== "string") {
    return null;
  }

  const parts = stateToken.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const payloadString = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSignature = signPayload(payloadString);

    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedSigBuffer = Buffer.from(expectedSignature, "utf8");

    if (sigBuffer.length !== expectedSigBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
      return null;
    }

    const payload = JSON.parse(payloadString) as StripeOAuthStatePayload;

    if (
      !payload.organizationId ||
      !payload.userId ||
      !payload.nonce ||
      !payload.expiresAt ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    // Verify expiration
    if (Date.now() > payload.expiresAt) {
      logger.warn("Stripe OAuth state expired", {
        expiresAt: payload.expiresAt,
        now: Date.now(),
      });
      return null;
    }

    return payload;
  } catch (err) {
    logger.warn("Failed to parse or verify Stripe OAuth state token", { err });
    return null;
  }
}

/**
 * Validates and marks an OAuth nonce as consumed.
 * Returns true if valid and consumed; false if non-existent, expired, or already used (anti-replay).
 */
export async function consumeOAuthNonce(
  supabase: SupabaseClient,
  nonce: string,
  organizationId: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  // Atomically claim the nonce where not consumed and not expired
  const { data, error } = await supabase
    .from("oauth_nonce_ledger")
    .update({ consumed_at: nowIso })
    .eq("provider", "stripe")
    .eq("nonce", nonce)
    .eq("organization_id", organizationId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("id");

  if (error || !data || data.length === 0) {
    logger.warn("OAuth nonce consumption failed or replay detected", {
      nonce,
      organizationId,
      error,
    });
    return false;
  }

  return true;
}

/**
 * Exchanges the Stripe authorization code for access tokens via standard POST.
 */
export async function exchangeStripeConnectCode(
  code: string,
  options?: { redirectUri?: string }
): Promise<StripeTokenResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const bodyParams = new URLSearchParams({
    client_secret: secretKey,
    code,
    grant_type: "authorization_code",
  });

  if (clientId) {
    bodyParams.set("client_id", clientId);
  }

  if (options?.redirectUri) {
    bodyParams.set("redirect_uri", options.redirectUri);
  }

  const res = await fetch(STRIPE_CONNECT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: bodyParams.toString(),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const diagnosticId = `str_tok_${crypto.randomBytes(4).toString("hex")}`;
    const errorMsg = data.error_description || data.error || `HTTP ${res.status}`;

    // Safely log status, error category and correlation ID without leaking tokens or client secrets
    logger.error("Failed to exchange Stripe Connect authorization code", {
      diagnosticId,
      status: res.status,
      stripeError: data.error,
      stripeErrorDescription: data.error_description,
      hasClientId: Boolean(clientId),
      hasRedirectUri: Boolean(options?.redirectUri),
    });

    const tokenErr = new Error(`Stripe OAuth token exchange failed: ${errorMsg}`);
    (tokenErr as unknown as { diagnosticId: string; stripeError?: string }).diagnosticId = diagnosticId;
    (tokenErr as unknown as { diagnosticId: string; stripeError?: string }).stripeError = data.error;
    throw tokenErr;
  }

  return data as StripeTokenResponse;
}

/**
 * Revokes connected account authorization via Stripe's official /oauth/deauthorize endpoint.
 */
export async function revokeStripeConnectAccess(connectedAccountId: string): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  if (!secretKey || !clientId) {
    logger.warn("Cannot deauthorize Stripe account: missing STRIPE_SECRET_KEY or STRIPE_CONNECT_CLIENT_ID");
    return { success: false, error: "Missing Stripe credentials in configuration." };
  }

  try {
    const bodyParams = new URLSearchParams({
      client_secret: secretKey,
      stripe_user_id: connectedAccountId,
      client_id: clientId,
    });

    const res = await fetch(STRIPE_CONNECT_DEAUTHORIZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyParams.toString(),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errorMsg = data.error_description || data.error || `HTTP ${res.status}`;
      logger.error("Stripe deauthorization endpoint returned error", {
        status: res.status,
        error: data.error,
        description: data.error_description,
        connectedAccountId,
      });
      return { success: false, error: errorMsg };
    }

    logger.info("Successfully deauthorized Stripe connected account", { connectedAccountId });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error during Stripe deauthorization.";
    logger.error("Failed to execute Stripe deauthorization request", err, { connectedAccountId });
    return { success: false, error: message };
  }
}
