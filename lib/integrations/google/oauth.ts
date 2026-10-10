import crypto from "crypto";
import {
  getGoogleConfig,
  DEFAULT_GOOGLE_INTEGRATION_SCOPES,
  GMAIL_INTEGRATION_SCOPES,
  CALENDAR_INTEGRATION_SCOPES,
  DRIVE_INTEGRATION_SCOPES,
} from "./config";

export interface AuthStatePayload {
  organizationId: string;
  userId: string;
  service?: "gmail" | "google_calendar" | "google" | "google_drive" | "drive";
  returnUrl?: string;
  nonce: string;
  timestamp: number;
}

function getHmacSecret(): string {
  const secret =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.STRIPE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATION_TOKEN_ENCRYPTION_KEY or STRIPE_SECRET_KEY is required in production for OAuth state integrity."
      );
    }
    return "company-brain-oauth-hmac-dev-key";
  }

  return secret;
}

/**
 * Creates an HMAC-signed state parameter to prevent CSRF attacks during the OAuth flow.
 */
export function createOAuthState(payload: Omit<AuthStatePayload, "nonce" | "timestamp">): string {
  const fullPayload: AuthStatePayload = {
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
 * Validates and unpacks an HMAC-signed OAuth state parameter.
 */
export function verifyOAuthState(state: string): AuthStatePayload | null {
  try {
    const [base64Data, signature] = state.split(".");
    if (!base64Data || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getHmacSecret())
      .update(base64Data)
      .digest("base64url");

    // Use timing-safe comparison to prevent timing-oracle attacks
    const sigBuf = Buffer.from(signature, "base64url");
    const expBuf = Buffer.from(expectedSignature, "base64url");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf8");
    const payload: AuthStatePayload = JSON.parse(jsonStr);

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
 * Builds the Google OAuth 2.0 authorization URL.
 */
export function generateGoogleAuthUrl(options: {
  organizationId: string;
  userId: string;
  service?: "gmail" | "google_calendar" | "google" | "google_drive" | "drive";
  returnUrl?: string;
  scopes?: string[];
}): string {
  const { clientId, redirectUri, isConfigured } = getGoogleConfig();

  if (!isConfigured) {
    throw new Error(
      "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  const state = createOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    service: options.service,
    returnUrl: options.returnUrl,
  });

  let defaultScopes = DEFAULT_GOOGLE_INTEGRATION_SCOPES;
  if (options.service === "gmail") {
    defaultScopes = GMAIL_INTEGRATION_SCOPES;
  } else if (options.service === "google_calendar") {
    defaultScopes = CALENDAR_INTEGRATION_SCOPES;
  } else if (options.service === "google_drive" || options.service === "drive") {
    defaultScopes = DRIVE_INTEGRATION_SCOPES;
  }

  const scopes = options.scopes || defaultScopes;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens.
 */
export async function exchangeGoogleCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const { clientId, clientSecret } = getGoogleConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Revokes access / refresh tokens with Google when disconnecting an integration.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  } catch (err) {
    console.warn("Failed to revoke Google token with external provider:", err);
  }
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Fetches basic profile information for the authenticated Google user.
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info: ${response.statusText}`);
  }

  return response.json();
}
