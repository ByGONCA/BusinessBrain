import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/security/logger";
import {
  verifyShopifyWebhookHmac,
  processShopifyWebhookEvent,
} from "@/lib/integrations/shopify/sync";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const headerList = await headers();
  const signature = headerList.get("x-shopify-hmac-sha256");
  const topic = headerList.get("x-shopify-topic");
  const shopDomain = headerList.get("x-shopify-shop-domain");
  const webhookId = headerList.get("x-shopify-webhook-id") || undefined;

  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET;

  // In production, webhook secret is strictly required to prevent forged event injection
  if (!webhookSecret && process.env.NODE_ENV === "production") {
    logger.error("SHOPIFY_WEBHOOK_SECRET / SHOPIFY_API_SECRET is not configured in production.");
    return NextResponse.json({ error: "Webhook endpoint not configured." }, { status: 500 });
  }

  // Strictly enforce signature verification whenever secret is configured
  if (webhookSecret) {
    const isValid = verifyShopifyWebhookHmac(bodyText, signature, webhookSecret);
    if (!isValid) {
      logger.warn("Shopify webhook signature verification failed", { webhookId, topic, shopDomain });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  if (!topic || !shopDomain) {
    return NextResponse.json({ error: "Missing required Shopify webhook headers." }, { status: 400 });
  }

  try {
    let payload = {};
    if (bodyText.trim()) {
      payload = JSON.parse(bodyText);
    }

    const result = await processShopifyWebhookEvent(topic, shopDomain, payload, webhookId);

    return NextResponse.json({
      success: true,
      topic,
      shopDomain,
      webhookId,
      result,
    });
  } catch (err: unknown) {
    logger.error("Failed to process Shopify webhook", err, { webhookId, topic, shopDomain });
    return NextResponse.json(
      { error: "Internal server error during webhook processing." },
      { status: 500 }
    );
  }
}
