import { headers } from "next/headers";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "./logger";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  failClosed?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  degraded?: boolean;
}

export const RATE_LIMIT_PRESETS = {
  // Strict auth actions (login, reset password) — fail-closed to prevent brute force on DB outage
  AUTH_STRICT: { limit: 5, windowSeconds: 60, failClosed: true },
  // Account signup
  SIGNUP: { limit: 5, windowSeconds: 3600, failClosed: false },
  // Integration connection/callbacks
  INTEGRATIONS: { limit: 15, windowSeconds: 60, failClosed: false },
  // Sensitive write mutations (create org, checkout, upload auth)
  MUTATIONS: { limit: 10, windowSeconds: 60, failClosed: false },
  // Standard API endpoints
  API_STANDARD: { limit: 60, windowSeconds: 60, failClosed: false },
} as const;

// In-memory sliding window fallback for environments without DB connectivity or transient DB degradation
// NOTE ON SERVERLESS ENVIRONMENTS (e.g. Vercel):
// In-memory rate limiting is isolated per serverless execution instance.
// Multiple concurrent requests routed to separate lambdas will each maintain their own memory store.
// Distributed rate limiting relies on PostgreSQL check_rate_limit RPC for cross-instance consistency.
const memoryStore = new Map<string, { points: number; resetAt: number }>();

function checkInMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const resetMs = windowSeconds * 1000;
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { points: 1, resetAt: now + resetMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetSeconds: windowSeconds,
      degraded: true,
    };
  }

  entry.points += 1;
  const remaining = Math.max(0, limit - entry.points);
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

  return {
    success: entry.points <= limit,
    limit,
    remaining,
    resetSeconds,
    degraded: true,
  };
}

/**
 * Resolves a reliable client IP from standard reverse proxy headers.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      // Use the first IP in the comma-separated X-Forwarded-For list
      const ips = forwardedFor.split(",");
      const firstIp = ips[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = headerList.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = headerList.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  } catch {
    // If called outside of a request context, return fallback
  }

  return "127.0.0.1";
}

/**
 * Resolves the server secret used exclusively for signing rate-limit tokens.
 * In production: INTERNAL_RATE_LIMIT_SECRET is strictly required.
 * If absent in production, returns null to fail securely without using dev secrets.
 * In non-production (development/test): falls back to a controlled local secret.
 */
export function getRateLimitServerSecret(): string | null {
  const secret = process.env.INTERNAL_RATE_LIMIT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    logger.error("Rate limiting misconfiguration: INTERNAL_RATE_LIMIT_SECRET is not configured in production");
    return null;
  }

  return "company-brain-rate-limit-dev-key";
}

/**
 * Generates a cryptographically signed, timestamped server token for check_rate_limit RPC.
 * Format: `<unix_epoch_seconds>.<sha256_hmac_hex>`
 * Binds key, limit, windowSeconds, and timestamp to prevent replay and parameter tampering.
 * Relies exclusively on INTERNAL_RATE_LIMIT_SECRET.
 */
export function generateRateLimitServerToken(
  key: string,
  limit: number,
  windowSeconds: number,
  timestamp?: number
): string {
  const secret = getRateLimitServerSecret();
  if (!secret) {
    throw new Error("INTERNAL_RATE_LIMIT_SECRET is not configured");
  }

  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const message = `${key}:${limit}:${windowSeconds}:${ts}`;
  const sig = crypto.createHmac("sha256", secret).update(message).digest("hex");

  return `${ts}.${sig}`;
}

/**
 * Sanitizes a rate limit key for diagnostic logging without exposing PII (e.g. emails, full IPs).
 */
function sanitizeKeyForLog(key: string): string {
  const parts = key.split(":");
  if (parts.length <= 2) return key;
  const identifier = parts.slice(2).join(":");
  // Hash the identifier to prevent PII leakage in logs
  const hash = crypto.createHash("sha256").update(identifier).digest("hex").substring(0, 8);
  return `${parts[0]}:${parts[1]}:anon-${hash}`;
}

/**
 * Checks and updates the rate limit counter for a given key.
 * Uses atomic Supabase PostgreSQL RPC (serverless compatible across Vercel instances).
 * Protected with a cryptographic server token so untrusted clients cannot invoke it directly.
 * Handles fail-open vs fail-closed policies appropriately for sensitive vs standard endpoints.
 */
export async function rateLimit(
  namespace: string,
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.API_STANDARD
): Promise<RateLimitResult> {
  // Key format: rl:{namespace}:{identifier}
  const cleanId = identifier.replace(/[^a-zA-Z0-9_\-\.:@]/g, "_");
  const key = `rl:${namespace}:${cleanId}`.substring(0, 255);
  const { limit, windowSeconds, failClosed = false } = config;

  try {
    const supabase = createServiceClient();
    const serverToken = generateRateLimitServerToken(key, limit, windowSeconds);

    const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_server_token: serverToken,
    });

    if (error) {
      const sanitizedKey = sanitizeKeyForLog(key);
      logger.warn("PostgreSQL check_rate_limit failed; evaluating failure policy", {
        key: sanitizedKey,
        code: error.code,
        message: error.message,
        failClosed,
      });

      if (failClosed) {
        // Strict fail-closed policy: block sensitive operations if central rate limiter is down
        return {
          success: false,
          limit,
          remaining: 0,
          resetSeconds: windowSeconds,
          degraded: true,
        };
      }

      // Fail-open policy: fall back to localized in-memory rate limiting
      return checkInMemoryRateLimit(key, limit, windowSeconds);
    }

    return {
      success: allowed === true,
      limit,
      remaining: allowed ? 1 : 0,
      resetSeconds: windowSeconds,
      degraded: false,
    };
  } catch (err: unknown) {
    const sanitizedKey = sanitizeKeyForLog(key);
    logger.warn("Rate limit exception; evaluating failure policy", {
      key: sanitizedKey,
      error: err instanceof Error ? err.message : String(err),
      failClosed,
    });

    if (failClosed) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetSeconds: windowSeconds,
        degraded: true,
      };
    }

    return checkInMemoryRateLimit(key, limit, windowSeconds);
  }
}
