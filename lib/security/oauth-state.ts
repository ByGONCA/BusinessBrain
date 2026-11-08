// ==============================================================================
// KogSync: Dedicated Canonical OAuth State Secret & Cryptographic Verification
// ==============================================================================

import crypto from "crypto";

/**
 * Resolves and validates the dedicated server-only OAUTH_STATE_SECRET.
 * Used exclusively for HMAC-SHA256 signature generation and constant-time
 * verification of OAuth 2.0 CSRF state parameters across all providers
 * (Linear, GitHub, Google, Microsoft, Slack, Stripe Connect).
 *
 * Security Invariants:
 * 1. Minimum 32 bytes of cryptographically secure secret material.
 * 2. Strictly mandatory in production (fail-closed, throws fatal error).
 * 3. ZERO fallback to STRIPE_SECRET_KEY, INTEGRATION_TOKEN_ENCRYPTION_KEY,
 *    or AI_CREDENTIALS_ENCRYPTION_KEY.
 * 4. Never exposed to browser bundles (strictly server-side, no NEXT_PUBLIC_).
 * 5. Deterministic fallback provided strictly for local development & test runners.
 */
export function getOAuthStateSecret(): string {
  const raw = process.env.OAUTH_STATE_SECRET?.trim();

  if (raw) {
    const list = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const primary = list[0];
    if (primary && primary.length >= 32) {
      return primary;
    }
    throw new Error(
      "OAUTH_STATE_SECRET is invalid: must contain at least 32 characters (256 bits) of cryptographic secret material."
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_STATE_SECRET is strictly required in production for OAuth state integrity."
    );
  }

  // Deterministic 32-byte secret strictly for local non-production development
  return "kogsync-default-dev-oauth-state-secret-32b-min!";
}

/**
 * Resolves all valid secrets for verifying inbound OAuth state signatures.
 * Supports zero-downtime secret rotation by accepting comma-separated secrets.
 */
export function getOAuthStateVerificationSecrets(): string[] {
  const raw = process.env.OAUTH_STATE_SECRET?.trim();

  if (raw) {
    const list = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) {
      for (const s of list) {
        if (s.length < 32 && process.env.NODE_ENV === "production") {
          throw new Error(
            "OAUTH_STATE_SECRET candidate is invalid: must contain at least 32 characters."
          );
        }
      }
      return list;
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_STATE_SECRET is strictly required in production for OAuth state integrity."
    );
  }

  return ["kogsync-default-dev-oauth-state-secret-32b-min!"];
}

/**
 * Computes an HMAC-SHA256 signature for a state payload string using OAUTH_STATE_SECRET.
 */
export function signOAuthStatePayload(serializedPayload: string): string {
  const secret = getOAuthStateSecret();
  return crypto.createHmac("sha256", secret).update(serializedPayload).digest("base64url");
}

/**
 * Verifies an HMAC-SHA256 signature using timing-safe comparison.
 * Evaluates candidate secrets sequentially to support zero-downtime rotation.
 */
export function verifyOAuthStateSignature(
  serializedPayload: string,
  providedSignature: string
): boolean {
  try {
    const secrets = getOAuthStateVerificationSecrets();
    const sigBuf = Buffer.from(providedSignature);

    for (const secret of secrets) {
      const expectedSignature = crypto.createHmac("sha256", secret).update(serializedPayload).digest("base64url");
      const expBuf = Buffer.from(expectedSignature);

      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
