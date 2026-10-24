import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/security/logger";
import { verifySlackWebhookSignature, processSlackWebhookEvent } from "@/lib/integrations/slack/sync";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const headerList = await headers();
  const signature = headerList.get("x-slack-signature");
  const timestamp = headerList.get("x-slack-request-timestamp");

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Handle Slack URL Verification Challenge immediately (even during app setup)
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge }, { status: 200 });
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // In production, signing secret is strictly required to prevent forged event injection
  if (!signingSecret && process.env.NODE_ENV === "production") {
    logger.error("SLACK_SIGNING_SECRET is not configured in production environment.");
    return NextResponse.json({ error: "Webhook endpoint not configured." }, { status: 500 });
  }

  // Verify HMAC-SHA256 signature if secret is configured
  if (signingSecret) {
    const isValid = verifySlackWebhookSignature(bodyText, timestamp, signature, signingSecret);
    if (!isValid) {
      logger.warn("Slack webhook signature verification failed", { timestamp });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  try {
    const result = await processSlackWebhookEvent(payload);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    logger.error("Failed to process Slack webhook event", err);
    return NextResponse.json(
      { error: "Internal server error during event processing" },
      { status: 500 }
    );
  }
}
