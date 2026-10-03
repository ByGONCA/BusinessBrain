/**
 * Centralized, sanitized security logger for Company Brain.
 * Prevents accidental logging of sensitive credentials, tokens, secrets, or cookies
 * to stdout/stderr in both development and production.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /key/i,
  /credential/i,
  /session/i,
  /credit_?card/i,
];

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Check if current key matches any sensitive pattern
  if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    // Check for bearer token pattern
    if (/^Bearer\s+[a-zA-Z0-9_\-\.]+/i.test(value)) {
      return "Bearer [REDACTED]";
    }
    // Check for jwt pattern
    if (/^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+$/.test(value) && value.length > 50) {
      return "[REDACTED_JWT]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[k] = sanitizeValue(k, v);
    }
    return sanitizedObj;
  }

  return value;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    if (context) {
      console.log(`[INFO] ${message}`, sanitizeValue("", context));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (context) {
      console.warn(`[WARN] ${message}`, sanitizeValue("", context));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const isProd = process.env.NODE_ENV === "production";
    const errorDetails: Record<string, unknown> = {
      ...(context ? (sanitizeValue("", context) as Record<string, unknown>) : {}),
    };

    if (error instanceof Error) {
      errorDetails.errorMessage = error.message;
      if (!isProd) {
        errorDetails.stack = error.stack;
      }
    } else if (typeof error === "string") {
      errorDetails.errorMessage = error;
    } else if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      if (errObj.message) errorDetails.errorMessage = errObj.message;
      if (errObj.code) errorDetails.code = errObj.code;
      if (errObj.details) errorDetails.details = errObj.details;
      if (errObj.hint) errorDetails.hint = errObj.hint;
    }

    console.error(`[ERROR] ${message}`, errorDetails);
  },
};
