"use server";

// ==============================================================================
// KogSync: Shopify Integration Server Actions (Multi-Tenant Authorization & UI)
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { ShopifyClient, ShopifyApiError } from "./client";
import {
  ShopifyWorkspaceSnapshot,
  ShopifyProduct,
  ShopifyOrder,
  ShopifyIntegrationMetadata,
} from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Resolves the target organization and strictly validates user authentication,
 * tenant membership, and required permissions.
 */
async function resolveAuthorizedShopifyOrg(
  targetOrgId?: string,
  requiredPermission?: "integrations.connect" | "integrations.disconnect"
): Promise<{ organizationId: string; user: { id: string; email?: string } }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  const organizationId = targetOrgId || activeOrg?.id;
  if (!organizationId) throw new Error("No active organization");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    throw new Error("Forbidden: Not an organization member");
  }

  if (requiredPermission) {
    const isOwnerOrAdmin = member.role === "owner" || member.role === "admin";
    const allowed = isOwnerOrAdmin || (await hasPermission(user.id, organizationId, requiredPermission));
    if (!allowed) {
      throw new Error(`Forbidden: Insufficient permissions to manage integrations (${requiredPermission})`);
    }
  }

  return { organizationId, user };
}

/**
 * Retrieves the operational snapshot for Shopify in the active workspace (ZERO tokens).
 */
export async function getShopifyWorkspaceSnapshotAction(
  targetOrgId?: string
): Promise<{ success: boolean; data?: ShopifyWorkspaceSnapshot; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(targetOrgId);
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("id, status, account_email, metadata, last_sync_at, created_at")
      .eq("organization_id", organizationId)
      .eq("provider", "shopify")
      .maybeSingle();

    if (!integration || integration.status === "disconnected") {
      return {
        success: true,
        data: {
          status: "disconnected",
          products: [],
          recentOrders: [],
          totalProductsCount: 0,
          totalOrdersCount: 0,
        },
      };
    }

    if (integration.status === "needs_reauth" || integration.status === "error") {
      const metadata = (integration.metadata || {}) as ShopifyIntegrationMetadata;
      return {
        success: true,
        data: {
          status: integration.status as any,
          connectedAccount: {
            shopDomain: metadata.shop_domain || integration.account_email || "Shopify Store",
            shopName: metadata.shop_name,
            email: integration.account_email || undefined,
            currency: metadata.currency,
            country: metadata.country_code,
            connectedAt: integration.created_at,
          },
          products: [],
          recentOrders: [],
          totalProductsCount: 0,
          totalOrdersCount: 0,
        },
      };
    }

    const metadata = (integration.metadata || {}) as ShopifyIntegrationMetadata;

    try {
      const client = await ShopifyClient.forOrganization(organizationId);

      const [shop, productsRes, ordersRes] = await Promise.all([
        client.getShop().catch(() => null),
        client.getProducts({ limit: 15 }).catch(() => ({ products: [] })),
        client.getOrders({ limit: 10 }).catch(() => ({ orders: [] })),
      ]);

      const products = productsRes.products || [];
      const orders = ordersRes.orders || [];

      return {
        success: true,
        data: {
          status: "connected",
          connectedAccount: {
            shopDomain: metadata.shop_domain,
            shopName: shop?.name || metadata.shop_name || metadata.shop_domain,
            email: shop?.email || integration.account_email || undefined,
            currency: shop?.currency || metadata.currency || "USD",
            country: shop?.country_name || metadata.country_code,
            connectedAt: integration.created_at,
          },
          products,
          recentOrders: orders,
          totalProductsCount: products.length,
          totalOrdersCount: orders.length,
          lastSyncAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      if (err instanceof ShopifyApiError && (err.status === 401 || err.status === 403)) {
        await supabase
          .from("organization_integrations")
          .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
          .eq("id", integration.id);

        return {
          success: true,
          data: {
            status: "needs_reauth",
            connectedAccount: {
              shopDomain: metadata.shop_domain,
              shopName: metadata.shop_name,
              connectedAt: integration.created_at,
            },
            products: [],
            recentOrders: [],
            totalProductsCount: 0,
            totalOrdersCount: 0,
          },
        };
      }

      logger.warn("Shopify snapshot fetch returned API warning", { error: String(err) });
      return {
        success: true,
        data: {
          status: "connected",
          connectedAccount: {
            shopDomain: metadata.shop_domain,
            shopName: metadata.shop_name || metadata.shop_domain,
            connectedAt: integration.created_at,
          },
          products: [],
          recentOrders: [],
          totalProductsCount: 0,
          totalOrdersCount: 0,
        },
      };
    }
  } catch (err: unknown) {
    logger.error("Failed to load Shopify workspace snapshot", err);
    return { success: false, error: "Failed to load Shopify snapshot." };
  }
}

/**
 * Queries products for the connected Shopify store with pagination.
 */
export async function getShopifyProductsAction(params?: {
  limit?: number;
  status?: "active" | "archived" | "draft";
  pageInfo?: string;
  targetOrgId?: string;
}): Promise<{ success: boolean; data?: { products: ShopifyProduct[]; nextCursor?: string }; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(params?.targetOrgId);
    const client = await ShopifyClient.forOrganization(organizationId);

    const result = await client.getProducts({
      limit: params?.limit,
      status: params?.status,
      pageInfo: params?.pageInfo,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    logger.error("Failed to fetch Shopify products", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Queries orders for the connected Shopify store with pagination.
 */
export async function getShopifyOrdersAction(params?: {
  limit?: number;
  status?: "open" | "closed" | "cancelled" | "any";
  pageInfo?: string;
  targetOrgId?: string;
}): Promise<{ success: boolean; data?: { orders: ShopifyOrder[]; nextCursor?: string }; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(params?.targetOrgId);
    const client = await ShopifyClient.forOrganization(organizationId);

    const result = await client.getOrders({
      limit: params?.limit,
      status: params?.status,
      pageInfo: params?.pageInfo,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    logger.error("Failed to fetch Shopify orders", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Disconnects the Shopify store: clears tokens and marks status as 'disconnected'.
 */
export async function disconnectShopifyAction(
  targetOrgId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(targetOrgId, "integrations.disconnect");

    const rl = await rateLimit("disconnect-shopify", organizationId, RATE_LIMIT_PRESETS.MUTATIONS);
    if (!rl.success) {
      return { success: false, error: "Too many mutation attempts. Please try again shortly." };
    }

    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("id, metadata")
      .eq("organization_id", organizationId)
      .eq("provider", "shopify")
      .single();

    if (integration) {
      await supabase
        .from("organization_integrations")
        .update({
          status: "disconnected",
          encrypted_access_token: null,
          encrypted_refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Failed to disconnect Shopify", err);
    return { success: false, error: "Failed to disconnect Shopify store." };
  }
}
