"use server";

// ==============================================================================
// KogSync: Shopify Integration Server Actions (Multi-Tenant DB-Backed & UI)
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { ShopifyClient, ShopifyApiError } from "./client";
import { syncShopifyOrganizationData } from "./sync-engine";
import {
  ShopifyWorkspaceSnapshot,
  ShopifyProduct,
  ShopifyOrder,
  ShopifyIntegrationMetadata,
  ShopifySyncJobResult,
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
 * Retrieves the operational snapshot for Shopify in the active workspace.
 * Queries KogSync local PostgreSQL tables for instantaneous, resilient access (ZERO tokens).
 */
export async function getShopifyWorkspaceSnapshotAction(
  targetOrgId?: string
): Promise<{ success: boolean; data?: ShopifyWorkspaceSnapshot; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(targetOrgId);
    const supabase = await createClient();

    // 1. Fetch Integration record
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
          totalVariantsCount: 0,
          totalOrdersCount: 0,
          totalInventoryCount: 0,
          syncStatus: "idle",
        },
      };
    }

    const metadata = (integration.metadata || {}) as ShopifyIntegrationMetadata;

    if (integration.status === "needs_reauth" || integration.status === "error") {
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
          totalVariantsCount: 0,
          totalOrdersCount: 0,
          totalInventoryCount: 0,
          syncStatus: "failed",
          lastSyncError: "Store credentials expired or revoked. Please reconnect.",
        },
      };
    }

    // 2. Fetch local persisted data in parallel
    const [
      productsRes,
      variantsCountRes,
      ordersRes,
      inventoryCountRes,
      latestSyncLogRes,
    ] = await Promise.all([
      // Products from shopify_products table
      supabase
        .from("shopify_products")
        .select("id, shopify_product_id, title, handle, body_html, vendor, product_type, status, tags, images, shopify_created_at, shopify_updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("shopify_updated_at", { ascending: false })
        .limit(15),

      // Count variants
      supabase
        .from("shopify_product_variants")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),

      // Orders from shopify_orders table
      supabase
        .from("shopify_orders")
        .select("id, shopify_order_id, order_number, name, currency, financial_status, fulfillment_status, subtotal_price, total_tax, total_price, line_items, shopify_created_at, shopify_updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("shopify_created_at", { ascending: false })
        .limit(10),

      // Count inventory levels
      supabase
        .from("shopify_inventory_levels")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),

      // Latest sync log from integration_sync_logs
      supabase
        .from("integration_sync_logs")
        .select("id, status, error_message, started_at, completed_at")
        .eq("organization_id", organizationId)
        .eq("provider", "shopify")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const localProducts = (productsRes.data || []).map((p) => ({
      id: Number(p.shopify_product_id) || 0,
      title: p.title,
      body_html: p.body_html,
      vendor: p.vendor || "",
      product_type: p.product_type || "",
      created_at: p.shopify_created_at || "",
      handle: p.handle || "",
      updated_at: p.shopify_updated_at || "",
      published_at: null,
      status: (p.status as any) || "active",
      variants: [],
      images: Array.isArray(p.images) ? p.images : [],
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
    })) as ShopifyProduct[];

    const localOrders = (ordersRes.data || []).map((o) => ({
      id: Number(o.shopify_order_id) || 0,
      name: o.name,
      order_number: o.order_number || 0,
      created_at: o.shopify_created_at,
      updated_at: o.shopify_updated_at,
      cancelled_at: null,
      financial_status: (o.financial_status as any) || "pending",
      fulfillment_status: (o.fulfillment_status as any) || "unfulfilled",
      currency: o.currency || "USD",
      current_total_price: String(o.total_price),
      subtotal_price: String(o.subtotal_price),
      total_tax: String(o.total_tax),
      line_items: Array.isArray(o.line_items) ? o.line_items : [],
    })) as ShopifyOrder[];

    const latestSync = latestSyncLogRes.data;
    let syncStatus: "idle" | "in_progress" | "completed" | "failed" = "idle";
    let lastSyncError: string | undefined = undefined;

    if (latestSync) {
      if (latestSync.status === "in_progress") {
        syncStatus = "in_progress";
      } else if (latestSync.status === "failed") {
        syncStatus = "failed";
        lastSyncError = latestSync.error_message || "Last sync failed";
      } else {
        syncStatus = "completed";
      }
    }

    const totalProductsCount = productsRes.count ?? localProducts.length;
    const totalVariantsCount = variantsCountRes.count ?? 0;
    const totalOrdersCount = ordersRes.count ?? localOrders.length;
    const totalInventoryCount = inventoryCountRes.count ?? 0;

    return {
      success: true,
      data: {
        status: "connected",
        connectedAccount: {
          shopDomain: metadata.shop_domain,
          shopName: metadata.shop_name || metadata.shop_domain,
          email: metadata.connected_user_email || integration.account_email || undefined,
          currency: metadata.currency || "USD",
          country: metadata.country_code,
          connectedAt: integration.created_at,
        },
        products: localProducts,
        recentOrders: localOrders,
        totalProductsCount,
        totalVariantsCount,
        totalOrdersCount,
        totalInventoryCount,
        lastSyncAt: integration.last_sync_at || undefined,
        syncStatus,
        lastSyncError,
      },
    };
  } catch (err: unknown) {
    logger.error("Failed to load Shopify workspace snapshot", err);
    return { success: false, error: "Failed to load Shopify snapshot." };
  }
}

