// ==============================================================================
// Company Brain: Slack Integration Configuration
// Defines OAuth scopes, environment variable accessors, and API endpoints
// ==============================================================================

export const SLACK_SCOPES: string[] = [
  "channels:read",
  "channels:history",
  "chat:write",
  "groups:read",
  "groups:history",
  "users:read",
  "incoming-webhook",
];

export function getSlackConfig() {
  const clientId = process.env.SLACK_CLIENT_ID || "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET || "";
  const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
  const redirectUri =
    process.env.SLACK_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/slack/callback`;

  return {
    clientId,
    clientSecret,
    signingSecret,
    redirectUri,
    scopes: SLACK_SCOPES,
  };
}
