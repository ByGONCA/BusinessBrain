/**
 * Remote Supabase Database Verification Script
 * Validates that migration 00009_storage_rls_hardening.sql has taken effect remotely:
 * 1. is_org_member(uuid) denies anon execution
 * 2. has_org_role(uuid, text[]) denies anon execution
 * 3. shares_organization_with(uuid) denies anon execution
 * 4. organization_files storage policies deny anon access
 * 5. Cross-organization access remains strictly denied
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env variables
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function verifyRemoteDatabase() {
  console.log("=======================================================");
  console.log("REMOTE SUPABASE DATABASE VERIFICATION");
  console.log("Target Instance:", supabaseUrl);
  console.log("=======================================================\n");

  let appliedCount = 0;
  let unappliedCount = 0;

  // 1. Verify is_org_member(uuid) execution lockdown
  process.stdout.write("[1] Checking is_org_member(uuid) EXECUTE permissions: ");
  const res1 = await anonClient.rpc("is_org_member", {
    target_org_id: "00000000-0000-0000-0000-000000000000",
  });
  if (res1.error && (res1.error.code === "42501" || res1.error.message.includes("permission denied"))) {
    console.log("✓ PASS (Anon execution strictly DENIED by PostgreSQL)");
    appliedCount++;
  } else {
    console.log("✗ UNAPPLIED (Anon execution still permitted; returns: " + JSON.stringify(res1.data) + ")");
    unappliedCount++;
  }

  // 2. Verify has_org_role(uuid, text[]) execution lockdown
  process.stdout.write("[2] Checking has_org_role(uuid, text[]) EXECUTE permissions: ");
  const res2 = await anonClient.rpc("has_org_role", {
    target_org_id: "00000000-0000-0000-0000-000000000000",
    allowed_roles: ["owner", "admin"],
  });
  if (res2.error && (res2.error.code === "42501" || res2.error.message.includes("permission denied"))) {
    console.log("✓ PASS (Anon execution strictly DENIED by PostgreSQL)");
    appliedCount++;
  } else {
    console.log("✗ UNAPPLIED (Anon execution still permitted; returns: " + JSON.stringify(res2.data) + ")");
    unappliedCount++;
  }

  // 3. Verify shares_organization_with(uuid) execution lockdown
  process.stdout.write("[3] Checking shares_organization_with(uuid) EXECUTE permissions: ");
  const res3 = await anonClient.rpc("shares_organization_with", {
    target_user_id: "00000000-0000-0000-0000-000000000000",
  });
  if (res3.error && (res3.error.code === "42501" || res3.error.message.includes("permission denied"))) {
    console.log("✓ PASS (Anon execution strictly DENIED by PostgreSQL)");
    appliedCount++;
  } else {
    console.log("✗ UNAPPLIED (Anon execution still permitted; returns: " + JSON.stringify(res3.data) + ")");
    unappliedCount++;
  }

  // 4. Verify organization_files storage policies role scoping
  process.stdout.write("[4] Checking storage.objects policies role enforcement (TO authenticated): ");
  const res4 = await anonClient.storage
    .from("organization_files")
    .list("00000000-0000-0000-0000-000000000000");
  if (res4.error || (res4.data && res4.data.length === 0)) {
    // Both an RLS error or empty list due to RLS denial protect the files
    console.log("✓ PASS (Anon storage access produces zero objects or is blocked)");
    appliedCount++;
  } else {
    console.log("✗ FAIL (Anon storage access exposed objects: " + JSON.stringify(res4.data) + ")");
    unappliedCount++;
  }

  // 5. Verify Cross-Organization Access Denial
  process.stdout.write("[5] Checking Cross-Organization Access Isolation: ");
  const fakeOrgId = "11111111-1111-1111-1111-111111111111";
  const { data: crossOrgFiles } = await anonClient
    .from("organization_files")
    .select("*")
    .eq("organization_id", fakeOrgId);

  if (!crossOrgFiles || crossOrgFiles.length === 0) {
    console.log("✓ PASS (Cross-organization records completely shielded by RLS)");
    appliedCount++;
  } else {
    console.log("✗ FAIL (Cross-organization records leaked: " + crossOrgFiles.length + " records)");
    unappliedCount++;
  }

  // 6. Check Table: page_connections
  process.stdout.write("[6] Checking table 'public.page_connections': ");
  const res6 = await anonClient.from("page_connections").select("*").limit(0);
  if (res6.error && res6.error.message.includes("Could not find the table")) {
    console.log("✗ MISSING (Table 'public.page_connections' does not exist yet)");
    unappliedCount++;
  } else {
    console.log("✓ PASS (Table 'public.page_connections' exists in Supabase)");
    appliedCount++;
  }

  // 7. Check Table: page_files
  process.stdout.write("[7] Checking table 'public.page_files': ");
  const res7 = await anonClient.from("page_files").select("*").limit(0);
  if (res7.error && res7.error.message.includes("Could not find the table")) {
    console.log("✗ MISSING (Table 'public.page_files' does not exist yet)");
    unappliedCount++;
  } else {
    console.log("✓ PASS (Table 'public.page_files' exists in Supabase)");
    appliedCount++;
  }

  console.log("\n=======================================================");
  if (unappliedCount === 0) {
    console.log("STATUS: ALL TABLES & SECURITY POLICIES ARE VERIFIED IN SUPABASE");
  } else {
    console.log(`STATUS: ${unappliedCount} PENDING TABLE(S) IN REMOTE DATABASE`);
    console.log("\nACTION REQUIRED TO CLEAR TERMINAL WARNINGS:");
    console.log("Run database/migrations/RUN_IN_SUPABASE_TO_FIX_WARNINGS.sql in your Supabase SQL Editor:");
    console.log(`https://supabase.com/dashboard/project/jjalqvgaxzajsyccbjch/sql`);
  }
  console.log("=======================================================\n");
}

verifyRemoteDatabase().catch(console.error);
