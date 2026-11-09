// ==============================================================================
// KogSync: Shopify Webhook Signature Verification & Real-Time Sync Engine
// Handles products, orders, inventory, app lifecycle and GDPR/privacy compliance
// Guarantees delivery deduplication, HMAC integrity, out-of-order timestamp guards
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { sanitizeShopDomain } from "./config";
import { logger } from "@/lib/security/logger";

/**
 * Verifies Shopify's X-Shopify-Hmac-Sha256 header against the raw body text.
 * Algorithm: Base64-encoded HMAC-SHA256 using SHOPIFY_API_SECRET or SHOPIFY_WEBHOOK_SECRET.
 */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  try {
    const computed = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    const sigBuf = Buffer.from(signatureHeader.trim(), "base64");
    const compBuf = Buffer.from(computed.trim(), "base64");

    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  } catch {
    return false;
  }
}

export interface WebhookProcessResult {
  processed: boolean;
  action?: string;
  organizationId?: string;
  reason?: string;
}

/**
 * Idempotently handles verified incoming Shopify webhook events and updates database tables.
 */
export async function processShopifyWebhookEvent(
  topic: string,
  rawShopDomain: string,
  payload: any,
  deliveryId?: string,
  apiVersion?: string,
  customSupabaseClient?: any
): Promise<WebhookProcessResult> {
  const cleanShop = sanitizeShopDomain(rawShopDomain);
  if (!cleanShop) {
    logger.warn("Rejected webhook with invalid shop domain", { rawShopDomain, topic });
    return { processed: false, reason: "invalid_shop_domain" };
  }

  const supabase = customSupabaseClient || createServiceClient();

  // Find active organization connected to this shop
  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, organization_id, status, metadata")
    .eq("provider", "shopify")
    .eq("provider_account_id", cleanShop)
    .maybeSingle();

  if (error || !integration) {
    logger.warn("Received webhook for untracked Shopify store", { cleanShop, topic, deliveryId });
    return { processed: false, reason: "store_not_found" };
  }

  const organizationId = integration.organization_id;
  const integrationId = integration.id;
  const nowIso = new Date().toISOString();

  // 1. Delivery Deduplication via shopify_webhook_events
  if (deliveryId) {
    const { data: duplicateCheck } = await supabase
      .from("shopify_webhook_events")
      .select("id, status")
      .eq("delivery_id", deliveryId)
      .maybeSingle();

    if (duplicateCheck) {
      logger.info("Skipping already processed webhook delivery", { deliveryId, topic });
      return { processed: true, action: "duplicate_skipped", organizationId };
    }

    // Record incoming webhook delivery
    await supabase.from("shopify_webhook_events").insert({
      organization_id: organizationId,
      integration_id: integrationId,
      delivery_id: deliveryId,
      topic,
      shop_domain: cleanShop,
      api_version: apiVersion || "2026-10",
      payload: typeof payload === "object" ? payload : {},
      status: "processing",
    });
  }

  // 2. Mandatory Privacy & GDPR Compliance Webhooks
  if (topic === "customers/data_request") {
    // Merchant customer requested their data. KogSync does not retain personal customer PII.
    logger.info("Processed Shopify customers/data_request (Zero PII retained)", { cleanShop });
    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "processed", processed_at: nowIso })
        .eq("delivery_id", deliveryId);
    }
    return { processed: true, action: "compliance_data_request_acknowledged", organizationId };
  }

  if (topic === "customers/redact") {
    // Redact any customer references if present in orders or logs
    const customerId = payload?.customer?.id;
    const ordersToRedact = Array.isArray(payload?.orders_to_redact) ? payload.orders_to_redact : [];
    logger.info("Executing Shopify customers/redact", { customerId, ordersCount: ordersToRedact.length, cleanShop });

    if (ordersToRedact.length > 0) {
      const orderIdStrings = ordersToRedact.map((id: any) => String(id));
      await supabase
        .from("shopify_orders")
        .update({
          raw_data: { redacted: true, redacted_at: nowIso },
          updated_at: nowIso,
        })
        .eq("organization_id", organizationId)
        .in("shopify_order_id", orderIdStrings);
    }

    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "processed", processed_at: nowIso })
        .eq("delivery_id", deliveryId);
    }
    return { processed: true, action: "compliance_customer_redacted", organizationId };
  }

  if (topic === "shop/redact") {
    // Fired 48 hours after uninstallation to purge all remaining merchant data
    logger.info("Executing Shopify shop/redact 48h purge", { cleanShop, organizationId });

    // 1. Permanently delete all catalog, inventory, order, and location data for this shop
    await Promise.all([
      supabase.from("shopify_product_variants").delete().eq("organization_id", organizationId),
      supabase.from("shopify_inventory_levels").delete().eq("organization_id", organizationId),
    ]);

    await Promise.all([
      supabase.from("shopify_products").delete().eq("organization_id", organizationId),
      supabase.from("shopify_orders").delete().eq("organization_id", organizationId),
      supabase.from("shopify_locations").delete().eq("organization_id", organizationId),
    ]);

    // 2. Mark integration record as permanently purged and remove all tokens and credentials
    await supabase
      .from("organization_integrations")
      .update({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        status: "disconnected",
        metadata: {
          shop_domain: cleanShop,
          purged_at: nowIso,
          redacted: true,
        },
        last_sync_at: null,
        updated_at: nowIso,
      })
      .eq("id", integrationId);

    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "processed", processed_at: nowIso })
        .eq("delivery_id", deliveryId);
    }
    return { processed: true, action: "compliance_shop_redacted", organizationId };
  }

  // 3. App Uninstalled: Cleanly mark integration as disconnected & wipe access token
  if (topic === "app/uninstalled") {
    const existingMeta = (integration.metadata || {}) as Record<string, any>;
    const updatedMeta = {
      ...existingMeta,
      uninstalled_at: nowIso,
      uninstalled_delivery_id: deliveryId,
    };

    await supabase
      .from("organization_integrations")
      .update({
        status: "disconnected",
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        metadata: updatedMeta,
        updated_at: nowIso,
      })
      .eq("id", integrationId);

    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "processed", processed_at: nowIso })
        .eq("delivery_id", deliveryId);
    }

    logger.info("Shopify integration marked as disconnected via app/uninstalled webhook", {
      organizationId,
      shop: cleanShop,
    });

    return { processed: true, action: "disconnected", organizationId };
  }

  // If integration is disconnected, ignore standard data sync webhooks
  if (integration.status !== "connected") {
    logger.info("Ignoring data webhook for disconnected Shopify store", { cleanShop, topic });
    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "ignored", processed_at: nowIso, error_message: "store_disconnected" })
        .eq("delivery_id", deliveryId);
    }
    return { processed: false, reason: "store_disconnected" };
  }

  // 4. Products Webhooks (create, update, delete)
  if (topic === "products/create" || topic === "products/update") {
    const prod = payload;
    if (prod && prod.id) {
      const shopifyProductId = String(prod.id);
      const incomingUpdatedAt = prod.updated_at || nowIso;

      // Timestamp Guard against out-of-order webhooks
      const { data: existingProd } = await supabase
        .from("shopify_products")
        .select("shopify_updated_at")
        .eq("organization_id", organizationId)
        .eq("shopify_product_id", shopifyProductId)
        .maybeSingle();

      if (
        existingProd?.shopify_updated_at &&
        new Date(incomingUpdatedAt).getTime() < new Date(existingProd.shopify_updated_at).getTime()
      ) {
        logger.info("Skipping out-of-order product update webhook", {
          shopifyProductId,
          incoming: incomingUpdatedAt,
          existing: existingProd.shopify_updated_at,
        });
        return { processed: true, action: "stale_update_skipped", organizationId };
      }

      const { data: upsertedProd } = await supabase
        .from("shopify_products")
        .upsert(
          {
            organization_id: organizationId,
            integration_id: integrationId,
            shopify_product_id: shopifyProductId,
            title: prod.title || "Untitled Product",
            handle: prod.handle || null,
            body_html: prod.body_html || null,
            vendor: prod.vendor || null,
            product_type: prod.product_type || null,
            status: prod.status || "active",
            published_at: prod.published_at || null,
            tags: prod.tags
              ? typeof prod.tags === "string"
                ? prod.tags.split(",").map((t: string) => t.trim())
                : prod.tags
              : [],
            images: prod.images || [],
            raw_data: { id: prod.id, handle: prod.handle },
            shopify_created_at: prod.created_at || nowIso,
            shopify_updated_at: incomingUpdatedAt,
            updated_at: nowIso,
          },
          { onConflict: "organization_id,shopify_product_id" }
        )
        .select("id")
        .single();

      // Upsert variants if present
      if (upsertedProd && Array.isArray(prod.variants)) {
        const variantRows = prod.variants.map((v: any) => ({
          organization_id: organizationId,
          product_id: upsertedProd.id,
          shopify_product_id: shopifyProductId,
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
          barcode: null,
          raw_data: { id: v.id, title: v.title },
          shopify_created_at: prod.created_at || nowIso,
          shopify_updated_at: incomingUpdatedAt,
          updated_at: nowIso,
        }));

        if (variantRows.length > 0) {
          await supabase
            .from("shopify_product_variants")
            .upsert(variantRows, { onConflict: "organization_id,shopify_variant_id" });
        }
      }
    }
  } else if (topic === "products/delete") {
    const prodId = payload?.id;
    if (prodId) {
      await supabase
        .from("shopify_products")
        .update({ status: "archived", updated_at: nowIso })
        .eq("organization_id", organizationId)
        .eq("shopify_product_id", String(prodId));
    }
  }

  // 5. Orders Webhooks (create, updated, cancelled, fulfilled, paid)
  if (topic.startsWith("orders/")) {
    const ord = payload;
    if (ord && ord.id) {
      const shopifyOrderId = String(ord.id);
      const incomingUpdatedAt = ord.updated_at || nowIso;

      const { data: existingOrd } = await supabase
        .from("shopify_orders")
        .select("shopify_updated_at")
        .eq("organization_id", organizationId)
        .eq("shopify_order_id", shopifyOrderId)
        .maybeSingle();

      if (
        existingOrd?.shopify_updated_at &&
        new Date(incomingUpdatedAt).getTime() < new Date(existingOrd.shopify_updated_at).getTime()
      ) {
        logger.info("Skipping out-of-order order update webhook", {
          shopifyOrderId,
          incoming: incomingUpdatedAt,
          existing: existingOrd.shopify_updated_at,
        });
        return { processed: true, action: "stale_order_skipped", organizationId };
      }

      await supabase.from("shopify_orders").upsert(
        {
          organization_id: organizationId,
          integration_id: integrationId,
          shopify_order_id: shopifyOrderId,
          order_number: ord.order_number,
          name: ord.name || `#${ord.order_number}`,
          currency: ord.currency || "USD",
          financial_status: ord.financial_status || "pending",
          fulfillment_status: ord.fulfillment_status || "unfulfilled",
          subtotal_price: parseFloat(ord.subtotal_price) || 0.0,
          total_tax: parseFloat(ord.total_tax) || 0.0,
          total_price: parseFloat(ord.current_total_price || ord.total_price) || 0.0,
          line_items_count: ord.line_items ? ord.line_items.length : 0,
          line_items: (ord.line_items || []).map((li: any) => ({
            id: li.id,
            title: li.title,
            quantity: li.quantity,
            price: li.price,
            sku: li.sku,
            variant_title: li.variant_title,
          })),
          raw_data: { id: ord.id, name: ord.name, order_number: ord.order_number },
          shopify_created_at: ord.created_at || nowIso,
          shopify_updated_at: incomingUpdatedAt,
          cancelled_at: ord.cancelled_at || null,
          cancel_reason: ord.cancel_reason || null,
          updated_at: nowIso,
        },
        { onConflict: "organization_id,shopify_order_id" }
      );
    }
  }

  // 6. Inventory Levels Webhooks
  if (topic === "inventory_levels/connect" || topic === "inventory_levels/update") {
    const lvl = payload;
    if (lvl && lvl.inventory_item_id && lvl.location_id) {
      await supabase.from("shopify_inventory_levels").upsert(
        {
          organization_id: organizationId,
          shopify_inventory_item_id: String(lvl.inventory_item_id),
          shopify_location_id: String(lvl.location_id),
          available: lvl.available !== null && lvl.available !== undefined ? lvl.available : 0,
          shopify_updated_at: lvl.updated_at || nowIso,
          raw_data: lvl,
          updated_at: nowIso,
        },
        { onConflict: "organization_id,shopify_inventory_item_id,shopify_location_id" }
      );
    }
  } else if (topic === "inventory_levels/disconnect") {
    const lvl = payload;
    if (lvl && lvl.inventory_item_id && lvl.location_id) {
      await supabase
        .from("shopify_inventory_levels")
        .delete()
        .eq("organization_id", organizationId)
        .eq("shopify_inventory_item_id", String(lvl.inventory_item_id))
        .eq("shopify_location_id", String(lvl.location_id));
    }
  }

  // 7. Update integration metadata
  const existingMeta = (integration.metadata || {}) as Record<string, any>;
  const updatedMeta = {
    ...existingMeta,
    last_synced_at: nowIso,
    last_webhook_topic: topic,
  };

  await supabase
    .from("organization_integrations")
    .update({
      last_sync_at: nowIso,
      metadata: updatedMeta,
      updated_at: nowIso,
    })
    .eq("id", integrationId);

  // Mark webhook event record as processed
  if (deliveryId) {
    await supabase
      .from("shopify_webhook_events")
      .update({ status: "processed", processed_at: nowIso })
      .eq("delivery_id", deliveryId);
  }

  return { processed: true, action: "synced", organizationId };
}

/**
 * Reprocesses a previously failed or pending webhook event from shopify_webhook_events.
 */
export async function reprocessShopifyWebhookEvent(
  deliveryId: string,
  customSupabaseClient?: any
): Promise<WebhookProcessResult> {
  const supabase = customSupabaseClient || createServiceClient();

  const { data: event, error } = await supabase
    .from("shopify_webhook_events")
    .select("*")
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (error || !event) {
    return { processed: false, reason: "event_not_found" };
  }

  // Increment attempts counter
  await supabase
    .from("shopify_webhook_events")
    .update({ attempts: (event.attempts || 1) + 1, updated_at: new Date().toISOString() })
    .eq("delivery_id", deliveryId);

  return processShopifyWebhookEvent(
    event.topic,
    event.shop_domain,
    event.payload,
    undefined, // Do not duplicate delivery check
    event.api_version,
    supabase
  );
}
