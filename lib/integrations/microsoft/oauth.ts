import crypto from "crypto";
import {
  getMicrosoftConfig,
  DEFAULT_MICROSOFT_SCOPES,
  OUTLOOK_CALENDAR_SCOPES,
  OUTLOOK_MAIL_SCOPES,
} from "./config";

export interface MicrosoftAuthStatePayload {
  organizationId: string;
  userId: string;
  service?: "outlook" | "outlook_calendar";
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
 * Creates an HMAC-signed state parameter to prevent CSRF attacks during the Microsoft OAuth flow.
 */
export function createMicrosoftOAuthState(
  payload: Omit<MicrosoftAuthStatePayload, "nonce" | "timestamp">
): string {
  const fullPayload: MicrosoftAuthStatePayload = {
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
 * Validates and unpacks an HMAC-signed Microsoft OAuth state parameter.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyMicrosoftOAuthState(state: string): MicrosoftAuthStatePayload | null {
  try {
    const [base64Data, signature] = state.split(".");
    if (!base64Data || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getHmacSecret())
      .update(base64Data)
      .digest("base64url");

    const sigBuf = Buffer.from(signature, "base64url");
    const expBuf = Buffer.from(expectedSignature, "base64url");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf8");
    const payload: MicrosoftAuthStatePayload = JSON.parse(jsonStr);

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
 * Builds the Microsoft OAuth 2.0 authorization URL.
 */
export function generateMicrosoftAuthUrl(options: {
  organizationId: string;
  userId: string;
  service?: "outlook" | "outlook_calendar";
  returnUrl?: string;
  scopes?: string[];
}): string {
  const { clientId, tenantId, redirectUri, isConfigured } = getMicrosoftConfig();

  if (!isConfigured) {
    throw new Error(
      "Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
    );
  }

  const state = createMicrosoftOAuthState({
    organizationId: options.organizationId,
    userId: options.userId,
    service: options.service,
    returnUrl: options.returnUrl,
  });

  const selectedScopes =
    options.scopes ||
    (options.service === "outlook_calendar"
      ? OUTLOOK_CALENDAR_SCOPES
      : options.service === "outlook"
      ? OUTLOOK_MAIL_SCOPES
      : DEFAULT_MICROSOFT_SCOPES);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: selectedScopes.join(" "),
    state,
    prompt: "consent",
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Exchanges the Microsoft OAuth authorization code for access and refresh tokens.
 */
export async function exchangeMicrosoftCodeForTokens(
  code: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId, redirectUri } = getMicrosoftConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Microsoft authorization code (${response.status}): ${errorText}`);
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

/**
 * Refreshes an expired Microsoft access token using a refresh token.
 */
export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId } = getMicrosoftConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Microsoft access token (${response.status}): ${errorText}`);
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

/**
 * Fetches the user profile from Microsoft Graph.
 */
export async function getMicrosoftUserProfile(accessToken: string): Promise<{
  id: string;
  email: string;
  displayName: string;
}> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Microsoft user profile.");
  }

  const profile = (await response.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };

  return {
    id: profile.id,
    email: profile.mail || profile.userPrincipalName || "",
    displayName: profile.displayName || "Microsoft Account",
  };
}
