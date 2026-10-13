/**
 * BusinessBrain — Remote Supabase Post-Migration Validation Suite
 * Specifically validates Migrations 00022 & 00023 against the live Supabase instance:
 * https://jjalqvgaxzajsyccbjch.supabase.co
 * 
 * Tests executed live:
 * 1. Migration 00022 Schema & PostgREST Cache Validation
 *    - Presence of job_title column in organization_invitations
 *    - Presence of initial_team_ids column in organization_invitations
 *    - Backward compatibility: selecting legacy columns without job_title/initial_team_ids
 * 2. Migration 00023 Database RPC public.has_permission Validation
 *    - Function compilation and existence in public schema
 *    - Execution with valid parameters (fails-closed for unauthenticated/alien tenant)
 *    - Execution with boundary conditions (null org, empty key, unknown key)
 * 3. Migration 00023 Row Level Security (RLS) Lockdown
 *    - organization_teams: rejects unauthorized insertion (42501)
 *    - organization_team_members: rejects unauthorized mutation (42501)
 *    - team_permissions: rejects unauthorized insertion (42501)
 *    - member_permission_overrides: rejects unauthorized insertion (42501)
 *    - organization_invitations: rejects unauthorized insertion (42501)
 *    - organization_members: rejects unauthorized query (42501)
 * 4. Multi-Tenant Cross-Organization Leakage Prevention
 *    - Verification of is_org_member lockdown
 *    - Verification of shares_organization_with lockdown
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load environment
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey);

let remotePass = 0;
let remoteFail = 0;

function remoteAssert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ REMOTE PASS: ${msg}`);
    remotePass++;
  } else {
    console.error(`  ✗ REMOTE FAIL: ${msg}`);
    remoteFail++;
  }
}

async function runRemoteValidation() {
  console.log("=================================================================");
  console.log("VALIDATING LIVE REMOTE SUPABASE AFTER MIGRATIONS 00022 & 00023");
  console.log("Target Instance:", supabaseUrl);
  console.log("=================================================================\n");

  // -------------------------------------------------------------------------
  // 1. MIGRATION 00022: COLUMNS IN organization_invitations
  // -------------------------------------------------------------------------
  console.log("[1] Validating Migration 00022 Schema & PostgREST Cache:");

  // Test 1.1: Query with new columns
  const resNewCols = await client
    .from("organization_invitations")
    .select("id, organization_id, email, role, job_title, initial_team_ids")
    .limit(0);

  remoteAssert(
    resNewCols.error === null,
    "Columns 'job_title' and 'initial_team_ids' exist in 'organization_invitations' and are loaded in PostgREST cache"
  );

  // Test 1.2: Backward compatibility with legacy queries
  const resLegacyCols = await client
    .from("organization_invitations")
    .select("id, organization_id, email, role, token, status, expires_at")
    .limit(0);

  remoteAssert(
    resLegacyCols.error === null,
    "Legacy select on 'organization_invitations' functions without schema regression"
  );

  // -------------------------------------------------------------------------
  // 2. MIGRATION 00023: RPC public.has_permission
  // -------------------------------------------------------------------------
  console.log("\n[2] Validating Migration 00023 Function public.has_permission:");

  const dummyOrg = "00000000-0000-0000-0000-000000000000";

  // Test 2.1: Function execution with registered permission
  const rpc1 = await client.rpc("has_permission", {
    target_org_id: dummyOrg,
    required_key: "pages.view",
  });
  remoteAssert(
    rpc1.error === null && rpc1.data === false,
    "public.has_permission('pages.view') executes cleanly and returns false for unauthenticated / non-member"
  );

  // Test 2.2: Function execution with critical admin permission
  const rpc2 = await client.rpc("has_permission", {
    target_org_id: dummyOrg,
    required_key: "teams.manage_permissions",
  });
  remoteAssert(
    rpc2.error === null && rpc2.data === false,
    "public.has_permission('teams.manage_permissions') executes cleanly and fails-closed"
  );

  // Test 2.3: Boundary condition - empty key
  const rpc3 = await client.rpc("has_permission", {
    target_org_id: dummyOrg,
    required_key: "",
  });
  remoteAssert(
    rpc3.error === null && rpc3.data === false,
    "public.has_permission('') handles empty key safely and returns false"
  );

  // Test 2.4: Boundary condition - invalid/unknown key
  const rpc4 = await client.rpc("has_permission", {
    target_org_id: dummyOrg,
    required_key: "system.fake_elevation_grant",
  });
  remoteAssert(
    rpc4.error === null && rpc4.data === false,
    "public.has_permission('system.fake_elevation_grant') returns false for non-existent keys"
  );

  // -------------------------------------------------------------------------
  // 3. MIGRATION 00023: RLS POLICIES LOCKDOWN ON AFFECTED TABLES
  // -------------------------------------------------------------------------
  console.log("\n[3] Validating Migration 00023 Row-Level Security (RLS) on Affected Tables:");

  // Test 3.1: organization_teams INSERT protection
  const teamsInsert = await client
    .from("organization_teams")
    .insert({
      organization_id: dummyOrg,
      name: `SecProbe_${Date.now()}`,
    });
  remoteAssert(
    teamsInsert.error?.code === "42501",
    "organization_teams: Unauthorized INSERT blocked by RLS (42501)"
  );

  // Test 3.2: organization_team_members INSERT protection
  const teamMembersInsert = await client
    .from("organization_team_members")
    .insert({
      organization_id: dummyOrg,
      team_id: dummyOrg,
      user_id: dummyOrg,
    });
  remoteAssert(
    teamMembersInsert.error?.code === "42501",
    "organization_team_members: Unauthorized INSERT blocked by RLS (42501)"
  );

  // Test 3.3: team_permissions INSERT protection
  const teamPermsInsert = await client
    .from("team_permissions")
    .insert({
      organization_id: dummyOrg,
      team_id: dummyOrg,
      permission_key: "pages.delete",
    });
  remoteAssert(
    teamPermsInsert.error?.code === "42501",
    "team_permissions: Unauthorized INSERT blocked by RLS (42501)"
  );

  // Test 3.4: member_permission_overrides INSERT protection
  const overridesInsert = await client
    .from("member_permission_overrides")
    .insert({
      organization_id: dummyOrg,
      user_id: dummyOrg,
      permission_key: "teams.delete",
      effect: "allow",
    });
  remoteAssert(
    overridesInsert.error?.code === "42501",
    "member_permission_overrides: Unauthorized INSERT blocked by RLS (42501)"
  );

  // Test 3.5: organization_invitations INSERT protection
  const invInsert = await client
    .from("organization_invitations")
    .insert({
      organization_id: dummyOrg,
      email: "secprobe@test.com",
      role: "member",
      token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      job_title: "Security Probe",
      initial_team_ids: [],
    });
  remoteAssert(
    invInsert.error?.code === "42501",
    "organization_invitations: Unauthorized INSERT blocked by RLS (42501)"
  );

  // Test 3.6: organization_members SELECT protection
  const membersSelect = await client
    .from("organization_members")
    .select("id, organization_id, user_id, role")
    .limit(1);
  remoteAssert(
    membersSelect.error?.code === "42501",
    "organization_members: Unauthorized access blocked by is_org_member (42501)"
  );

  // -------------------------------------------------------------------------
  // 4. MULTI-TENANT ISOLATION FUNCTIONS LOCKDOWN
  // -------------------------------------------------------------------------
  console.log("\n[4] Validating Multi-Tenant Isolation Functions:");

  const rpcOrgMember = await client.rpc("is_org_member", { target_org_id: dummyOrg });
  remoteAssert(
    rpcOrgMember.error?.code === "42501",
    "is_org_member(uuid) EXECUTE permission denied for anonymous callers (42501)"
  );

  const rpcOrgRole = await client.rpc("has_org_role", {
    target_org_id: dummyOrg,
    allowed_roles: ["owner", "admin"],
  });
  remoteAssert(
    rpcOrgRole.error?.code === "42501",
    "has_org_role(uuid, text[]) EXECUTE permission denied for anonymous callers (42501)"
  );

  const rpcSharesOrg = await client.rpc("shares_organization_with", { target_user_id: dummyOrg });
  remoteAssert(
    rpcSharesOrg.error?.code === "42501",
    "shares_organization_with(uuid) EXECUTE permission denied for anonymous callers (42501)"
  );

  console.log("\n=================================================================");
  console.log(`REMOTE SUPABASE VALIDATION COMPLETE: ${remotePass} PASSED, ${remoteFail} FAILED`);
  console.log("=================================================================\n");

  if (remoteFail > 0) {
    process.exit(1);
  }
}

runRemoteValidation().catch((err) => {
  console.error("FATAL ERROR validating remote Supabase:", err);
  process.exit(1);
});
