// ==============================================================================
// KogSync: Shopify Webhook Verification & Real-Time Cache Invalidation Engine
// API-First architecture: webhooks act as real-time cache invalidation triggers
// and compliance ledgers, eliminating permanent database duplication of catalog data.
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { sanitizeShopDomain } from "./config";
import { shopifyCache } from "../cache";
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
 * Idempotently handles verified incoming Shopify webhook events:
 * 1. Checks delivery deduplication in shopify_webhook_events
 * 2. Processes mandatory GDPR compliance requests
 * 3. Triggers real-time cache invalidation for catalog/order queries
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

    // Record incoming webhook delivery (minimal metadata for deduplication and audit)
    await supabase.from("shopify_webhook_events").insert({
      organization_id: organizationId,
      integration_id: integrationId,
      delivery_id: deliveryId,
      topic,
      shop_domain: cleanShop,
      api_version: apiVersion || "2026-10",
      payload: typeof payload === "object" ? { topic, id: payload?.id } : {},
      status: "processing",
    });
  }

  // 2. Mandatory Privacy & GDPR Compliance Webhooks
  if (topic === "customers/data_request") {
    // Customer requested personal data. KogSync does not retain personal customer PII.
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
    // Redact any customer references and invalidate cache
    const customerId = payload?.customer?.id;
    logger.info("Executing Shopify customers/redact", { customerId, cleanShop });
    shopifyCache.invalidateTenant(organizationId, "shopify");

    if (deliveryId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "processed", processed_at: nowIso })
        .eq("delivery_id", deliveryId);
    }
    return { processed: true, action: "compliance_customer_redacted", organizationId };
  }

  if (topic === "shop/redact") {
    // Fired 48 hours after uninstallation to purge all merchant data
    logger.info("Executing Shopify shop/redact 48h purge", { cleanShop, organizationId });
    shopifyCache.invalidateTenant(organizationId, "shopify");

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

  // 3. App Uninstalled: Cleanly mark integration as disconnected, wipe access token & bust cache
  if (topic === "app/uninstalled") {
    shopifyCache.invalidateTenant(organizationId, "shopify");

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

  // If integration is disconnected, ignore standard data webhooks
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

  // 4. Real-time Cache Invalidation for Data Topics (Products, Orders, Inventory)
  // Instead of permanent DB duplication, webhooks bust the in-memory cache so subsequent reads query fresh API data
  if (
    topic.startsWith("products/") ||
    topic.startsWith("orders/") ||
    topic.startsWith("inventory_levels/")
  ) {
    const invalidatedCount = shopifyCache.invalidateTenant(organizationId, "shopify");
    logger.info("Shopify webhook invalidated tenant cache", {
      organizationId,
      topic,
      invalidatedCount,
    });
  }

  // 5. Update integration metadata (last_synced_at and last_webhook_topic)
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

  // Mark webhook event record as processed in audit log
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
    .update({ attempts: (event.attempts || 1) + 1 })
    .eq("delivery_id", deliveryId);

  return processShopifyWebhookEvent(
    event.topic,
    event.shop_domain,
    event.payload,
    undefined,
    event.api_version,
    supabase
  );
}
