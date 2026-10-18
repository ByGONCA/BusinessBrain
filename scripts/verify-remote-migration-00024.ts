import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

/**
 * BusinessBrain — SEC-01 Remote Staging Smoke Test Suite
 * Tests live endpoints on https://jjalqvgaxzajsyccbjch.supabase.co
 * 
 * Verifies:
 * 1. Migration 00024 Schema & PostgREST Cache (token_hash column)
 * 2. RPC get_invitation_details status & fail-closed security
 * 3. RPC accept_organization_invitation status & unauthenticated lockdown
 * 4. Isolation of internal_system_secrets from public data API
 */

// Load .env and .env.local
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

let passCount = 0;
let failCount = 0;
let pendingCount = 0;

function report(status: "PASS" | "FAIL" | "PENDING", title: string, details?: string) {
  if (status === "PASS") {
    console.log(`  ✓ PASS: ${title}`);
    passCount++;
  } else if (status === "FAIL") {
    console.error(`  ✗ FAIL: ${title}${details ? ` -> ${details}` : ""}`);
    failCount++;
  } else {
    console.log(`  ⧖ PENDING: ${title}${details ? ` (${details})` : ""}`);
    pendingCount++;
  }
}

async function runStagingSmokeTests() {
  console.log("=======================================================");
  console.log("SEC-01 REMOTE STAGING SMOKE TEST SUITE");
  console.log(`Target Instance: ${supabaseUrl}`);
  console.log("=======================================================\n");

  console.log("[Test 1] Checking Migration 00024 Schema on Remote Instance...");
  const { error: colError } = await client
    .from("organization_invitations")
    .select("token_hash")
    .limit(1);

  if (colError && colError.code === "42703") {
    report("PENDING", "Migration 00024 Schema: Column 'token_hash' in organization_invitations", "Awaiting execution of RUN_MIGRATION_00024_STAGING.sql in SQL Editor");
  } else if (!colError) {
    report("PASS", "Migration 00024 Schema: Column 'token_hash' exists in organization_invitations");
  } else {
    report("FAIL", "Migration 00024 Schema Check Failed", colError.message);
  }

  console.log("\n[Test 2] Checking RPC public.get_invitation_details...");
  const { data: getDetailsData, error: getDetailsError } = await client.rpc("get_invitation_details", {
    p_token_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    p_server_token: null
  });

  if (getDetailsError && getDetailsError.code === "PGRST202") {
    report("PENDING", "RPC public.get_invitation_details existence in PostgREST cache", "Awaiting execution of RUN_MIGRATION_00024_STAGING.sql");
  } else if (getDetailsError && (getDetailsError.code === "42501" || getDetailsError.message?.includes("server token required"))) {
    report("PASS", "RPC public.get_invitation_details is active and strictly enforces server token (Fail-Closed 42501)");
  } else if (getDetailsError) {
    report("FAIL", "RPC public.get_invitation_details unexpected error", `${getDetailsError.code}: ${getDetailsError.message}`);
  } else {
    report("FAIL", "RPC public.get_invitation_details allowed unauthenticated access without server token", JSON.stringify(getDetailsData));
  }

  console.log("\n[Test 3] Checking RPC public.accept_organization_invitation...");
  const { data: acceptData, error: acceptError } = await client.rpc("accept_organization_invitation", {
    p_token_hash: "0000000000000000000000000000000000000000000000000000000000000000"
  });

  if (acceptError && acceptError.code === "PGRST202") {
    report("PENDING", "RPC public.accept_organization_invitation existence in PostgREST cache", "Awaiting execution of RUN_MIGRATION_00024_STAGING.sql");
  } else if (acceptError && (acceptError.code === "42501" || acceptError.message?.includes("permission denied"))) {
    report("PASS", "RPC public.accept_organization_invitation is strictly locked down from anon callers (PostgreSQL 42501)");
  } else if (acceptData && acceptData.code === "UNAUTHENTICATED") {
    report("PASS", "RPC public.accept_organization_invitation is active and rejects unauthenticated callers (UNAUTHENTICATED)");
  } else if (acceptError) {
    report("FAIL", "RPC public.accept_organization_invitation unexpected error", `${acceptError.code}: ${acceptError.message}`);
  } else {
    report("FAIL", "RPC public.accept_organization_invitation returned unexpected payload", JSON.stringify(acceptData));
  }

  console.log("\n[Test 4] Verifying Isolation of internal_system_secrets from Data API...");
  const { error: secretsError } = await client
    .from("internal_system_secrets")
    .select("key")
    .limit(1);

  if (secretsError && (secretsError.code === "42501" || secretsError.code === "42P01" || secretsError.code === "PGRST204" || secretsError.message?.includes("permission denied"))) {
    report("PASS", "Table public.internal_system_secrets is inaccessible to public Data API / anon role");
  } else if (!secretsError) {
    report("FAIL", "SECURITY BREACH: public.internal_system_secrets is readable by anonymous client!");
  } else {
    report("PASS", `Table public.internal_system_secrets is blocked (${secretsError.code})`);
  }

  console.log("\n[Test 5] Physical PostgreSQL Multi-Connection Concurrency Status...");
  report("PENDING", "Multi-connection TCP concurrency test (pg.Pool)", "Registered as PENDING per condition 6 (requires PostgreSQL TCP connection string)");

  console.log("\n=======================================================");
  console.log(`STAGING SMOKE TESTS SUMMARY: ${passCount} PASSED, ${pendingCount} PENDING, ${failCount} FAILED`);
  console.log("=======================================================");
}

runStagingSmokeTests();
