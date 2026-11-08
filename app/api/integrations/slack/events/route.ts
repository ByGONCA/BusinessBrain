import { NextRequest, NextResponse } from "next/server";
import { getSlackConfig } from "@/lib/integrations/slack/config";
import {
  verifySlackWebhookSignature,
  processSlackWebhookEvent,
} from "@/lib/integrations/slack/sync";
import { logger } from "@/lib/security/logger";

/**
 * Slack Events API Webhook Receiver
 *
 * 1. Responds to Slack's 'url_verification' handshake by returning the challenge value.
 * 2. Cryptographically verifies inbound request signatures (v0=hmac_sha256).
 * 3. Ingests authorized event callbacks (e.g. messages) into external_discussions.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return new NextResponse("Empty request body", { status: 400 });
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    const { signingSecret } = getSlackConfig();
    const timestampHeader = request.headers.get("x-slack-request-timestamp");
    const signatureHeader = request.headers.get("x-slack-signature");

    // 1. Handle Slack URL Verification Handshake
    if (payload.type === "url_verification") {
      // If signingSecret is configured and signature headers are provided, verify signature
      if (signingSecret && signatureHeader && timestampHeader) {
        const isValid = verifySlackWebhookSignature(
          rawBody,
          timestampHeader,
          signatureHeader,
          signingSecret
        );
        if (!isValid) {
          logger.warn("Slack url_verification signature mismatch");
          return new NextResponse("Unauthorized", { status: 401 });
        }
      }

      logger.info("Slack url_verification challenge received and answered successfully");
      return NextResponse.json({ challenge: payload.challenge });
    }

    // 2. Verify Cryptographic Signature for all event callbacks
    if (signingSecret) {
      const isValid = verifySlackWebhookSignature(
        rawBody,
        timestampHeader,
        signatureHeader,
        signingSecret
      );

      if (!isValid) {
        logger.warn("Slack event signature verification failed", {
          hasTimestamp: Boolean(timestampHeader),
          hasSignature: Boolean(signatureHeader),
        });
        return new NextResponse("Invalid signature", { status: 401 });
      }
    }

    // 3. Process event asynchronously / in background
    if (payload.type === "event_callback") {
      // Fire-and-forget background processing to respond within Slack's 3-second limit
      processSlackWebhookEvent(payload).catch((err) => {
        logger.error("Failed to process Slack event callback", err);
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    logger.error("Unhandled error in Slack events endpoint", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
