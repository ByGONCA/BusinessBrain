"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { decryptToken } from "@/lib/crypto/encryption";
import { revokeGoogleToken } from "./google/oauth";
import { isValidUuid } from "@/lib/security/authorization";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

/**
 * Disconnects an organization integration, revoking external tokens,
 * clearing credentials from the database, and setting status to 'disconnected'.
 * Protected with role verification, IDOR prevention, and UUID validation.
 */
export async function disconnectIntegrationAction(integrationId: string) {
  if (!isValidUuid(integrationId)) {
    throw new Error("Invalid integration ID format.");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    throw new Error("No active organization found.");
  }

  // Only owners and admins can disconnect workspace integrations
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    throw new Error("You must be an owner or admin to manage organization integrations.");
  }

  // Rate limit mutation per workspace
  const rl = await rateLimit("disconnect-integration", activeOrg.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many integration changes. Please try again shortly.");
  }

  const supabase = await createClient();

  // Retrieve integration credentials strictly scoped to the active organization (IDOR prevention)
  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, provider, encrypted_refresh_token, encrypted_access_token")
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (error || !integration) {
    logger.warn("Integration not found or organization mismatch", {
      integrationId,
      organizationId: activeOrg.id,
    });
    return;
  }

  // Attempt graceful token revocation if supported
  try {
    if (integration.provider === "google") {
      if (integration.encrypted_refresh_token) {
        const refreshToken = decryptToken(integration.encrypted_refresh_token);
        await revokeGoogleToken(refreshToken);
      } else if (integration.encrypted_access_token) {
        const accessToken = decryptToken(integration.encrypted_access_token);
        await revokeGoogleToken(accessToken);
      }
    }
  } catch (err: unknown) {
    logger.warn("External token revocation skipped or failed", {
      provider: integration.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Clear tokens and set status to disconnected
  await supabase
    .from("organization_integrations")
    .update({
      status: "disconnected",
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id);

  // Mark referenced external files as unavailable without deleting knowledge records
  if (integration.provider === "google" || integration.provider === "google_drive") {
    await supabase
      .from("organization_files")
      .update({
        status: "unavailable",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", activeOrg.id)
      .eq("storage_provider", "google_drive");
  }

  logger.info("Successfully disconnected integration", {
    integrationId,
    organizationId: activeOrg.id,
    provider: integration.provider,
  });

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
