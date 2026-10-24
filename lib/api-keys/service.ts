// ==============================================================================
// Company Brain: API Key Issuance, Hashing & Lifecycle Service
// Raw secret keys: cb_live_<32 hex chars> (Returned ONCE, never persisted)
// Database stores only: key_prefix (cb_live_xxxxxxxx) and key_hash (SHA-256)
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { OrganizationApiKey, CreateApiKeyResult, ApiKeyScope } from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Computes SHA-256 hex digest for API key lookup.
 */
export function hashApiKey(secretKey: string): string {
  return crypto.createHash("sha256").update(secretKey.trim(), "utf8").digest("hex");
}

/**
 * Generates a new cryptographically secure API key for an enterprise organization.
 */
export async function generateApiKey(
  organizationId: string,
  name: string,
  scopes: ApiKeyScope[],
  options?: {
    rateLimitPerMinute?: number;
    expiresInDays?: number;
    createdByUserId?: string;
  }
): Promise<CreateApiKeyResult> {
  const supabase = createServiceClient();

  // Generate 32 bytes (64 hex characters) of randomness
  const randomHex = crypto.randomBytes(32).toString("hex");
  const secretKey = `cb_live_${randomHex}`;
  const keyPrefix = secretKey.slice(0, 16); // e.g. cb_live_a1b2c3d4
  const keyHash = hashApiKey(secretKey);

  let expiresAt: string | null = null;
  if (options?.expiresInDays && options.expiresInDays > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + options.expiresInDays);
    expiresAt = expDate.toISOString();
  }

  const rateLimit = options?.rateLimitPerMinute || 60;

  const { data: record, error } = await supabase
    .from("organization_api_keys")
    .insert({
      organization_id: organizationId,
      name: name.trim(),
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      rate_limit_per_minute: rateLimit,
      created_by_user_id: options?.createdByUserId || null,
      expires_at: expiresAt,
    })
    .select(
      "id, organization_id, name, key_prefix, scopes, rate_limit_per_minute, created_by_user_id, expires_at, revoked_at, last_used_at, created_at, updated_at"
    )
    .single();

  if (error || !record) {
    logger.error("Failed to generate organization API key", error, { organizationId });
    throw new Error(`Failed to create API key: ${error?.message || "Database insert error"}`);
  }

  const apiKey: OrganizationApiKey = {
    id: record.id,
    organizationId: record.organization_id,
    name: record.name,
    keyPrefix: record.key_prefix,
    scopes: (record.scopes as ApiKeyScope[]) || [],
    rateLimitPerMinute: record.rate_limit_per_minute,
    createdByUserId: record.created_by_user_id,
    expiresAt: record.expires_at,
    revokedAt: record.revoked_at,
    lastUsedAt: record.last_used_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };

  return {
    apiKey,
    secretKey,
  };
}

/**
 * Lists all API keys for an organization (excluding key_hash).
 */
export async function listApiKeys(organizationId: string): Promise<OrganizationApiKey[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("organization_api_keys")
    .select(
      "id, organization_id, name, key_prefix, scopes, rate_limit_per_minute, created_by_user_id, expires_at, revoked_at, last_used_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((record) => ({
    id: record.id,
    organizationId: record.organization_id,
    name: record.name,
    keyPrefix: record.key_prefix,
    scopes: (record.scopes as ApiKeyScope[]) || [],
    rateLimitPerMinute: record.rate_limit_per_minute,
    createdByUserId: record.created_by_user_id,
    expiresAt: record.expires_at,
    revokedAt: record.revoked_at,
    lastUsedAt: record.last_used_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
}

/**
 * Revokes an organization API key immediately.
 */
export async function revokeApiKey(organizationId: string, keyId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("organization_api_keys")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("organization_id", organizationId);

  if (error) {
    logger.error("Failed to revoke API key", error, { keyId, organizationId });
    return false;
  }

  return true;
}
