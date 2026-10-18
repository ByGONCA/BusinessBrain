import fs from "node:fs";

function getEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of [".env", ".env.local"]) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return env;
}

const env = getEnv();

const vars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_CONNECT_CLIENT_ID",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "SERVER_AUTH_SECRET",
  "INTERNAL_RATE_LIMIT_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

const report: Record<string, { present: boolean; formatValid: boolean; notes: string }> = {};

for (const v of vars) {
  const val = env[v];
  const present = Boolean(val && val.length > 0);
  let formatValid = false;
  let notes = "";

  if (v === "NEXT_PUBLIC_SUPABASE_URL") {
    formatValid = Boolean(val && val.startsWith("https://") && val.includes(".supabase.co"));
    notes = formatValid ? `Points to remote project ${val.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]}` : "Invalid URL";
  } else if (v === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
    formatValid = Boolean(val && val.length > 20);
    notes = formatValid ? "Publishable key present" : "Missing or too short";
  } else if (v === "STRIPE_SECRET_KEY") {
    formatValid = Boolean(val && val.startsWith("sk_test_"));
    notes = formatValid ? "Verified Stripe Test Mode key (sk_test_...)" : "Missing or NOT a test key";
  } else if (v === "STRIPE_CONNECT_CLIENT_ID") {
    formatValid = Boolean(val && val.startsWith("ca_"));
    notes = formatValid ? "Verified Stripe Connect Client ID (ca_...)" : "Missing or invalid format (must start with ca_)";
  } else if (v === "INTEGRATION_TOKEN_ENCRYPTION_KEY") {
    formatValid = Boolean(val && (val.length === 64 || val.length === 32));
    notes = formatValid ? "Verified AES-256-GCM hex key (length matches requirement)" : "Invalid key length for AES-256";
  } else if (v === "SERVER_AUTH_SECRET") {
    formatValid = Boolean(val && val.length >= 32);
    notes = formatValid ? "Strong secret present for HMAC signing" : "Missing or short secret";
  } else if (v === "INTERNAL_RATE_LIMIT_SECRET") {
    formatValid = Boolean(val && /^[0-9a-f]{64}$/i.test(val));
    notes = formatValid
      ? "Verified 64-character hex secret (256-bit entropy) for rate limiting HMAC"
      : (present ? "Invalid format: must be exactly 64 hexadecimal characters" : "Optional in dev (falls back to SERVER_AUTH_SECRET); required for dedicated DB rate limiting");
  } else if (v === "NEXT_PUBLIC_APP_URL") {
    formatValid = Boolean(val && (val.startsWith("http://") || val.startsWith("https://")));
    notes = present ? (formatValid ? `Configured as ${val}` : "Invalid URL format") : "Optional: defaults to request.origin (e.g. http://localhost:3000)";
  }

  report[v] = { present, formatValid, notes };
}

console.log(JSON.stringify(report, null, 2));
