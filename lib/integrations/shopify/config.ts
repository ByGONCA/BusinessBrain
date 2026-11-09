// ==============================================================================
// KogSync: Multi-Tenant Shopify OAuth 2.0 & Admin API Configuration
// ==============================================================================

import { getOAuthCallbackUrl } from "@/lib/security/redirects";

export const SHOPIFY_DEFAULT_API_VERSION = "2025-01";

/**
 * Least-privilege read-only scopes strictly required for executive catalog,
 * inventory visibility, and orders telemetry without collecting personal customer data.
 */
export const SHOPIFY_DEFAULT_SCOPES = [
  "read_products",
  "read_orders",
  "read_inventory",
] as const;

/**
 * Canonical regex strictly matching valid Shopify store domains.
 * Format: {subdomain}.myshopify.com
 * Requirements:
 * - Subdomain: lowercase alphanumeric and hyphens, starting with alphanumeric
 * - Must strictly end with .myshopify.com
 * - Length: 4 to 60 characters for subdomain
 */
export const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9][a-z0-9\-]{2,59}\.myshopify\.com$/;

/**
 * Normalizes and validates candidate shop domain inputs from users or query parameters.
 * Examples:
 * - "my-brand" -> "my-brand.myshopify.com"
 * - "https://my-brand.myshopify.com/" -> "my-brand.myshopify.com"
 * - "my-brand.myshopify.com" -> "my-brand.myshopify.com"
 * Returns null if domain format is invalid or contains malicious characters.
 */
export function sanitizeShopDomain(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;

  let clean = input.trim().toLowerCase();

  // Reject credentials, userinfo, special characters early
  if (clean.includes("@") || clean.includes("\\") || clean.includes("<") || clean.includes(">") || clean.includes("'") || clean.includes('"')) {
    return null;
  }

  // Strip protocol if present
  clean = clean.replace(/^https?:\/\//i, "");

  // If there's a port or credentials colon, reject it
  if (clean.includes(":")) {
    return null;
  }

  // Extract hostname before any path or query
  const slashIdx = clean.indexOf("/");
  clean = slashIdx !== -1 ? clean.slice(0, slashIdx) : clean;
  clean = clean.split("?")[0];

  // If user only typed store handle, e.g. "acme-store", append .myshopify.com
  // But if the original input had a slash (e.g. "acme/myshopify.com"), reject it
  if (!clean.includes(".")) {
    if (slashIdx !== -1) {
      return null;
    }
    clean = `${clean}.myshopify.com`;
  }

  if (!SHOPIFY_DOMAIN_REGEX.test(clean)) {
    return null;
  }

  return clean;
}

/**
 * Resolves active Shopify App credentials and redirect URI.
 */
export function getShopifyOAuthConfig(request?: Request) {
  // Support both SHOPIFY_API_KEY / SHOPIFY_API_SECRET and SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET
  const clientId = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID || "";
  const clientSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || "";
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || clientSecret;
  const apiVersion = process.env.SHOPIFY_API_VERSION || SHOPIFY_DEFAULT_API_VERSION;

  const scopes = process.env.SHOPIFY_SCOPES
    ? process.env.SHOPIFY_SCOPES.split(",").map((s) => s.trim()).filter(Boolean)
    : [...SHOPIFY_DEFAULT_SCOPES];

  const redirectUri = getOAuthCallbackUrl("shopify", request);

  return {
    clientId,
    clientSecret,
    webhookSecret,
    apiVersion,
    scopes,
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret),
  };
}
