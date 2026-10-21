/**
 * Centralized, sanitized, colored security logger for Company Brain.
 * Prevents accidental logging of sensitive credentials, tokens, secrets, or cookies
 * to stdout/stderr in both development and production.
 * Provides distinct ANSI color formatting for terminal readability.
 */

// ANSI Color Escape Codes
export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright / Bold Foreground
  brightRed: "\x1b[1;31m",
  brightGreen: "\x1b[1;32m",
  brightYellow: "\x1b[1;33m",
  brightBlue: "\x1b[1;34m",
  brightMagenta: "\x1b[1;35m",
  brightCyan: "\x1b[1;36m",
  brightWhite: "\x1b[1;37m",
};

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

  if (value instanceof Error) {
    const errObj: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    if ("status" in value && typeof (value as { status?: unknown }).status === "number") {
      errObj.status = (value as { status?: number }).status;
    }
    if ("statusCode" in value && typeof (value as { statusCode?: unknown }).statusCode === "number") {
      errObj.statusCode = (value as { statusCode?: number }).statusCode;
    }
    if ("code" in value && (value as { code?: unknown }).code) {
      errObj.code = (value as { code?: unknown }).code;
    }
    return sanitizeValue(key, errObj);
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

function getTimeTag(): string {
  const d = new Date();
  const time = d.toTimeString().split(" ")[0];
  return `${ANSI.gray}${time}${ANSI.reset}`;
}

export const logger = {
  /**
   * Logs incoming or outgoing HTTP requests with colorized methods, status codes, and paths.
   */
  http(method: string, path: string, status?: number, durationMs?: number) {
    const m = (method || "GET").toUpperCase();
    let methodColor = ANSI.brightGreen;
    if (m === "POST") methodColor = ANSI.brightYellow;
    else if (m === "PUT" || m === "PATCH") methodColor = ANSI.brightCyan;
    else if (m === "DELETE") methodColor = ANSI.brightMagenta;
    else if (m === "HEAD" || m === "OPTIONS") methodColor = ANSI.gray;

    const methodTag = `${methodColor}${m.padEnd(6)}${ANSI.reset}`;
    const pathStr = `${ANSI.brightWhite}${path}${ANSI.reset}`;

    let statusStr = "";
    if (status !== undefined) {
      let statusColor = ANSI.brightGreen;
      if (status >= 500) statusColor = ANSI.brightRed;
      else if (status >= 400) statusColor = ANSI.brightYellow;
      else if (status >= 300) statusColor = ANSI.brightCyan;
      statusStr = ` ${statusColor}${status}${ANSI.reset}`;
    }

    const durationStr = durationMs !== undefined ? ` ${ANSI.gray}(${Math.round(durationMs)}ms)${ANSI.reset}` : "";
    console.log(`${getTimeTag()} ${methodTag} ${pathStr}${statusStr}${durationStr}`);
  },

  info(message: string, context?: Record<string, unknown>) {
    const tag = `${ANSI.brightCyan}[INFO]${ANSI.reset}`;
    if (context && Object.keys(context).length > 0) {
      console.log(`${getTimeTag()} ${tag} ${message}`, sanitizeValue("", context));
    } else {
      console.log(`${getTimeTag()} ${tag} ${message}`);
    }
  },

  warn(message: string, context?: Record<string, unknown>) {
    const tag = `${ANSI.brightYellow}[WARN]${ANSI.reset}`;
    if (context && Object.keys(context).length > 0) {
      console.warn(`${getTimeTag()} ${tag} ${ANSI.yellow}${message}${ANSI.reset}`, sanitizeValue("", context));
    } else {
      console.warn(`${getTimeTag()} ${tag} ${ANSI.yellow}${message}${ANSI.reset}`);
    }
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const tag = `${ANSI.brightRed}[ERROR]${ANSI.reset}`;

    let errMessage = "";
    let isExpectedAuthOrValidation = false;

    if (error instanceof Error) {
      errMessage = error.message;
      if (
        error.name.startsWith("Auth") ||
        error.name === "ZodError" ||
        errMessage.includes("Password should") ||
        errMessage.includes("Invalid login credentials") ||
        errMessage.includes("User already registered") ||
        errMessage.includes("Rate limit exceeded") ||
        errMessage.includes("confirmation email")
      ) {
        isExpectedAuthOrValidation = true;
      }
    } else if (typeof error === "string") {
      errMessage = error;
    } else if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      errMessage = String(errObj.message || errObj.error || "");
      if (
        String(errObj.name || "").startsWith("Auth") ||
        errMessage.includes("Password should")
      ) {
        isExpectedAuthOrValidation = true;
      }
    }

    // For expected authentication or validation errors, format cleanly on a single line
    // without dumping internal Next.js compiler stack traces into the terminal
    if (isExpectedAuthOrValidation) {
      const contextStr = context && Object.keys(context).length > 0
        ? ` ${ANSI.gray}${JSON.stringify(sanitizeValue("", context))}${ANSI.reset}`
        : "";
      console.error(
        `${getTimeTag()} ${tag} ${ANSI.brightWhite}${message}${ANSI.reset} — ${ANSI.red}${errMessage}${ANSI.reset}${contextStr}`
      );
      return;
    }

    // For unexpected runtime errors, provide sanitized details without internal bundler noise
    const errorDetails: Record<string, unknown> = {
      ...(context ? (sanitizeValue("", context) as Record<string, unknown>) : {}),
    };

    if (errMessage) {
      errorDetails.errorMessage = errMessage;
    }

    if (error instanceof Error && process.env.NODE_ENV !== "production" && error.stack) {
      const cleanStack = error.stack
        .split("\n")
        .filter((line) => !line.includes("node_modules") && !line.includes(".next"))
        .slice(0, 5)
        .join("\n");
      if (cleanStack.trim()) {
        errorDetails.stack = cleanStack;
      }
    }

    console.error(
      `${getTimeTag()} ${tag} ${ANSI.brightWhite}${message}${ANSI.reset}`,
      errorDetails
    );
  },
};
