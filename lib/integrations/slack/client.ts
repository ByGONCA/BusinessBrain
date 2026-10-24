// ==============================================================================
// Company Brain: Slack Server-Side API Client
// Channel discovery, message ingestion, and decision/ADR notifications
// ==============================================================================

import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  num_members?: number;
  topic?: { value: string };
  purpose?: { value: string };
}

export interface SlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}

/**
 * Retrieves the decrypted bot token for the organization's Slack integration.
 */
export async function getDecryptedSlackToken(organizationId: string): Promise<{
  token: string;
  teamId: string;
  teamName: string;
  botUserId?: string;
  incomingWebhookUrl?: string;
} | null> {
  const supabase = createServiceClient();

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, encrypted_access_token, provider_account_id, metadata, status")
    .eq("organization_id", organizationId)
    .eq("provider", "slack")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !integration || !integration.encrypted_access_token) {
    return null;
  }

  try {
    const token = decryptToken(integration.encrypted_access_token);
    const meta = (integration.metadata as any) || {};

    return {
      token,
      teamId: integration.provider_account_id,
      teamName: meta.team_name || "Slack Workspace",
      botUserId: meta.bot_user_id,
      incomingWebhookUrl: meta.incoming_webhook?.url,
    };
  } catch (err) {
    logger.error("Failed to decrypt Slack token", err, { organizationId });
    return null;
  }
}

/**
 * Lists public and private channels accessible to the Slack bot in the workspace.
 */
export async function listSlackChannels(organizationId: string): Promise<SlackChannel[]> {
  const creds = await getDecryptedSlackToken(organizationId);
  if (!creds) {
    throw new Error("Slack is not connected for this organization.");
  }

  const res = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200",
    {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Slack API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return (data.channels || []).map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    is_private: Boolean(ch.is_private),
    is_archived: Boolean(ch.is_archived),
    num_members: ch.num_members,
    topic: ch.topic,
    purpose: ch.purpose,
  }));
}

/**
 * Fetches recent message history from a Slack channel.
 */
export async function getSlackChannelHistory(
  organizationId: string,
  channelId: string,
  limit = 50
): Promise<SlackMessage[]> {
  const creds = await getDecryptedSlackToken(organizationId);
  if (!creds) {
    throw new Error("Slack is not connected for this organization.");
  }

  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Slack API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages || [];
}

/**
 * Posts a message to a Slack channel or via incoming webhook.
 */
export async function postSlackMessage(
  organizationId: string,
  channelId: string,
  text: string,
  blocks?: any[]
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const creds = await getDecryptedSlackToken(organizationId);
  if (!creds) {
    throw new Error("Slack is not connected for this organization.");
  }

  const body: Record<string, unknown> = {
    channel: channelId,
    text,
  };
  if (blocks && blocks.length > 0) {
    body.blocks = blocks;
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    logger.error("Failed to post message to Slack", { channelId, error: data.error });
    return { ok: false, error: data.error };
  }

  return { ok: true, ts: data.ts };
}

/**
 * Formats and posts an architectural decision (ADR) or company decision notification to Slack.
 */
export async function postDecisionNotification(
  organizationId: string,
  channelId: string,
  decision: {
    title: string;
    summary: string;
    author: string;
    url?: string;
    decisionType?: "ADR" | "Policy" | "Milestone" | "Strategic";
  }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const badge = decision.decisionType ? `[${decision.decisionType}] ` : "🧠 ";
  const fallbackText = `${badge}${decision.title} — recorded by ${decision.author}`;

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${badge}${decision.title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Author:* ${decision.author}\n*Summary:* ${decision.summary}`,
      },
    },
  ];

  if (decision.url) {
    blocks.push({
      type: "actions" as any,
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View in BusinessBrain",
            emoji: true,
          },
          url: decision.url,
          style: "primary",
        },
      ] as any,
    });
  }

  return postSlackMessage(organizationId, channelId, fallbackText, blocks);
}
