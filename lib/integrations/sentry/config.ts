// ==============================================================================
// KogSync: Multi-Tenant Sentry OAuth 2.0 Configuration
// ==============================================================================

import { getOAuthCallbackUrl } from "@/lib/security/redirects";

export const SENTRY_DEFAULT_API_BASE = "https://sentry.io/api/0";
export const SENTRY_EU_API_BASE = "https://de.sentry.io/api/0";

export const SENTRY_OAUTH_ENDPOINTS = {
  authorize: "https://sentry.io/oauth/authorize/",
  token: "https://sentry.io/oauth/token/",
} as const;

/**
 * Least-privilege OAuth scopes strictly required for multi-tenant error intelligence:
 * - org:read: read organization membership and metadata
 * - project:read: list and inspect workspace projects
 * - event:read: read issues, error occurrences, stack traces, tags and events
 */
export const SENTRY_OAUTH_SCOPES = [
  "org:read",
  "project:read",
  "event:read",
] as const;

export function getSentryOAuthConfig(request?: Request) {
  const clientId = process.env.SENTRY_CLIENT_ID;
  const clientSecret = process.env.SENTRY_CLIENT_SECRET;
  const redirectUri = getOAuthCallbackUrl("sentry", request);

  return {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret),
  };
}
