import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
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

const env = loadEnv();
const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function checkRemote00025State() {
  console.log("=======================================================");
  console.log("CHECKING CURRENT STATE OF MIGRATION 00025 ON REMOTE DB");
  console.log(`Target: ${supabaseUrl}`);
  console.log("=======================================================\n");

  // Check 1: has_permission anon execution
  const { data: permData, error: permError } = await client.rpc("has_permission", {
    target_org_id: "00000000-0000-0000-0000-000000000000",
    required_key: "pages.view",
  });
  console.log("[Check 1] has_permission as anon:");
  if (permError && (permError.code === "42501" || permError.message?.includes("permission denied"))) {
    console.log("  -> 00025 STATE DETECTED: Execution strictly DENIED to anon (42501)");
  } else {
    console.log("  -> PRE-00025 STATE: Anon execution permitted, returned:", permData, permError?.message);
  }

  // Check 2: accept_organization_invitation as anon
  const { data: accData, error: accError } = await client.rpc("accept_organization_invitation", {
    p_token_hash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  console.log("\n[Check 2] accept_organization_invitation as anon:");
  if (accError && (accError.code === "42501" || accError.message?.includes("permission denied"))) {
    console.log("  -> 00025 STATE DETECTED: Execution strictly DENIED to anon (42501)");
  } else {
    console.log("  -> PRE-00025 STATE: Anon execution permitted, returned:", accData, accError?.message);
  }

  // Check 3: get_organization_storage_bytes as anon
  const { data: storData, error: storError } = await client.rpc("get_organization_storage_bytes", {
    p_org_id: "00000000-0000-0000-0000-000000000000",
  });
  console.log("\n[Check 3] get_organization_storage_bytes as anon:");
  if (storError && (storError.code === "42501" || storError.message?.includes("permission denied"))) {
    console.log("  -> 00025 STATE DETECTED: Execution strictly DENIED to anon (42501)");
  } else {
    console.log("  -> PRE-00025 STATE: Anon execution permitted or missing, returned:", storData, storError?.message);
  }

  // Check 4: check_rate_limit with invalid key format (missing 'rl:' prefix)
  const { data: rlKeyData, error: rlKeyError } = await client.rpc("check_rate_limit", {
    p_key: "invalid-key-no-rl-prefix",
    p_limit: 10,
    p_window_seconds: 60,
    p_server_token: null,
  });
  console.log("\n[Check 4] check_rate_limit with key without 'rl:' prefix:");
  if (rlKeyError && rlKeyError.code === "22023") {
    console.log("  -> 00025 STATE DETECTED: Invalid key rejected with 22023 (Format Whitelist)");
  } else {
    console.log("  -> PRE-00025 STATE: Returned:", rlKeyData, rlKeyError?.code, rlKeyError?.message);
  }

  // Check 5: check_rate_limit with missing server token
  const { data: rlTokenMissingData, error: rlTokenMissingError } = await client.rpc("check_rate_limit", {
    p_key: "rl:test:auth:user@example.com",
    p_limit: 10,
    p_window_seconds: 60,
    p_server_token: null,
  });
  console.log("\n[Check 5] check_rate_limit with null server_token:");
  if (rlTokenMissingError && rlTokenMissingError.code === "42501") {
    console.log("  -> 00025 STATE DETECTED: Missing token rejected with 42501 (Fail-Closed)");
  } else {
    console.log("  -> PRE-00025 STATE: Returned:", rlTokenMissingData, rlTokenMissingError?.code, rlTokenMissingError?.message);
  }

  // Check 6: check_rate_limit with forged HMAC signature
  const fakeToken = `${Math.floor(Date.now() / 1000)}.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`;
  const { data: rlForgedData, error: rlForgedError } = await client.rpc("check_rate_limit", {
    p_key: "rl:test:auth:user@example.com",
    p_limit: 10,
    p_window_seconds: 60,
    p_server_token: fakeToken,
  });
  console.log("\n[Check 6] check_rate_limit with forged HMAC token:");
  if (rlForgedError && rlForgedError.code === "42501") {
    console.log("  -> 00025 STATE DETECTED: Forged signature rejected with 42501 (Signature Mismatch)");
  } else {
    console.log("  -> PRE-00025 STATE: Returned:", rlForgedData, rlForgedError?.code, rlForgedError?.message);
  }
}

checkRemote00025State();

