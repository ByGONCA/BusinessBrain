/**
 * Open Redirect, URL Sanitization and Trusted Origin Resolution Utilities.
 * Ensures redirects and callback URLs are strictly constrained to verified trusted origins.
 */

/**
 * Canonical Production URL for KogSync.
 * Production must strictly and exclusively resolve to this origin.
 */
export const CANONICAL_PRODUCTION_URL = "https://kogsync.com";

/**
 * Canonical Local Development URL.
 */
export const CANONICAL_DEVELOPMENT_URL = "http://localhost:3000";

/**
 * Allowed static hostnames for trusted origins.
 */
const TRUSTED_STATIC_HOSTS = new Set([
  "kogsync.com",
  "www.kogsync.com",
  "localhost",
  "127.0.0.1",
]);

/**
 * Providers that strictly require static, pre-registered redirect URIs.
 * Google Cloud, GitHub OAuth Apps, Microsoft Entra, Slack API, Linear, Shopify, and Stripe Connect
 * reject dynamic subdomains (*.vercel.app) with redirect_uri_mismatch.
 */
export const STATIC_CALLBACK_PROVIDERS = new Set([
  "google",
  "github",
  "microsoft",
  "slack",
  "linear",
  "shopify",
  "stripe",
]);

/**
 * Error thrown when an OAuth flow requiring a static pre-registered callback
 * is initiated in a Preview environment without an explicit staging redirect URI configured.
 */
export class OAuthPreviewConfigurationError extends Error {
  public readonly provider: string;

  constructor(provider: string) {
    super(
      `OAuth provider '${provider}' requires a static pre-registered redirect URI, which is not configured for this Preview environment. To enable '${provider}' in Preview, register a fixed staging callback in the provider developer console and configure PREVIEW_${provider.toUpperCase()}_REDIRECT_URI or PREVIEW_APP_URL.`
    );
    this.name = "OAuthPreviewConfigurationError";
    this.provider = provider;
  }
}

/**
 * Resolves the active runtime deployment environment.
 * Strict precedence rules:
 * 1. VERCEL_ENV has absolute precedence when defined ('production' | 'preview' | 'development').
 *    Specifically, VERCEL_ENV === 'preview' MUST take precedence over NODE_ENV === 'production'
 *    because Next.js always sets NODE_ENV=production in Vercel preview builds!
 * 2. If VERCEL_ENV is undefined, VERCEL_URL indicates a Vercel deployment (Preview).
 * 3. Otherwise, execution is local:
 *    - Only classified as 'production' if NODE_ENV === 'production' AND NEXT_PUBLIC_APP_URL is canonical https://kogsync.com.
 *    - Defaults deterministically to 'development'.
 */
export function resolveEnvironment(): "production" | "preview" | "development" {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();

  // 1. Explicit VERCEL_ENV has absolute precedence
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";
  if (vercelEnv === "production") return "production";

  // 2. Vercel deployment detection via VERCEL_URL
  if (process.env.VERCEL_URL) {
    return "preview";
  }

  // 3. Local execution (non-Vercel environment)
  // Only classify as production if explicitly configured with canonical production URL in production mode
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_APP_URL?.trim() === CANONICAL_PRODUCTION_URL
  ) {
    return "production";
  }

  return "development";
}

/**
 * Validates whether a candidate hostname is trusted.
 * - Allowed static hosts: kogsync.com, www.kogsync.com, localhost, 127.0.0.1
 * - Allowed custom subdomains: *.kogsync.com (e.g. preview.kogsync.com, staging.kogsync.com)
 * - Allowed Vercel preview hosts: strictly matching the KogSync project prefix
 *   ('kogsync.vercel.app' or 'kogsync-*.vercel.app') or matching the exact VERCEL_URL
 *   injected by Vercel into this deployment.
 * - Rejects arbitrary third-party *.vercel.app deployments (e.g. attacker.vercel.app).
 * - Rejects credentials, ports, slashes, or invalid RFC 1123 characters.
 */
