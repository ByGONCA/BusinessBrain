import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/security/logger";

const OAUTH_NONCE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Records a single-use OAuth state nonce in the database ledger to prevent replay attacks.
 */
export async function recordOAuthNonce(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  provider: string,
  nonce: string
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + OAUTH_NONCE_EXPIRY_MS).toISOString();
  const { error } = await supabase.from("oauth_nonce_ledger").insert({
    organization_id: organizationId,
    nonce,
    provider,
    created_by_user_id: userId,
    expires_at: expiresAt,
  });

  if (error) {
    logger.warn("Failed to record OAuth nonce in ledger", {
      provider,
      nonce,
      organizationId,
      error,
    });
    return false;
  }
  return true;
}

/**
 * Atomically validates and consumes an OAuth state nonce.
 * Returns true if valid and consumed; false if non-existent, expired, or already used (replay).
 */
export async function consumeOAuthNonce(
  supabase: SupabaseClient,
  organizationId: string,
  provider: string,
  nonce: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("oauth_nonce_ledger")
    .update({ consumed_at: nowIso })
    .eq("provider", provider)
    .eq("nonce", nonce)
    .eq("organization_id", organizationId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("id");

  if (error || !data || data.length === 0) {
    logger.warn("OAuth nonce consumption failed or replay detected", {
      provider,
      nonce,
      organizationId,
      error,
    });
    return false;
  }

  return true;
}
