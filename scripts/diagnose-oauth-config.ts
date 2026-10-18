import fs from "node:fs";
import Stripe from "stripe";

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

async function diagnose() {
  console.log("=== DIAGNOSING STRIPE CONNECT CONFIGURATION ===");
  const secretKey = env["STRIPE_SECRET_KEY"];
  const clientId = env["STRIPE_CONNECT_CLIENT_ID"];

  if (!secretKey) {
    console.log("STRIPE_SECRET_KEY is missing!");
    return;
  }
  if (!clientId) {
    console.log("STRIPE_CONNECT_CLIENT_ID is missing!");
    return;
  }

  console.log(`STRIPE_SECRET_KEY: ${secretKey.substring(0, 8)}... (Length: ${secretKey.length})`);
  console.log(`STRIPE_CONNECT_CLIENT_ID: ${clientId.substring(0, 6)}... (Length: ${clientId.length})`);
  console.log(`Is test secret: ${secretKey.startsWith("sk_test_")}`);
  console.log(`Is test client_id: ${clientId.startsWith("ca_")}`);

  try {
    const stripe = new Stripe(secretKey);
    const acct = await stripe.accounts.retrieve();
    console.log("\n--- Stripe Account for STRIPE_SECRET_KEY ---");
    console.log(`Account ID: ${acct.id}`);
    console.log(`Account Type: ${acct.type}`);
    console.log(`Country: ${acct.country}`);
    console.log(`Charges enabled: ${acct.charges_enabled}`);
    console.log(`Payouts enabled: ${acct.payouts_enabled}`);
    console.log(`Details submitted: ${acct.details_submitted}`);
    console.log(`Settings Connect:`, acct.settings?.dashboard?.display_name || "N/A");
  } catch (err: any) {
    console.log("Error querying Stripe with STRIPE_SECRET_KEY:", err.message);
  }

  console.log("\n--- Diagnosing check_rate_limit Signature ---");
  const { createClient } = await import("@supabase/supabase-js");
  const crypto = await import("crypto");
  const client = createClient(env["NEXT_PUBLIC_SUPABASE_URL"]!, env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]!);

  const ts = Math.floor(Date.now() / 1000);
  const key = "rl:test:diag";
  const limit = 10;
  const windowSec = 60;
  const msg = `${key}:${limit}:${windowSec}:${ts}`;

  // Test with INTERNAL_RATE_LIMIT_SECRET (dedicated rate limit key)
  const rateLimitSecret = env["INTERNAL_RATE_LIMIT_SECRET"];
  if (rateLimitSecret) {
    const sigRate = crypto.createHmac("sha256", rateLimitSecret).update(msg).digest("hex");
    const { data: dataRate, error: errRate } = await client.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSec,
      p_server_token: `${ts}.${sigRate}`,
    });
    console.log("Using INTERNAL_RATE_LIMIT_SECRET:", errRate ? `${errRate.code} - ${errRate.message}` : `Success: ${dataRate}`);
  } else {
    console.log("INTERNAL_RATE_LIMIT_SECRET: Not configured in .env.local");
  }

  // Test with SERVER_AUTH_SECRET (fallback key)
  const secretAuth = env["SERVER_AUTH_SECRET"];
  if (secretAuth) {
    const sigAuth = crypto.createHmac("sha256", secretAuth).update(msg).digest("hex");
    const { data: dataAuth, error: errAuth } = await client.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSec,
      p_server_token: `${ts}.${sigAuth}`,
    });
    console.log("Using SERVER_AUTH_SECRET:", errAuth ? `${errAuth.code} - ${errAuth.message}` : `Success: ${dataAuth}`);
  }
}

diagnose().catch(console.error);
