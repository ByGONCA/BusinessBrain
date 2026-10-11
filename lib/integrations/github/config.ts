// ==============================================================================
// Company Brain: GitHub Integration Configuration
// ==============================================================================

export const GITHUB_OAUTH_SCOPES = [
  "repo", // Access public and private repositories (read-only usage in BusinessBrain)
  "read:user", // Read user profile info
  "user:email", // Access primary email for account identification
  "read:org", // Read organization membership and repos
] as const;

export const GITHUB_OAUTH_ENDPOINTS = {
  authorize: "https://github.com/login/oauth/authorize",
  accessToken: "https://github.com/login/oauth/access_token",
} as const;

export const GITHUB_API_BASE_URL = "https://api.github.com";

export function getGitHubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appSlug = process.env.GITHUB_APP_SLUG || "";

  return {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    appSlug,
    isConfigured: Boolean(clientId && clientSecret),
  };
}
