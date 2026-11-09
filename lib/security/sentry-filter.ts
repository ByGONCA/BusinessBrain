import type { ErrorEvent, Breadcrumb, Contexts } from "@sentry/nextjs";

/**
 * Sensitive field keys to scrub from events, breadcrumbs, headers, and payloads.
 * Protects against accidental leakage of credentials, tokens, webhooks, and PII.
 */
const SENSITIVE_KEYS = [
  "password",
  "pass",
  "token",
  "secret",
  "key",
  "apikey",
  "api_key",
  "auth",
  "authorization",
  "bearer",
  "cookie",
  "set-cookie",
  "session",
  "credit_card",
  "card",
  "cvv",
  "cvc",
  "stripe_signature",
  "stripe-signature",
  "signature",
  "webhook_secret",
  "mfa",
  "otp",
  "code",
  "credential",
  "credentials",
  "private_key",
  "jwt",
  "service_role",
  "state",
  "refresh_token",
  "access_token",
  "server_auth_secret",
  "supabase_service_role_key",
];

const SENSITIVE_URL_PATTERNS = [
  /\/api\/webhooks(\/|$)/i,
  /\/api\/auth(\/|$)/i,
  /\/auth\/v1(\/|$)/i,
  /\/login(\/|$)/i,
  /\/signup(\/|$)/i,
  /\/api\/stripe\/webhook(\/|$)/i,
  /\/api\/maintenance(\/|$)/i,
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_KEYS.some((s) => normalized.includes(s.replace(/[-_]/g, "")));
}

/**
 * Sanitizes any raw string containing tokens, passwords, database URLs, or JWTs.
 */
export function scrubString(str: string): string {
  let result = str;

  // Mask Bearer tokens
  if (/bearer\s+[a-zA-Z0-9_\-.]+/i.test(result)) {
    result = result.replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [FILTERED]");
  }

  // Mask raw JWT format (header.payload.signature)
  if (/eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/i.test(result)) {
    result = result.replace(/eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/gi, "[JWT_FILTERED]");
  }

  // Mask database / connection credentials (e.g. postgres://user:password@host)
  if (/[a-zA-Z]+:\/\/[^:]+:[^@]+@/i.test(result)) {
    result = result.replace(/([a-zA-Z]+:\/\/[^:]+:)[^@]+(@)/gi, "$1[FILTERED]$2");
  }

  // Mask Stripe / provider key formats (sk_live_..., sk_test_..., re_...)
  if (/(?:sk_live_|sk_test_|re_)[a-zA-Z0-9_]{16,}/i.test(result)) {
    result = result.replace(/(?:sk_live_|sk_test_|re_)[a-zA-Z0-9_]{16,}/gi, "[API_KEY_FILTERED]");
  }

  return result;
}

/**
 * Recursively scrubs objects and arrays of any sensitive field keys or token values.
 */
export function scrubData(data: unknown, depth = 0): unknown {
  if (depth > 6 || data == null) return data;

  if (typeof data === "string") {
    return scrubString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubData(item, depth + 1));
  }

  if (typeof data === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        scrubbed[key] = "[FILTERED]";
      } else {
        scrubbed[key] = scrubData(value, depth + 1);
      }
    }
    return scrubbed;
  }

  return data;
}

/**
 * Sanitizes URLs by masking sensitive query parameters (e.g. code, token, state, secret).
 */
export function scrubUrl(urlStr: string | undefined): string | undefined {
  if (!urlStr) return urlStr;
  try {
    const url = new URL(urlStr, "https://kogsync.local");
    const params = url.searchParams;
    let modified = false;

    for (const key of Array.from(params.keys())) {
      if (isSensitiveKey(key)) {
        params.set(key, "[FILTERED]");
        modified = true;
      }
    }

    if (modified) {
      return urlStr.startsWith("http") ? url.toString() : `${url.pathname}?${params.toString()}`;
    }
    return urlStr;
  } catch {
    return urlStr.replace(/([?&](?:code|token|key|secret|state|refresh_token|access_token)=)[^&]+/gi, "$1[FILTERED]");
  }
}

/**
 * Main Sentry event sanitizer hook (beforeSend).
 * Strictly strips headers, cookies, auth payloads, webhook bodies, and personal identifiers.
 */
export function filterSentryEvent(event: ErrorEvent): ErrorEvent | null {
  // 1. Scrub User PII (Never expose email, IP address, or username)
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  // 2. Scrub Request information
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);

      // Check if URL is a sensitive webhook or authentication endpoint
      const isSensitiveEndpoint = SENSITIVE_URL_PATTERNS.some((pattern) =>
        pattern.test(event.request?.url || "")
      );

      if (isSensitiveEndpoint && event.request.data) {
        event.request.data = "[SENSITIVE_ENDPOINT_PAYLOAD_FILTERED]";
      } else if (event.request.data) {
        event.request.data = scrubData(event.request.data);
      }
    }

    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const key of Object.keys(headers)) {
        if (isSensitiveKey(key)) {
          headers[key] = "[FILTERED]";
        }
      }
      delete headers["cookie"];
      delete headers["set-cookie"];
      delete headers["authorization"];
      delete headers["stripe-signature"];
      delete headers["x-supabase-auth"];
    }

    if (event.request.cookies) {
      event.request.cookies = {};
    }
  }

  // 3. Scrub Exception messages & values
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) {
        ex.value = scrubString(ex.value);
      }
    }
  }

  // 4. Scrub Breadcrumbs attached to the event
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => filterSentryBreadcrumb(b))
      .filter(Boolean) as Breadcrumb[];
  }

  // 5. Scrub Contexts, Tags, and Extra data
  if (event.extra) {
    event.extra = scrubData(event.extra) as Record<string, unknown>;
  }
  if (event.tags) {
    event.tags = scrubData(event.tags) as Record<string, string>;
  }
  if (event.contexts) {
    event.contexts = scrubData(event.contexts) as Contexts;
  }

  return event;
}

/**
 * Main Sentry breadcrumb sanitizer hook (beforeBreadcrumb).
 * Removes sensitive URLs, request bodies, and token messages.
 */
export function filterSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.data) {
    if (breadcrumb.data.url) {
      breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      const isSensitive = SENSITIVE_URL_PATTERNS.some((pattern) =>
        pattern.test(String(breadcrumb.data?.url || ""))
      );
      if (isSensitive) {
        delete breadcrumb.data.requestBody;
        delete breadcrumb.data.responseBody;
      }
    }
    breadcrumb.data = scrubData(breadcrumb.data) as Record<string, unknown>;
  }

  if (breadcrumb.message) {
    breadcrumb.message = scrubString(breadcrumb.message);
  }

  return breadcrumb;
}
