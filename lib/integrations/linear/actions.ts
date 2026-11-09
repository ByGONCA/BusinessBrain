"use server";

// ==============================================================================
// KogSync: Linear Intelligence Data Provider — Server Actions
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";
import { PermissionKey } from "@/lib/permissions/registry";
import { getDecryptedLinearTokens, LinearAuthExpiredError, LinearRateLimitError } from "./graphql-client";
import { getLinearIntelligenceSnapshot, getNormalizedLinearIssues } from "./provider";
import { revokeLinearToken } from "./oauth";
import { linearCache } from "@/lib/integrations/cache";
import {
  LinearIntelligenceSnapshot,
  NormalizedLinearIssue,
} from "./types";

/**
 * Validates tenant authorization, resolves organization ID,
 * and verifies caller membership and fine-grained permissions.
 */
async function resolveAuthorizedOrgId(orgId?: string, requiredPermission?: PermissionKey): Promise<string> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    throw new Error("No active organization found.");
  }
  const targetId = orgId || activeOrg.id;
  if (!isValidUuid(targetId)) {
    throw new Error("Invalid organization ID format.");
  }

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Unauthorized");

  // Verify workspace membership
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", targetId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (!member) throw new Error("Unauthorized to access workspace.");

  // Verify entitlement: subscription or personal workspace access required
  const entitlement = await getOrganizationEntitlement(targetId);
  if (!entitlement.isEntitled && activeOrg.workspace_type !== "personal") {
    throw new Error("Subscription required to access Linear intelligence services.");
  }

  // If a specific permission is required, enforce it (Owners/admins bypass automatically)
  if (requiredPermission) {
    const allowed = await hasPermission(user.user.id, targetId, requiredPermission);
    if (!allowed) {
      throw new Error(`Forbidden: Missing permission '${requiredPermission}'`);
    }
  }

  return targetId;
}

/**
 * Checks whether Linear integration is actively connected for the workspace.
 */
export async function isLinearConnectedAction(orgId?: string): Promise<boolean> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const tokens = await getDecryptedLinearTokens(targetOrgId);
    return Boolean(tokens);
  } catch {
    return false;
  }
}

/**
 * Retrieves the full Intelligence Snapshot for the workspace.
 */
export async function getLinearIntelligenceSnapshotAction(
  orgId?: string
): Promise<{
  success: boolean;
  data?: LinearIntelligenceSnapshot;
  authExpired?: boolean;
  error?: string;
}> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId, "linear.view");
    const snapshot = await getLinearIntelligenceSnapshot(targetOrgId);

    if (!snapshot) {
      return { success: false, error: "Linear is not connected for this workspace." };
    }

    return { success: true, data: snapshot };
  } catch (err: any) {
    if (err instanceof LinearRateLimitError) {
      return {
        success: false,
        error: `Linear API rate limit reached. Please retry in ${err.retryAfterSeconds || 2}s.`,
      };
    }

    if (err instanceof LinearAuthExpiredError || err?.message?.includes("401")) {
      logger.warn("Linear session expired during intelligence snapshot", { error: err.message });
      return {
        success: false,
        authExpired: true,
        error: "Linear authentication expired. Please reconnect your account.",
      };
    }

    logger.error("Failed to load Linear intelligence snapshot", err);
    return { success: false, error: err.message || "Failed to load Linear intelligence snapshot." };
  }
}

/**
 * Retrieves a paginated list of normalized issues for preview or Intelligence Engine queries.
 */
export async function getLinearDataPreviewAction(
  orgId?: string,
  params?: { first?: number; after?: string }
): Promise<{
  success: boolean;
  issues?: NormalizedLinearIssue[];
  hasNextPage?: boolean;
  endCursor?: string;
  authExpired?: boolean;
  error?: string;
}> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId, "linear.view");
    const result = await getNormalizedLinearIssues(targetOrgId, params);

    return {
      success: true,
      issues: result.issues,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };
  } catch (err: any) {
    if (err instanceof LinearRateLimitError) {
      return {
        success: false,
        error: `Linear API rate limit reached. Please retry in ${err.retryAfterSeconds || 2}s.`,
      };
    }

    if (err instanceof LinearAuthExpiredError || err?.message?.includes("401")) {
      return { success: false, authExpired: true, error: "Linear authentication expired." };
    }
    return { success: false, error: err.message || "Failed to load Linear data preview." };
  }
}

/**
 * Disconnects Linear integration, revoking external tokens and removing credentials from PostgreSQL.
 */
export async function disconnectLinearAction(
  orgId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId, "linear.manage_connection");
    const tokens = await getDecryptedLinearTokens(targetOrgId);

    if (tokens?.accessToken) {
      await revokeLinearToken(tokens.accessToken);
    }

    const supabase = await createClient();
    await supabase
      .from("organization_integrations")
      .update({
        status: "disconnected",
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", targetOrgId)
      .eq("provider", "linear");

    linearCache.invalidateTenant(targetOrgId, "linear");
    revalidatePath("/dashboard/linear");
    return { success: true };
  } catch (err: any) {
    logger.error("Failed to disconnect Linear integration", err);
    return { success: false, error: err.message || "Failed to disconnect Linear." };
  }
}
