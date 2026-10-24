// ==============================================================================
// Company Brain: Slack Continuous Ingestion & Webhook Processor
// Signature verification with replay-attack protection (< 5 min) and external_discussions sync
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getSlackChannelHistory, listSlackChannels } from "./client";
import { logger } from "@/lib/security/logger";

/**
 * Cryptographically verifies Slack webhook request signature.
 * Slack v0 signature format: v0=hmac_sha256(signingSecret, "v0:" + timestamp + ":" + rawBody)
 * Enforces strict timestamp check to prevent replay attacks (< 300s).
 */
export function verifySlackWebhookSignature(
  rawBody: string,
  timestampHeader: string | null | undefined,
  signatureHeader: string | null | undefined,
  signingSecret: string
): boolean {
  if (!timestampHeader || !signatureHeader || !signingSecret) {
    return false;
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return false;
  }

  // Anti-replay protection: Reject requests older or newer than 5 minutes (300 seconds)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const calculatedSignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring, "utf8")
    .digest("hex")}`;

  if (calculatedSignature.length !== signatureHeader.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Synchronizes messages from a specific Slack channel into public.external_discussions.
 */
export async function syncSlackChannelMessages(
  organizationId: string,
  channelId: string,
  channelName?: string
): Promise<{ syncedCount: number; failedCount: number }> {
  const supabase = createServiceClient();
  const startTime = new Date();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "slack",
      sync_type: "channel_messages",
      status: "in_progress",
      details: { channelId, channelName },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const messages = await getSlackChannelHistory(organizationId, channelId, 50);

    for (const msg of messages) {
      if (!msg.text || msg.type !== "message") continue;

      try {
        const externalId = `slack_${channelId}_${msg.ts}`;

        await supabase.from("external_discussions").upsert(
          {
            organization_id: organizationId,
            provider: "slack",
            external_id: externalId,
            external_thread_id: msg.thread_ts || null,
            channel_or_repo: channelName ? `#${channelName}` : channelId,
            title: msg.text.length > 80 ? `${msg.text.slice(0, 77)}...` : msg.text,
            body: msg.text,
            author_name: msg.user || "Slack User",
            metadata: {
              ts: msg.ts,
              thread_ts: msg.thread_ts,
              reply_count: msg.reply_count || 0,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, provider, external_id" }
        );
        syncedCount++;
      } catch (upsertErr) {
        failedCount++;
      }
    }

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: failedCount > 0 ? "partial" : "completed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          details: { channelId, durationMs: Date.now() - startTime.getTime() },
        })
        .eq("id", logId);
    }

    return { syncedCount, failedCount };
  } catch (err: any) {
    logger.error("Failed to sync Slack channel messages", err, { organizationId, channelId });

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: "failed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          error_message: err.message,
        })
        .eq("id", logId);
    }

    throw err;
  }
}

/**
 * Handles incoming Slack event callbacks (e.g., message posted, app mention).
 */
export async function processSlackWebhookEvent(
  payload: any
): Promise<{ processed: boolean; reason?: string }> {
  const supabase = createServiceClient();

  const teamId = payload.team_id || payload.event?.team || payload.enterprise_id;
  const event = payload.event;

  if (!teamId || !event) {
    return { processed: false, reason: "Missing team_id or event in payload." };
  }

  // Find organization connected to this Slack team
  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, organization_id")
    .eq("provider", "slack")
    .eq("provider_account_id", teamId)
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) {
    return { processed: false, reason: "No organization found matching Slack team." };
  }

  const organizationId = integration.organization_id;

  if (event.type === "message" && event.text && !event.subtype) {
    const channelId = event.channel;
    const externalId = `slack_${channelId}_${event.ts}`;

    await supabase.from("external_discussions").upsert(
      {
        organization_id: organizationId,
        provider: "slack",
        external_id: externalId,
        external_thread_id: event.thread_ts || null,
        channel_or_repo: channelId,
        title: event.text.length > 80 ? `${event.text.slice(0, 77)}...` : event.text,
        body: event.text,
        author_name: event.user || "Slack User",
        metadata: {
          ts: event.ts,
          thread_ts: event.thread_ts,
          channel: channelId,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id, provider, external_id" }
    );

    return { processed: true, reason: "Message persisted." };
  }

  return { processed: false, reason: `Ignored event type: ${event.type}` };
}
