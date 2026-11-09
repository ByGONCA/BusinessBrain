// ==============================================================================
// KogSync: Linear Intelligence Data Provider Configuration
// ==============================================================================

import { getOAuthCallbackUrl } from "@/lib/security/redirects";

export const LINEAR_API_BASE_URL = "https://api.linear.app";
export const LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql";

// Least-privilege OAuth scope for external intelligence provider data access
export const LINEAR_OAUTH_SCOPES = ["read"] as const;

export function getLinearConfig() {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const redirectUri = getOAuthCallbackUrl("linear");

  return {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret),
  };
}
