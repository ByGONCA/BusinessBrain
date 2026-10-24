// ==============================================================================
// Company Brain: Slack OAuth 2.0 Security & Token Handler
// ==============================================================================

import crypto from "crypto";
import { getSlackConfig } from "./config";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";

export interface SlackAuthStatePayload {
  organizationId: string;
  userId: string;
  returnUrl?: string;
  nonce: string;
  timestamp: number;
}

function getHmacSecret(): string {
  return (
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    "company-brain-slack-hmac-dev-key"
  );
}

/**
 * Creates an HMAC-signed state parameter to prevent CSRF during Slack OAuth flow.
 */
export function createSlackOAuthState(
  payload: Omit<SlackAuthStatePayload, "nonce" | "timestamp">
): string {
  const fullPayload: SlackAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getHmacSecret())
    .update(base64Data)
    .digest("base64url");

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed OAuth state parameter using timing-safe comparison.
 */
export function verifySlackOAuthState(state: string): SlackAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", getHmacSecret())
      .update(base64Data)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(expectedSignature, "utf-8")
      )
    ) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload: SlackAuthStatePayload = JSON.parse(jsonStr);

    // Expire state after 15 minutes
    if (Date.now() - payload.timestamp > 15 * 60 * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates the Slack OAuth v2 authorization URL.
 */
export function getSlackAuthorizeUrl(state: string): string {
  const config = getSlackConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(","),
    redirect_uri: config.redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchanges a Slack authorization code for access and webhook tokens and saves to database.
 */
export async function exchangeSlackCodeForToken(
  code: string,
  statePayload: SlackAuthStatePayload
): Promise<{ success: boolean; teamName?: string; error?: string }> {
  const config = getSlackConfig();

  const bodyParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    throw new Error(`Slack OAuth token exchange failed with HTTP status ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    logger.error("Slack OAuth token error response", { error: data.error });
    return { success: false, error: data.error || "Failed to exchange Slack token" };
  }

  const teamId = data.team?.id || data.enterprise?.id || "unknown_team";
  const teamName = data.team?.name || "Slack Workspace";
  const botUserId = data.bot_user_id;
  const accessToken = data.access_token;
  const incomingWebhook = data.incoming_webhook;

  const encryptedAccessToken = encryptToken(accessToken);
  const supabase = createServiceClient();

  const { error: upsertErr } = await supabase
    .from("organization_integrations")
    .upsert(
      {
        organization_id: statePayload.organizationId,
        provider: "slack",
        provider_account_id: teamId,
        account_email: data.authed_user?.id ? `user_${data.authed_user.id}@slack.com` : null,
        connected_by_user_id: statePayload.userId,
        status: "connected",
        scopes: data.scope ? data.scope.split(",") : config.scopes,
        encrypted_access_token: encryptedAccessToken,
        metadata: {
          team_id: teamId,
          team_name: teamName,
          bot_user_id: botUserId,
          incoming_webhook: incomingWebhook,
          authed_user: data.authed_user,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id, provider, provider_account_id" }
    );

  if (upsertErr) {
    logger.error("Failed to store Slack integration credentials", upsertErr);
    return { success: false, error: "Database error persisting Slack credentials." };
  }

  return { success: true, teamName };
}
