"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { revokeStripeConnectAccess } from "./oauth";
import { getOrFetchStripeFinancialSnapshot } from "./analytics";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Disconnects the Stripe account from the workspace.
 * Calls Stripe's /oauth/deauthorize endpoint and explicitly reports remote revocation status.
 * Strictly restricted to Workspace Owners and Admins.
 */
export async function disconnectStripeIntegrationAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active workspace selected." };
  }

  // Strict role check: Only Owner or Admin
  const isAuthorized =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "integrations.disconnect"));

  if (!isAuthorized) {
    logger.warn("Unauthorized attempt to disconnect Stripe integration", {
      userId: user.id,
      organizationId: activeOrg.id,
      role: activeOrg.role,
    });
    return {
      success: false,
      error: "Forbidden: Only workspace owners and admins can manage company integrations.",
    };
  }

  const supabase = await createClient();

  // 1. Fetch current connected account ID
  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("provider_account_id")
    .eq("organization_id", activeOrg.id)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!integration) {
    return { success: false, error: "Stripe is not currently connected for this workspace." };
  }

  const connectedAccountId = integration.provider_account_id;

  // 2. Perform remote deauthorization with Stripe Connect
  let remoteRevocationConfirmed = false;
  let revocationWarning: string | undefined;

  if (connectedAccountId) {
    const revokeResult = await revokeStripeConnectAccess(connectedAccountId);
    if (!revokeResult.success) {
      revocationWarning = `Aviso de Revogação Remota: A chamada aos servidores da Stripe não foi confirmada (${revokeResult.error || "erro de rede"}). As credenciais locais foram eliminadas por segurança, mas recomenda-se verificar e revogar a permissão manualmente no Stripe Dashboard.`;
      logger.warn("Stripe remote deauthorization unconfirmed or failed", {
        organizationId: activeOrg.id,
        connectedAccountId,
        error: revokeResult.error,
      });
    } else {
      remoteRevocationConfirmed = true;
    }
  }

  // 3. Delete integration record locally - DO NOT leave usable tokens in the database
  const { error: deleteError } = await supabase
    .from("organization_integrations")
    .delete()
    .eq("organization_id", activeOrg.id)
    .eq("provider", "stripe");

  if (deleteError) {
    logger.error("Failed to delete integration record in database", deleteError, {
      organizationId: activeOrg.id,
    });
    return { success: false, error: "Falha ao remover o registo de integração da base de dados local." };
  }

  // 4. Delete associated snapshots
  await supabase
    .from("organization_metric_snapshots")
    .delete()
    .eq("organization_id", activeOrg.id);

  logger.info("Disconnected Stripe integration for organization", {
    organizationId: activeOrg.id,
    disconnectedByUserId: user.id,
    connectedAccountId,
    remoteRevocationConfirmed,
    revocationWarning,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return {
    success: true,
    data: {
      remoteRevocationConfirmed,
      warning: revocationWarning,
      connectedAccountId,
    },
  };
}

/**
 * Manually forces a refresh of Stripe financial metrics.
 * Strictly restricted to Workspace Owners and Admins to prevent API abuse.
 * Enforces a 60-second rate limit.
 */
export async function refreshStripeMetricsAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized: Please log in." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active workspace selected." };
  }

  // Strict role check: Only Owner or Admin can force API refresh
  const isAuthorized =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "integrations.configure"));

  if (!isAuthorized) {
    return {
      success: false,
      error: "Forbidden: Only workspace owners and admins can trigger metric refreshes.",
    };
  }

  // Rate limit: 1 manual refresh per 60s per organization
  const rl = await rateLimit(`stripe-refresh:${activeOrg.id}`, user.id, {
    limit: 1,
    windowSeconds: 60,
  });

  if (!rl.success) {
    return {
      success: false,
      error: "Please wait at least 60 seconds between manual metric updates.",
    };
  }

  const supabase = await createClient();

  const result = await getOrFetchStripeFinancialSnapshot(supabase, activeOrg.id, {
    forceRefresh: true,
  });

  if (result.error && !result.snapshot) {
    return { success: false, error: result.error };
  }

  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      status: result.status,
      computedAt: result.snapshot?.computedAt,
    },
  };
}
