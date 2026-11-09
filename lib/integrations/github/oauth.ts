// ==============================================================================
// Company Brain: GitHub OAuth 2.0 Security & State Manager
// ==============================================================================

import crypto from "crypto";
import { getGitHubConfig, GITHUB_OAUTH_SCOPES, GITHUB_OAUTH_ENDPOINTS } from "./config";
import { signOAuthStatePayload, verifyOAuthStateSignature } from "@/lib/security/oauth-state";
import { getOAuthCallbackUrl } from "@/lib/security/redirects";

export interface GitHubAuthStatePayload {
  organizationId: string;
  userId: string;
  returnUrl?: string;
  nonce: string;
  timestamp: number;
}

/**
 * Creates an HMAC-signed state parameter to prevent CSRF attacks during the OAuth flow.
 * Signed strictly using the dedicated OAUTH_STATE_SECRET.
 */
export function createGitHubOAuthState(
  payload: Omit<GitHubAuthStatePayload, "nonce" | "timestamp">
): string {
  const fullPayload: GitHubAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(jsonStr).toString("base64url");
  const signature = signOAuthStatePayload(base64Data);

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed OAuth state parameter using timing-safe comparison.
 * Verified strictly using the dedicated OAUTH_STATE_SECRET.
 */
export function verifyGitHubOAuthState(state: string): GitHubAuthStatePayload | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;

    const [base64Data, signature] = parts;
    if (!verifyOAuthStateSignature(base64Data, signature)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr) as GitHubAuthStatePayload;

    // Reject state older than 15 minutes to prevent replay attacks
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - payload.timestamp > fifteenMinutes) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates the GitHub OAuth authorize redirect URL.
 */
export function generateGitHubAuthUrl(options: {
  organizationId: string;
  userId: string;
  returnUrl?: string;
}): string {
  const { clientId } = getGitHubConfig();
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID environment variable is missing.");
  }

  const state = createGitHubOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    returnUrl: options.returnUrl,
  });

  const redirectUri = getOAuthCallbackUrl("github");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPES.join(" "),
    state,
  });

  const query = params.toString().replace(/\+/g, "%20");
  return `${GITHUB_OAUTH_ENDPOINTS.authorize}?${query}`;
}

export interface GitHubTokenExchangeResult {
  access_token: string;
  token_type: string;
  scope: string;
}

/**
 * Exchanges the authorization code for an OAuth access token.
 */
export async function exchangeGitHubCodeForToken(code: string): Promise<GitHubTokenExchangeResult> {
  const { clientId, clientSecret } = getGitHubConfig();
  if (!clientId || !clientSecret) {
    throw new Error("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is not configured.");
  }

  const redirectUri = getOAuthCallbackUrl("github");

  const response = await fetch(GITHUB_OAUTH_ENDPOINTS.accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data as GitHubTokenExchangeResult;
}

/**
 * Revokes a GitHub access token or application grant via GitHub's REST API.
 */
export async function revokeGitHubToken(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;

  const { clientId, clientSecret } = getGitHubConfig();
  if (!clientId || !clientSecret) {
    return false;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    // GitHub provides DELETE /applications/{client_id}/grant to revoke user authorization,
    // or DELETE /applications/{client_id}/token to revoke the specific token.
    const response = await fetch(`https://api.github.com/applications/${clientId}/grant`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${credentials}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (response.status === 204 || response.ok) {
      return true;
    }

    // Fallback: try deleting the token specifically if grant delete wasn't supported
    const tokenResponse = await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${credentials}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    return tokenResponse.status === 204 || tokenResponse.ok;
  } catch {
    // Non-fatal if GitHub is unreachable during local dev or testing
    return false;
  }
}

