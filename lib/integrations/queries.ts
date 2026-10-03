import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrganizationIntegration } from "./types";

/**
 * Retrieves all connected integrations for an organization.
 * Sensitive encrypted tokens are omitted from the returned object.
 */
export const getOrganizationIntegrations = cache(
  async (organizationId: string): Promise<OrganizationIntegration[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organization_integrations")
      .select(
        "id, organization_id, provider, provider_account_id, account_email, connected_by_user_id, status, scopes, token_expires_at, metadata, last_sync_at, created_at, updated_at"
      )
      .eq("organization_id", organizationId);

    if (error || !data) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      provider: item.provider as any,
      providerAccountId: item.provider_account_id,
      accountEmail: item.account_email,
      connectedByUserId: item.connected_by_user_id,
      status: item.status as any,
      scopes: item.scopes || [],
      tokenExpiresAt: item.token_expires_at,
      metadata: item.metadata || {},
      lastSyncAt: item.last_sync_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }
);
