// ==============================================================================
// KogSync: Shopify Enterprise Data Synchronization & Ingestion Engine
// Imports, normalizes and persists Store, Products, Variants, Inventory & Orders
// Strict multi-tenant isolation, idempotency, rate-limit backoff, Zero PII
// ==============================================================================

import { createServiceClient } from "@/lib/supabase/server";
import { ShopifyClient, ShopifyApiError } from "./client";
import {
  ShopifySyncJobResult,
  ShopifyDataSyncOptions,
  ShopifyProduct,
  ShopifyOrder,
  ShopifyLocation,
  ShopifyInventoryLevel,
} from "./types";
import { logger } from "@/lib/security/logger";

interface SyncCounters {
  products: number;
  variants: number;
  locations: number;
  inventoryLevels: number;
  orders: number;
  errors: string[];
}

/**
 * Executes a full or delta data synchronization for a connected Shopify store.
 * Safe to call from background jobs, webhooks, or server actions.
 */
export async function syncShopifyOrganizationData(
  organizationId: string,
  options?: ShopifyDataSyncOptions & { customSupabaseClient?: any }
): Promise<ShopifySyncJobResult> {
  const startTime = Date.now();
  const supabase = options?.customSupabaseClient || createServiceClient();

  // 1. Verify active Shopify integration for this organization
  const { data: integration, error: intError } = await supabase
    .from("organization_integrations")
    .select("id, status, metadata, last_sync_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .maybeSingle();

  if (intError || !integration || integration.status !== "connected") {
    logger.warn("Cannot sync Shopify: integration not active", { organizationId, status: integration?.status });
    return {
      success: false,
      syncType: options?.forceFull ? "initial_import" : "reconciliation",
      itemsSynced: 0,
      itemsFailed: 0,
      durationMs: Date.now() - startTime,
      details: {},
      errorMessage: "Shopify integration is not active for this workspace.",
    };
  }

  // 2. Prevent overlapping concurrent syncs for the same organization
  const { data: activeSync } = await supabase
    .from("integration_sync_logs")
    .select("id, started_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .eq("status", "in_progress")
    .gt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .maybeSingle();

  if (activeSync) {
    logger.info("Shopify sync already in progress for organization", { organizationId, activeSyncId: activeSync.id });
    return {
      success: false,
      syncType: "reconciliation",
      itemsSynced: 0,
      itemsFailed: 0,
      durationMs: Date.now() - startTime,
      details: {},
      errorMessage: "A synchronization is currently already in progress.",
    };
  }

  const syncType = options?.forceFull
    ? "initial_import"
    : options?.updatedAtMin
    ? "reconciliation"
    : "manual";

  // 3. Register in_progress sync job in canonical integration_sync_logs
  const { data: syncLog, error: logError } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      integration_id: integration.id,
      provider: "shopify",
      sync_type: syncType,
      status: "in_progress",
      items_synced: 0,
      items_failed: 0,
      started_at: new Date().toISOString(),
      details: {
        forceFull: options?.forceFull || false,
        updatedAtMin: options?.updatedAtMin || null,
      },
    })
    .select("id")
    .single();

  const syncLogId = syncLog?.id;

  const counters: SyncCounters = {
    products: 0,
    variants: 0,
    locations: 0,
    inventoryLevels: 0,
    orders: 0,
    errors: [],
  };

  try {
    const client = await ShopifyClient.forOrganization(organizationId);
    const syncTimestamp = new Date().toISOString();

    // --------------------------------------------------------------------------
    // A. LOCATIONS INGESTION
    // --------------------------------------------------------------------------
    let locations: ShopifyLocation[] = [];
    try {
      locations = await client.getLocations();
      if (locations.length > 0) {
        const locationRows = locations.map((loc) => ({
          organization_id: organizationId,
          integration_id: integration.id,
          shopify_location_id: String(loc.id),
          name: loc.name || "Default Location",
          address1: loc.address1 || null,
          city: loc.city || null,
          country: loc.country || null,
          country_code: null,
          active: loc.active !== false,
          is_primary: false,
          raw_data: loc,
          updated_at: syncTimestamp,
        }));

        const { error: locErr } = await supabase
          .from("shopify_locations")
          .upsert(locationRows, {
            onConflict: "organization_id,shopify_location_id",
          });

        if (locErr) {
          logger.warn("Error upserting shopify locations", { error: locErr.message });
          counters.errors.push(`locations: ${locErr.message}`);
        } else {
          counters.locations = locationRows.length;
        }
      }
    } catch (err: unknown) {
      logger.warn("Failed to fetch locations", { error: String(err) });
      counters.errors.push(`locations_fetch: ${String(err)}`);
    }

    // --------------------------------------------------------------------------
    // B. PRODUCTS & VARIANTS INGESTION (Cursor Pagination)
    // --------------------------------------------------------------------------
    let productCursor: string | undefined = undefined;
    const inventoryItemIds: number[] = [];
    let hasMoreProducts = true;
    let productPages = 0;

    while (hasMoreProducts && productPages < 50) {
      productPages++;
      const res = await client.getProducts({
        limit: 50,
        updatedAtMin: options?.updatedAtMin,
        pageInfo: productCursor,
      });

      const products = res.products || [];
      if (products.length > 0) {
        // 1. Upsert Products
        const productRows = products.map((prod) => ({
          organization_id: organizationId,
          integration_id: integration.id,
          shopify_product_id: String(prod.id),
          title: prod.title,
          handle: prod.handle || null,
          body_html: prod.body_html || null,
          vendor: prod.vendor || null,
          product_type: prod.product_type || null,
          status: prod.status || "active",
          published_at: prod.published_at || null,
          tags: prod.tags ? prod.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          images: prod.images || [],
          raw_data: { id: prod.id, handle: prod.handle },
          shopify_created_at: prod.created_at,
          shopify_updated_at: prod.updated_at,
          updated_at: syncTimestamp,
        }));

        const { data: upsertedProds, error: prodErr } = await supabase
          .from("shopify_products")
          .upsert(productRows, {
            onConflict: "organization_id,shopify_product_id",
          })
          .select("id, shopify_product_id");

        if (prodErr) {
          logger.warn("Error upserting products", { error: prodErr.message });
          counters.errors.push(`products: ${prodErr.message}`);
        } else {
          counters.products += productRows.length;

          // Map shopify_product_id -> local product uuid
          const prodIdMap = new Map<string, string>();
          (upsertedProds || []).forEach((p: { id: string; shopify_product_id: string }) => {
            prodIdMap.set(p.shopify_product_id, p.id);
          });

          // 2. Upsert Variants
          const variantRows: any[] = [];
          for (const prod of products) {
            const localProdId = prodIdMap.get(String(prod.id));
            if (!localProdId || !prod.variants) continue;

            for (const v of prod.variants) {
              if (v.inventory_item_id) {
                inventoryItemIds.push(v.inventory_item_id);
              }
              variantRows.push({
                organization_id: organizationId,
                product_id: localProdId,
                shopify_product_id: String(prod.id),
                shopify_variant_id: String(v.id),
                title: v.title || "Default Title",
                sku: v.sku || null,
                price: parseFloat(v.price) || 0.0,
                compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
                position: v.position || 1,
                inventory_item_id: v.inventory_item_id ? String(v.inventory_item_id) : null,
                inventory_quantity: v.inventory_quantity || 0,
                inventory_policy: v.inventory_policy || "deny",
                requires_shipping: v.requires_shipping !== false,
                barcode: null, // Scoped away from singular deprecated field
                raw_data: { id: v.id, title: v.title },
                shopify_created_at: prod.created_at,
                shopify_updated_at: prod.updated_at,
                updated_at: syncTimestamp,
              });
            }
          }

          if (variantRows.length > 0) {
            const { error: varErr } = await supabase
              .from("shopify_product_variants")
              .upsert(variantRows, {
                onConflict: "organization_id,shopify_variant_id",
              });

            if (varErr) {
              logger.warn("Error upserting variants", { error: varErr.message });
              counters.errors.push(`variants: ${varErr.message}`);
            } else {
              counters.variants += variantRows.length;
            }
          }
        }
      }

      productCursor = res.nextCursor;
      hasMoreProducts = Boolean(productCursor);
    }

    // --------------------------------------------------------------------------
    // C. INVENTORY LEVELS INGESTION
    // --------------------------------------------------------------------------
    if (inventoryItemIds.length > 0) {
      const uniqueItemIds = Array.from(new Set(inventoryItemIds)).slice(0, 100); // Process up to 100 SKUs per pass
      try {
        const invLevels = await client.getInventoryLevels({ inventoryItemIds: uniqueItemIds });
        if (invLevels.length > 0) {
          const invRows = invLevels.map((lvl) => ({
            organization_id: organizationId,
            shopify_inventory_item_id: String(lvl.inventory_item_id),
            shopify_location_id: String(lvl.location_id),
            available: lvl.available !== null ? lvl.available : 0,
            shopify_updated_at: lvl.updated_at || syncTimestamp,
            raw_data: lvl,
            updated_at: syncTimestamp,
          }));

          const { error: invErr } = await supabase
            .from("shopify_inventory_levels")
            .upsert(invRows, {
              onConflict: "organization_id,shopify_inventory_item_id,shopify_location_id",
            });

          if (invErr) {
            logger.warn("Error upserting inventory levels", { error: invErr.message });
            counters.errors.push(`inventory: ${invErr.message}`);
          } else {
            counters.inventoryLevels += invRows.length;
          }
        }
      } catch (err: unknown) {
        logger.warn("Failed to fetch inventory levels", { error: String(err) });
        counters.errors.push(`inventory_fetch: ${String(err)}`);
      }
    }

    // --------------------------------------------------------------------------
    // D. ORDERS INGESTION (Zero PII Scrubbed)
    // --------------------------------------------------------------------------
    let orderCursor: string | undefined = undefined;
    let hasMoreOrders = true;
    let orderPages = 0;

    while (hasMoreOrders && orderPages < 50) {
      orderPages++;
      const res = await client.getOrders({
        limit: 50,
        status: "any",
        updatedAtMin: options?.updatedAtMin,
        pageInfo: orderCursor,
      });

      const orders = res.orders || [];
      if (orders.length > 0) {
        const orderRows = orders.map((ord) => ({
          organization_id: organizationId,
          integration_id: integration.id,
          shopify_order_id: String(ord.id),
          order_number: ord.order_number,
          name: ord.name || `#${ord.order_number}`,
          currency: ord.currency || "USD",
          financial_status: ord.financial_status || "pending",
          fulfillment_status: ord.fulfillment_status || "unfulfilled",
          subtotal_price: parseFloat(ord.subtotal_price) || 0.0,
          total_tax: parseFloat(ord.total_tax) || 0.0,
          total_price: parseFloat(ord.current_total_price) || 0.0,
          line_items_count: ord.line_items ? ord.line_items.length : 0,
          line_items: (ord.line_items || []).map((li) => ({
            id: li.id,
            title: li.title,
            quantity: li.quantity,
            price: li.price,
            sku: li.sku,
            variant_title: li.variant_title,
          })),
          raw_data: {
            id: ord.id,
            name: ord.name,
            order_number: ord.order_number,
          },
          shopify_created_at: ord.created_at,
          shopify_updated_at: ord.updated_at,
          cancelled_at: ord.cancelled_at || null,
          updated_at: syncTimestamp,
        }));

        const { error: ordErr } = await supabase
          .from("shopify_orders")
          .upsert(orderRows, {
            onConflict: "organization_id,shopify_order_id",
          });

        if (ordErr) {
          logger.warn("Error upserting orders", { error: ordErr.message });
          counters.errors.push(`orders: ${ordErr.message}`);
        } else {
          counters.orders += orderRows.length;
        }
      }

      orderCursor = res.nextCursor;
      hasMoreOrders = Boolean(orderCursor);
    }

    // --------------------------------------------------------------------------
    // E. FINALIZE & UPDATE SYNC LOG
    // --------------------------------------------------------------------------
    const totalSynced =
      counters.products +
      counters.variants +
      counters.locations +
      counters.inventoryLevels +
      counters.orders;

    const totalFailed = counters.errors.length;
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    if (syncLogId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: totalFailed > 0 && totalSynced === 0 ? "failed" : totalFailed > 0 ? "partial" : "completed",
          items_synced: totalSynced,
          items_failed: totalFailed,
          details: counters,
          completed_at: completedAt,
          error_message: totalFailed > 0 ? counters.errors.slice(0, 3).join("; ") : null,
        })
        .eq("id", syncLogId);
    }

    // Update integration metadata & last_sync_at
    const existingMeta = (integration.metadata || {}) as Record<string, any>;
    const updatedMeta = {
      ...existingMeta,
      product_count: counters.products,
      orders_count: counters.orders,
      last_synced_at: completedAt,
    };

    await supabase
      .from("organization_integrations")
      .update({
        last_sync_at: completedAt,
        metadata: updatedMeta,
        updated_at: completedAt,
      })
      .eq("id", integration.id);

    logger.info("Shopify sync completed successfully", {
      organizationId,
      totalSynced,
      totalFailed,
      durationMs,
    });

    return {
      success: true,
      syncType,
      itemsSynced: totalSynced,
      itemsFailed: totalFailed,
      durationMs,
      details: counters,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof ShopifyApiError ? err.message : String(err);

    logger.error("Shopify sync failed with exception", err, { organizationId });

    if (syncLogId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: "failed",
          items_synced: counters.products + counters.orders,
          items_failed: counters.errors.length + 1,
          details: counters,
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", syncLogId);
    }

    return {
      success: false,
      syncType,
      itemsSynced: 0,
      itemsFailed: 1,
      durationMs,
      details: counters,
      errorMessage,
    };
  }
}
