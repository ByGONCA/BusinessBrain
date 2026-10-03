import { headers } from "next/headers";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "./logger";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export const RATE_LIMIT_PRESETS = {
  // Strict auth actions (login, reset password)
  AUTH_STRICT: { limit: 5, windowSeconds: 60 },
  // Account signup
  SIGNUP: { limit: 5, windowSeconds: 3600 },
  // Integration connection/callbacks
  INTEGRATIONS: { limit: 15, windowSeconds: 60 },
  // Sensitive write mutations (create org, checkout)
  MUTATIONS: { limit: 10, windowSeconds: 60 },
  // Standard API endpoints
  API_STANDARD: { limit: 60, windowSeconds: 60 },
} as const;

// In-memory sliding window fallback for environments without DB connectivity
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

function getRateLimitServerToken(key: string): string {
  const secret =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    "company-brain-rate-limit-internal-key";

  return crypto.createHmac("sha256", secret).update(`rl:${key}`).digest("hex");
}

/**
 * Checks and updates the rate limit counter for a given key.
 * Uses atomic Supabase PostgreSQL RPC (serverless compatible across Vercel instances).
 * Protected with a cryptographic server token so untrusted clients cannot invoke it.
 * Gracefully falls back to local in-memory sliding window if DB RPC is unavailable.
 */
export async function rateLimit(
  namespace: string,
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.API_STANDARD
): Promise<RateLimitResult> {
  const key = `rl:${namespace}:${identifier}`;
  const { limit, windowSeconds } = config;

  try {
    const supabase = createServiceClient();
    const serverToken = getRateLimitServerToken(key);

    const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_server_token: serverToken,
    });

    if (error) {
      // If RPC is not installed or fails, log warning and use in-memory fallback
      logger.warn("PostgreSQL check_rate_limit failed; falling back to in-memory store", {
        error: error.message,
      });
      return checkInMemoryRateLimit(key, limit, windowSeconds);
    }

    return {
      success: allowed === true,
      limit,
      remaining: allowed ? 1 : 0,
      resetSeconds: windowSeconds,
    };
  } catch (err: unknown) {
    logger.warn("Rate limit exception; falling back to in-memory store", {
      error: err instanceof Error ? err.message : String(err),
    });
    return checkInMemoryRateLimit(key, limit, windowSeconds);
  }
}
