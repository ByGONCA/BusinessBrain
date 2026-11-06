// ==============================================================================
// Company Brain: Personal Workspace Service
// Manages provisioning, resolution, and isolation of personal workspaces.
// INVARIANT: Every user has an individual Personal Workspace independent of team memberships.
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { OrganizationWithRole, Organization } from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Checks whether an organization record is an individual Personal Workspace.
 */
export function isPersonalWorkspace(org?: Partial<Organization> | null): boolean {
  if (!org) return false;
  return org.workspace_type === "personal";
}

/**
 * Ensures the authenticated user has a Personal Workspace.
 * Idempotently provisions one if it does not yet exist.
 */
export async function ensurePersonalWorkspace(
  userId: string,
  userName?: string | null,
  injectedClient?: any
): Promise<OrganizationWithRole | null> {
  const supabase = injectedClient || (await createClient());

  try {
    // 1. First check if personal workspace already exists
    const { data: existing, error: queryError } = await supabase
      .from("organization_members")
      .select(`
        role,
        organizations (
          id,
          name,
          slug,
          created_by,
          workspace_type,
          status,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", userId)
      .limit(20);

    if (!queryError && existing && existing.length > 0) {
      for (const row of existing) {
        const org = (row as any).organizations;
        if (org && org.workspace_type === "personal") {
          return {
            ...org,
            role: (row as any).role || "owner",
          };
        }
      }
    }

    // 2. Try executing RPC ensure_personal_workspace if available
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "ensure_personal_workspace",
        {
          p_user_id: userId,
          p_user_name: userName || "Espaço Pessoal",
        }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          id: row.organization_id,
          name: row.name,
          slug: row.slug,
          created_by: userId,
          workspace_type: "personal",
          status: "active",
          role: "owner",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback to direct insertion if RPC is not yet applied
    }

    // 3. Resilient Direct Insertion Fallback
    const personalName = userName ? `${userName} (Pessoal)` : "Espaço Pessoal";
    const personalSlug = `personal-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

    const { data: newOrg, error: orgInsertError } = await supabase
      .from("organizations")
      .insert({
        name: personalName,
        slug: personalSlug,
        workspace_type: "personal",
        created_by: userId,
        status: "active",
      })
      .select()
      .single();

    if (orgInsertError || !newOrg) {
      logger.warn("Could not insert personal organization directly", { error: orgInsertError });
      return null;
    }

    // Assign user as owner
    await supabase.from("organization_members").insert({
      organization_id: newOrg.id,
      user_id: userId,
      role: "owner",
    });

    // Provision baseline subscription
    await supabase.from("subscriptions").insert({
      organization_id: newOrg.id,
      plan: "starter",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return {
      ...newOrg,
      role: "owner",
    };
  } catch (err: any) {
    logger.error("Failed to ensure personal workspace", err);
    return null;
  }
}
