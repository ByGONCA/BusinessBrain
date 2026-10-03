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
