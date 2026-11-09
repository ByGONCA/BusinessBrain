// ==============================================================================
// KogSync: Shopify Webhook Signature Verification & Event Sync Engine
// ==============================================================================

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
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
 * Idempotently handles verified incoming Shopify webhook events.
 */
export async function processShopifyWebhookEvent(
  topic: string,
  rawShopDomain: string,
  payload: any,
  deliveryId?: string
): Promise<WebhookProcessResult> {
  const cleanShop = sanitizeShopDomain(rawShopDomain);
  if (!cleanShop) {
    logger.warn("Rejected webhook with invalid shop domain", { rawShopDomain, topic });
    return { processed: false, reason: "invalid_shop_domain" };
  }

  const supabase = await createClient();

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

  if (integration.status !== "connected" && topic !== "app/uninstalled") {
    logger.info("Ignoring webhook for disconnected Shopify store", { cleanShop, topic });
    return { processed: false, reason: "store_disconnected" };
  }

  const organizationId = integration.organization_id;
  const nowIso = new Date().toISOString();

  // 1. App Uninstalled: Cleanly mark integration as disconnected & wipe access token
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
      .eq("id", integration.id);

    logger.info("Shopify integration marked as disconnected via app/uninstalled webhook", {
      organizationId,
      shop: cleanShop,
    });

    return { processed: true, action: "disconnected", organizationId };
  }

  // 2. Data synchronizations (products, orders, inventory)
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
    .eq("id", integration.id);

  return { processed: true, action: "synced", organizationId };
}