/**
 * Triggers a real data synchronization on demand for the connected Shopify store.
 */
export async function triggerShopifySyncAction(
  targetOrgId?: string,
  forceFull?: boolean
): Promise<{ success: boolean; result?: ShopifySyncJobResult; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(targetOrgId, "integrations.connect");

    const rl = await rateLimit("trigger-shopify-sync", organizationId, RATE_LIMIT_PRESETS.MUTATIONS);
    if (!rl.success) {
      return { success: false, error: "Rate limit reached. Please wait a moment before syncing again." };
    }

    const syncResult = await syncShopifyOrganizationData(organizationId, { forceFull: Boolean(forceFull) });
    revalidatePath("/dashboard");

    return {
      success: syncResult.success,
      result: syncResult,
      error: syncResult.errorMessage,
    };
  } catch (err: unknown) {
    logger.error("Failed to trigger Shopify synchronization", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Queries products from local KogSync database or Shopify API with pagination.
 */
export async function getShopifyProductsAction(params?: {
  limit?: number;
  status?: "active" | "archived" | "draft";
  pageInfo?: string;
  targetOrgId?: string;
}): Promise<{ success: boolean; data?: { products: ShopifyProduct[]; nextCursor?: string }; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(params?.targetOrgId);
    const supabase = await createClient();

    let query = supabase
      .from("shopify_products")
      .select("shopify_product_id, title, handle, body_html, vendor, product_type, status, tags, images, shopify_created_at, shopify_updated_at")
      .eq("organization_id", organizationId)
      .order("shopify_updated_at", { ascending: false })
      .limit(params?.limit || 25);

    if (params?.status) {
      query = query.eq("status", params.status);
    }

    const { data: prods, error } = await query;
    if (error) throw error;

    const products = (prods || []).map((p) => ({
      id: Number(p.shopify_product_id) || 0,
      title: p.title,
      body_html: p.body_html,
      vendor: p.vendor || "",
      product_type: p.product_type || "",
      created_at: p.shopify_created_at || "",
      handle: p.handle || "",
      updated_at: p.shopify_updated_at || "",
      published_at: null,
      status: (p.status as any) || "active",
      variants: [],
      images: Array.isArray(p.images) ? p.images : [],
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
    })) as ShopifyProduct[];

    return { success: true, data: { products } };
  } catch (err: unknown) {
    logger.error("Failed to fetch Shopify products", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Queries orders from local KogSync database with pagination.
 */
export async function getShopifyOrdersAction(params?: {
  limit?: number;
  status?: "open" | "closed" | "cancelled" | "any";
  pageInfo?: string;
  targetOrgId?: string;
}): Promise<{ success: boolean; data?: { orders: ShopifyOrder[]; nextCursor?: string }; error?: string }> {
  try {
    const { organizationId } = await resolveAuthorizedShopifyOrg(params?.targetOrgId);
    const supabase = await createClient();

    const { data: ords, error } = await supabase
      .from("shopify_orders")
      .select("shopify_order_id, order_number, name, currency, financial_status, fulfillment_status, subtotal_price, total_tax, total_price, line_items, shopify_created_at, shopify_updated_at")
      .eq("organization_id", organizationId)
      .order("shopify_created_at", { ascending: false })
      .limit(params?.limit || 20);

    if (error) throw error;

    const orders = (ords || []).map((o) => ({
      id: Number(o.shopify_order_id) || 0,
      name: o.name,
      order_number: o.order_number || 0,
      created_at: o.shopify_created_at,
      updated_at: o.shopify_updated_at,
      cancelled_at: null,
      financial_status: (o.financial_status as any) || "pending",
      fulfillment_status: (o.fulfillment_status as any) || "unfulfilled",
      currency: o.currency || "USD",
      current_total_price: String(o.total_price),
      subtotal_price: String(o.subtotal_price),
      total_tax: String(o.total_tax),
      line_items: Array.isArray(o.line_items) ? o.line_items : [],
    })) as ShopifyOrder[];

    return { success: true, data: { orders } };
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
