// ==============================================================================
// Company Brain: Public API Key Authentication Middleware & Scope Guard
// Authenticates Bearer tokens, validates scopes, and applies rate limiting headers
// ==============================================================================

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "./service";
import { hasScope } from "./scopes";
import { ApiKeyAuthContext, ApiKeyScope } from "./types";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "./feature-flag";

export interface ApiAuthSuccess {
  authenticated: true;
  context: ApiKeyAuthContext;
  headers: Record<string, string>;
}

export interface ApiAuthFailure {
  authenticated: false;
  response: NextResponse;
}

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

/**
 * Authenticates an incoming Enterprise Public API HTTP request.
 */
export async function authenticateApiKey(
  req: Request,
  requiredScope?: ApiKeyScope
): Promise<ApiAuthResult> {
  // If Enterprise Public API is disabled by feature flag, reject immediately with 404
  if (!isPublicApiEnabled()) {
    return {
      authenticated: false,
      response: publicApiUnavailableResponse(),
    };
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
          message: "Missing or malformed Authorization header. Expected 'Bearer cb_live_...'",
        },
        { status: 401 }
      ),
    };
  }

  const rawKey = authHeader.slice(7).trim();

  if (!rawKey.startsWith("cb_live_") || rawKey.length < 24) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid API key format. Expected 'cb_live_<key>'",
        },
        { status: 401 }
      ),
    };
  }

  const keyHash = hashApiKey(rawKey);
  const supabase = createServiceClient();

  // Try calling the validate_api_key RPC
  let authRecord: {
    valid: boolean;
    key_id: string;
    organization_id: string;
    organization_name: string;
    scopes: string[];
    rate_limit_per_minute: number;
    error_code?: string;
  } | null = null;

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("validate_api_key", {
      p_key_hash: keyHash,
    });

    if (!rpcErr && rpcData && rpcData.length > 0) {
      authRecord = rpcData[0];
    }
  } catch (err) {
    logger.warn("validate_api_key RPC call failed, falling back to direct table lookup", { err });
  }

  // Fallback to direct table query if RPC is unavailable
  if (!authRecord) {
    const { data: directKey } = await supabase
      .from("organization_api_keys")
      .select("id, organization_id, scopes, rate_limit_per_minute, expires_at, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!directKey) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Unauthorized", message: "API key not found or invalid." },
          { status: 401 }
        ),
      };
    }

    if (directKey.revoked_at) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Unauthorized", message: "API key has been revoked." },
          { status: 401 }
        ),
      };
    }

    if (directKey.expires_at && new Date(directKey.expires_at).getTime() <= Date.now()) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Unauthorized", message: "API key has expired." },
          { status: 401 }
        ),
      };
    }

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", directKey.organization_id)
      .single();

    authRecord = {
      valid: true,
      key_id: directKey.id,
      organization_id: directKey.organization_id,
      organization_name: org?.name || "Organization",
      scopes: directKey.scopes || [],
      rate_limit_per_minute: directKey.rate_limit_per_minute || 60,
    };

    // Update last_used_at
    await supabase
      .from("organization_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", directKey.id);
  }

  if (!authRecord.valid) {
    const errorMsg =
      authRecord.error_code === "key_revoked"
        ? "API key has been revoked."
        : authRecord.error_code === "key_expired"
        ? "API key has expired."
        : "Invalid API key.";

    return {
      authenticated: false,
      response: NextResponse.json({ error: "Unauthorized", message: errorMsg }, { status: 401 }),
    };
  }

  const grantedScopes = (authRecord.scopes as ApiKeyScope[]) || [];

  // Verify scope requirements
  if (requiredScope && !hasScope(grantedScopes, requiredScope)) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: "Forbidden",
          message: `Insufficient scope. Missing required scope: '${requiredScope}'`,
          grantedScopes,
        },
        { status: 403 }
      ),
    };
  }

  // Check Rate Limits (via centralized PostgreSQL check_rate_limit RPC with in-memory fallback)
  const rl = await rateLimit("api_key", authRecord.key_id, {
    limit: authRecord.rate_limit_per_minute || 60,
    windowSeconds: 60,
    failClosed: false,
  });

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.resetSeconds),
  };

  if (!rl.success) {
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: "Too Many Requests",
          message: "API rate limit exceeded. Please retry after reset.",
        },
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      ),
    };
  }

  return {
    authenticated: true,
    context: {
      keyId: authRecord.key_id,
      organizationId: authRecord.organization_id,
      organizationName: authRecord.organization_name,
      scopes: grantedScopes,
      rateLimitPerMinute: authRecord.rate_limit_per_minute || 60,
    },
    headers: rateLimitHeaders,
  };
}