export function isTrustedHost(hostname: string | null | undefined): boolean {
  if (!hostname || typeof hostname !== "string") return false;
  const clean = hostname.trim().toLowerCase();

  // Reject credentials, userinfo, ports, backslashes, or path characters in hostname
  if (clean.includes("@") || clean.includes(":") || clean.includes("/") || clean.includes("\\")) {
    return false;
  }

  if (TRUSTED_STATIC_HOSTS.has(clean)) {
    return true;
  }

  // Check official kogsync.com subdomains (e.g. preview.kogsync.com, staging.kogsync.com)
  if (clean.endsWith(".kogsync.com")) {
    const parts = clean.split(".");
    if (parts.length >= 3 && parts.slice(-2).join(".") === "kogsync.com") {
      return parts.every((part) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(part));
    }
  }

  // Check Vercel deployment domain:
  // Must strictly belong to the KogSync project (kogsync.vercel.app or kogsync-*.vercel.app)
  // or match the exact VERCEL_URL assigned by Vercel to this specific deployment.
  if (clean.endsWith(".vercel.app")) {
    const parts = clean.split(".");
    if (parts.length === 3 && parts[1] === "vercel" && parts[2] === "app") {
      const subdomain = parts[0];

      // 1. Exact match with the current deployment's VERCEL_URL
      const currentVercelHost = process.env.VERCEL_URL?.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      if (currentVercelHost && clean === currentVercelHost) {
        return true;
      }

      // 2. Strict project prefix validation (only kogsync.vercel.app or kogsync-*.vercel.app)
      if (subdomain === "kogsync" || subdomain.startsWith("kogsync-")) {
        return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
      }
    }
  }

  return false;
}

/**
 * Validates whether a protocol is allowed.
 * Strictly https: (or http: only for localhost / 127.0.0.1).
 */
export function isAllowedProtocol(protocol: string, hostname: string): boolean {
  const normProto = protocol.toLowerCase().replace(/:$/, "");
  if (normProto === "https") return true;
  if (normProto === "http") {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }
  return false;
}

/**
 * Validates and sanitizes a candidate redirect URL.
 * Prevents Open Redirect attacks including:
 * - Absolute URLs (https://attacker.com)
 * - Protocol-relative URLs (//attacker.com)
 * - Backslash bypasses (/\attacker.com or \\attacker.com)
 * - Javascript/Data pseudo-protocols (javascript:alert(1))
 * - CRLF injection (%0d%0a)
 */
