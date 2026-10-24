import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/security/logger";
import { verifyGitHubWebhookSignature, processGitHubWebhookEvent } from "@/lib/integrations/github/sync";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const headerList = await headers();
  const signature = headerList.get("x-hub-signature-256");
  const event = headerList.get("x-github-event");
  const deliveryId = headerList.get("x-github-delivery");

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  // In production, webhook secret is strictly required to prevent forged event injection
  if (!webhookSecret && process.env.NODE_ENV === "production") {
    logger.error("GITHUB_WEBHOOK_SECRET is not configured in production environment.");
    return NextResponse.json({ error: "Webhook endpoint not configured." }, { status: 500 });
  }

  // Strictly enforce signature verification whenever secret is configured
  if (webhookSecret) {
    const isValid = verifyGitHubWebhookSignature(bodyText, signature, webhookSecret);
    if (!isValid) {
      logger.warn("GitHub webhook signature verification failed", { deliveryId, event });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  if (!event) {
    return NextResponse.json({ error: "Missing x-github-event header." }, { status: 400 });
  }

  // Ping event: return 200 OK
  if (event === "ping") {
    return NextResponse.json({ message: "pong", deliveryId }, { status: 200 });
  }

  try {
    const payload = JSON.parse(bodyText);
    const result = await processGitHubWebhookEvent(event, payload);

    return NextResponse.json({ success: true, event, deliveryId, result });
  } catch (err: any) {
    logger.error("Failed to process GitHub webhook", err, { deliveryId, event });
    return NextResponse.json(
      { error: "Internal server error during webhook processing." },
      { status: 500 }
    );
  }
}
