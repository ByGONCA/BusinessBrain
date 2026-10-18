/**
 * Open Redirect and URL Sanitization Utilities.
 * Ensures redirects are strictly constrained to relative paths on the local origin.
 */

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

/**
 * Resolves the trusted application origin.
 * Strictly prioritizes configured environment variables (NEXT_PUBLIC_APP_URL)
 * over untrusted client headers to prevent Host Header Poisoning.
 */
export function getTrustedAppUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      return parsed.origin;
    } catch {
      // Ignore invalid URL and fallback
    }
  }

  // Safe fallback for local development or Vercel preview
  if (request) {
    try {
      const parsed = new URL(request.url);
      const hostname = parsed.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return parsed.origin;
      }
      if (process.env.VERCEL_URL && hostname.endsWith(".vercel.app")) {
        return `https://${hostname}`;
      }
    } catch {
      // Fallback
    }
  }

  return "http://localhost:3000";
}

/**
 * Resolves the exact trusted callback URL for Stripe Connect OAuth.
 */
export function getStripeCallbackUrl(request?: Request): string {
  const base = getTrustedAppUrl(request);
  return `${base}/api/integrations/stripe/callback`;
}