export function sanitizeRedirectUrl(
  candidate: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!candidate || typeof candidate !== "string") {
    return fallback;
  }

  const trimmed = candidate.trim();

  // Must begin with a single slash '/'
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative '//' or backslash combinations '/\' or '\\'
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }

  // Check for CRLF / newline characters
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  // Check for pseudo protocols or colon before question mark
  const pathWithoutQuery = trimmed.split("?")[0] || "";
  if (pathWithoutQuery.includes(":")) {
    return fallback;
  }

  // Try parsing with a dummy origin to ensure pathname matches exactly
  try {
    const dummyOrigin = "http://localhost:3000";
    const parsed = new URL(trimmed, dummyOrigin);

    if (parsed.origin !== dummyOrigin) {
      return fallback;
    }

    // Path must start with single slash and contain no backslashes
    if (!parsed.pathname.startsWith("/") || parsed.pathname.includes("\\")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export type TrustedUrlOptions = {
  request?: Request | { url?: string };
  forceStaticCanonical?: boolean;
};

/**
 * Resolves the trusted application origin.
 *
 * Priorities:
 * 1. Production must exclusively use https://kogsync.com.
 * 2. Local Development must use http://localhost:3000.
 * 3. Preview must use official hostname from Vercel via VERCEL_URL, when flow and provider allow.
 * 4. Never blindly trust headers Host, X-Forwarded-Host or arbitrary client-supplied values.
 * 5. Validate protocols and allowed hosts.
 * 6. Evitar open redirects e SSRF.
 * 7. Não permitir que Preview utilize acidentalmente o domínio de Production como fallback.
 */
export function getTrustedAppUrl(optionsOrRequest?: TrustedUrlOptions | Request | { url?: string }): string {
  let requestObj: Request | { url?: string } | undefined;
  let forceStatic = false;

  if (optionsOrRequest) {
    if ("url" in optionsOrRequest && typeof optionsOrRequest.url === "string") {
      requestObj = optionsOrRequest as { url?: string };
    } else if ("request" in optionsOrRequest) {
      requestObj = (optionsOrRequest as TrustedUrlOptions).request;
      forceStatic = Boolean((optionsOrRequest as TrustedUrlOptions).forceStaticCanonical);
    }
  }

  if (forceStatic) {
    return CANONICAL_PRODUCTION_URL;
  }

  const env = resolveEnvironment();

  // 1. Production environment: strictly canonical https://kogsync.com
  if (env === "production") {
    return CANONICAL_PRODUCTION_URL;
  }

  // 2. Preview environment
  if (env === "preview") {
    // If request is provided, validate request.url
    if (requestObj?.url) {
      try {
        const parsed = new URL(requestObj.url);
        if (
          isAllowedProtocol(parsed.protocol, parsed.hostname) &&
          isTrustedHost(parsed.hostname) &&
          (parsed.hostname.endsWith(".vercel.app") || parsed.hostname.endsWith(".kogsync.com"))
        ) {
          return `https://${parsed.hostname}`;
        }
      } catch {
        // ignore and fallback to VERCEL_URL
      }
    }

    // Inspect VERCEL_URL
    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
      const cleanVercelUrl = vercelUrl.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
      if (cleanVercelUrl && isTrustedHost(cleanVercelUrl) && cleanVercelUrl.endsWith(".vercel.app")) {
        return `https://${cleanVercelUrl}`;
      }
    }

    // Strict constraint: never accidentally fallback to Production in Preview!
    return CANONICAL_DEVELOPMENT_URL;
  }

  // 3. Development environment: local development
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (isAllowedProtocol(parsed.protocol, parsed.hostname) && isTrustedHost(parsed.hostname)) {
        return parsed.origin;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return CANONICAL_DEVELOPMENT_URL;
}

/**
 * Checks whether an OAuth callback is safely configured and available for a given provider.
 */
export function isOAuthCallbackConfigured(provider: string): boolean {
  try {
    getOAuthCallbackUrl(provider);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the trusted OAuth callback URL for a given provider.
 * Respects provider-specific static registration constraints:
 * - In Production: uses https://kogsync.com/api/integrations/<provider>/callback
 * - In Development: uses http://localhost:3000/api/integrations/<provider>/callback
 * - In Preview:
 *   If an explicit static callback is pre-registered (PREVIEW_<PROVIDER>_REDIRECT_URI,
 *   <PROVIDER>_REDIRECT_URI, or PREVIEW_APP_URL), returns that verified URL.
 *   If NO static callback is registered: FAILS CONTROLLED by throwing OAuthPreviewConfigurationError
 *   rather than returning an unfunctional localhost fallback!
 */
export function getOAuthCallbackUrl(
  provider: string,
  request?: Request | { url?: string }
): string {
  const norm = provider.toLowerCase().trim();
  const envVarName = `${norm.toUpperCase()}_REDIRECT_URI`;
  const explicitOverride = process.env[envVarName]?.trim();

  // If a provider-specific override is set, validate and use it
  if (explicitOverride) {
    try {
      const parsed = new URL(explicitOverride);
      if (isAllowedProtocol(parsed.protocol, parsed.hostname) && isTrustedHost(parsed.hostname)) {
        return parsed.href;
      }
    } catch {
      // ignore invalid override
    }
  }

  const env = resolveEnvironment();

  if (env === "production") {
    return `${CANONICAL_PRODUCTION_URL}/api/integrations/${norm}/callback`;
  }

  if (env === "development") {
    return `${CANONICAL_DEVELOPMENT_URL}/api/integrations/${norm}/callback`;
  }

  // In Preview environment:
  // 1. Check if PREVIEW_<PROVIDER>_REDIRECT_URI is defined
  const previewProviderOverride = process.env[`PREVIEW_${norm.toUpperCase()}_REDIRECT_URI`]?.trim();
  if (previewProviderOverride) {
    try {
      const parsed = new URL(previewProviderOverride);
      if (isAllowedProtocol(parsed.protocol, parsed.hostname) && isTrustedHost(parsed.hostname)) {
        return parsed.href;
      }
    } catch {
      // ignore
    }
  }

  // 2. Check if a static PREVIEW_APP_URL is defined (e.g. https://preview.kogsync.com)
  const previewAppUrl = process.env.PREVIEW_APP_URL?.trim();
  if (previewAppUrl) {
    try {
      const parsed = new URL(previewAppUrl);
      if (isAllowedProtocol(parsed.protocol, parsed.hostname) && isTrustedHost(parsed.hostname)) {
        return `${parsed.origin}/api/integrations/${norm}/callback`;
      }
    } catch {
      // ignore
    }
  }

  // 3. For static providers (Google, GitHub, Microsoft, Slack, Linear, Shopify, Stripe),
  // external consoles require pre-registered exact URIs. Without a configured static callback,
  // returning localhost:3000 breaks remote previews.
  // We FAIL FAST with a clear, descriptive error so connect routes abort cleanly.
  if (STATIC_CALLBACK_PROVIDERS.has(norm)) {
    throw new OAuthPreviewConfigurationError(norm);
  }

  // Dynamic providers can use the preview URL
  const appUrl = getTrustedAppUrl(request);
  return `${appUrl}/api/integrations/${norm}/callback`;
}

/**
 * Resolves the exact trusted callback URL for Stripe Connect OAuth.
 */
export function getStripeCallbackUrl(request?: Request | { url?: string }): string {
  return getOAuthCallbackUrl("stripe", request);
}

/**
 * Resolves the trusted authentication callback URL (for email confirmations, password recovery).
 */
export function getAuthCallbackUrl(
  path = "/api/auth/callback",
  request?: Request | { url?: string }
): string {
  const base = getTrustedAppUrl(request);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}



