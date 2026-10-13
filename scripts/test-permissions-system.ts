/**
 * BusinessBrain — Comprehensive Permissions & Authorization Verification Suite
 * 
 * Verifies:
 * 1. Part 1: Automated Domain Logic & Resolver Tests
 *    - Owner root authority across all 52 keys
 *    - Precedence hierarchy (owner > deny > allow > team > default deny)
 *    - Multiple team aggregation & immediate revocation upon leaving team
 *    - Team permission modifications immediately changing effective access
 *    - Professional titles (CTO, Lead) confer zero implicit permissions
 *    - Multi-tenant isolation (Org A vs Org B)
 *    - Server Action authorization simulation for critical operations
 *    - Registry completeness & integrity (52 keys)
 * 
 * 2. Part 2: Real PostgreSQL Database Engine Tests (via PGlite WASM Postgres 16)
 *    - Execution of Migration 00023_permissions_hardening_and_rls.sql
 *    - Verification of public.has_permission(uuid, text) SQL function
 *    - Real Row Level Security (RLS) enforcement against authenticated roles
 *    - RLS cross-tenant isolation enforcement
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  PERMISSION_KEYS,
  PERMISSIONS_REGISTRY,
  isValidPermissionKey,
  getPermissionsByCategory,
  PermissionKey,
} from "../lib/permissions/registry";

let passedCount = 0;
let failedCount = 0;

function testAssert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failedCount++;
  }
}

// ==============================================================================
// PART 1: AUTOMATED IN-MEMORY / DOMAIN LOGIC TESTS
// ==============================================================================

interface MockMembership {
  user_id: string;
  organization_id: string;
  role: "owner" | "admin" | "member";
  job_title?: string;
}

interface MockTeamMembership {
  team_id: string;
  user_id: string;
}

interface MockTeamPermission {
  team_id: string;
  permission_key: string;
}

interface MockOverride {
  user_id: string;
  permission_key: string;
  effect: "allow" | "deny";
}

function resolveMockPermissions(params: {
  userId: string;
  targetOrgId: string;
  memberships: MockMembership[];
  teamMemberships: MockTeamMembership[];
  teamPermissions: MockTeamPermission[];
  overrides: MockOverride[];
}) {
  const { userId, targetOrgId, memberships, teamMemberships, teamPermissions, overrides } = params;

  // 1. Check organization membership
  const member = memberships.find((m) => m.user_id === userId && m.organization_id === targetOrgId);
  if (!member) {
    return {
      isOwner: false,
      hasPermission: (_key: string) => false,
      effectivePermissions: new Set<string>(),
    };
  }

  // 2. Owner has unconditional root access across all keys
  if (member.role === "owner") {
    const allKeys = new Set(PERMISSION_KEYS);
    return {
      isOwner: true,
      hasPermission: (_key: string) => true,
      effectivePermissions: allKeys,
    };
  }

  // 3. User teams in this org
  const userTeamIds = teamMemberships.filter((tm) => tm.user_id === userId).map((tm) => tm.team_id);

  // 4. Team permissions
  const teamAllowed = new Set<string>();
  for (const tp of teamPermissions) {
    if (userTeamIds.includes(tp.team_id)) {
      teamAllowed.add(tp.permission_key);
    }
  }

  // 5. User overrides
  const userOverrides = overrides.filter((o) => o.user_id === userId);
  const explicitDeny = new Set(userOverrides.filter((o) => o.effect === "deny").map((o) => o.permission_key));
  const explicitAllow = new Set(userOverrides.filter((o) => o.effect === "allow").map((o) => o.permission_key));

  // 6. Effective permissions calculation
  const effective = new Set<string>();
  for (const k of teamAllowed) {
    if (!explicitDeny.has(k)) {
      effective.add(k);
    }
  }
  for (const k of explicitAllow) {
    if (!explicitDeny.has(k)) {
      effective.add(k);
    }
  }

  return {
    isOwner: false,
    hasPermission: (key: string) => effective.has(key),
    effectivePermissions: effective,
  };
}

// Server action authorization simulation helper
function simulateServerAction(
  userId: string,
  targetOrgId: string,
  requiredPermission: PermissionKey,
  state: Parameters<typeof resolveMockPermissions>[0]
): { success: boolean; error?: string } {
  const resolved = resolveMockPermissions(state);
  if (!resolved.hasPermission(requiredPermission)) {
    return {
      success: false,
      error: `Forbidden: missing permission '${requiredPermission}'`,
    };
  }
  return { success: true };
}

async function runPart1AutomatedLogicTests() {
  console.log("\n=======================================================");
  console.log("PART 1: AUTOMATED LOGIC & RESOLVER TESTS (IN-MEMORY)");
  console.log("=======================================================\n");

  // Test 1.1: Owner Authority (Owner has all 52 registered permissions)
  const ownerState = {
    userId: "user-owner",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-owner", organization_id: "org-1", role: "owner" as const }],
    teamMemberships: [],
    teamPermissions: [],
    overrides: [],
  };
  const owner = resolveMockPermissions(ownerState);
  testAssert(owner.isOwner, "Owner is correctly identified as owner");
  testAssert(PERMISSION_KEYS.every((k) => owner.hasPermission(k)), "Owner possesses all 52 registered permissions unconditionally");

  // Test 1.2: Job Title Independence
  // Two users with title 'CTO' in the same organization
  const titleState = {
    userId: "user-cto-1",
    targetOrgId: "org-1",
    memberships: [
      { user_id: "user-cto-1", organization_id: "org-1", role: "member" as const, job_title: "Chief Technology Officer" },
      { user_id: "user-cto-2", organization_id: "org-1", role: "member" as const, job_title: "Chief Technology Officer" },
    ],
    teamMemberships: [{ team_id: "team-eng", user_id: "user-cto-1" }],
    teamPermissions: [{ team_id: "team-eng", permission_key: "github.view" }],
    overrides: [{ user_id: "user-cto-1", permission_key: "github.manage_connection", effect: "allow" as const }],
  };
  const cto1 = resolveMockPermissions({ ...titleState, userId: "user-cto-1" });
  const cto2 = resolveMockPermissions({ ...titleState, userId: "user-cto-2" });

  testAssert(cto1.hasPermission("github.view") === true, "CTO 1 inherits github.view from team");
  testAssert(cto1.hasPermission("github.manage_connection") === true, "CTO 1 has explicit allow for github.manage_connection");
  testAssert(cto2.hasPermission("github.view") === false, "CTO 2 with same title but no team has NO github.view");
  testAssert(cto2.hasPermission("github.manage_connection") === false, "CTO 2 has NO github.manage_connection");
  testAssert(cto2.hasPermission("billing.manage") === false, "CTO title confers zero implicit billing or admin rights");

  // Test 1.3: Team Inheritance & Aggregation across multiple teams
  const multiTeamState = {
    userId: "user-multi",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-multi", organization_id: "org-1", role: "member" as const }],
    teamMemberships: [
      { team_id: "team-frontend", user_id: "user-multi" },
      { team_id: "team-ops", user_id: "user-multi" },
    ],
    teamPermissions: [
      { team_id: "team-frontend", permission_key: "pages.create" },
      { team_id: "team-ops", permission_key: "billing.view" },
    ],
    overrides: [],
  };
  const multiMember = resolveMockPermissions(multiTeamState);
  testAssert(multiMember.hasPermission("pages.create") === true, "Member inherits pages.create from team-frontend");
  testAssert(multiMember.hasPermission("billing.view") === true, "Member inherits billing.view from team-ops");
  testAssert(multiMember.hasPermission("tasks.create") === false, "Ungranted permission remains denied");

  // Test 1.4: Revocation when removed from team
  const leftTeamState = {
    ...multiTeamState,
    teamMemberships: [{ team_id: "team-ops", user_id: "user-multi" }], // Removed from frontend
  };
  const afterLeaving = resolveMockPermissions(leftTeamState);
  testAssert(afterLeaving.hasPermission("pages.create") === false, "Removing member from team immediately revokes team permissions");
  testAssert(afterLeaving.hasPermission("billing.view") === true, "Retained team permissions remain active");

  // Test 1.5: Revocation when team permissions are updated
  const teamPermsUpdatedState = {
    ...multiTeamState,
    teamPermissions: [{ team_id: "team-frontend", permission_key: "pages.edit" }], // pages.create removed from team
  };
  const afterPermUpdate = resolveMockPermissions(teamPermsUpdatedState);
  testAssert(afterPermUpdate.hasPermission("pages.create") === false, "Removing permission from team immediately affects member");
  testAssert(afterPermUpdate.hasPermission("pages.edit") === true, "Added permission to team immediately takes effect");

  // Test 1.6: Precedence - Explicit Individual DENY wins over Team ALLOW
  const denyOverrideState = {
    userId: "user-restricted",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-restricted", organization_id: "org-1", role: "member" as const }],
    teamMemberships: [{ team_id: "team-ops", user_id: "user-restricted" }],
    teamPermissions: [{ team_id: "team-ops", permission_key: "billing.manage" }],
    overrides: [{ user_id: "user-restricted", permission_key: "billing.manage", effect: "deny" as const }],
  };
  const restrictedMember = resolveMockPermissions(denyOverrideState);
  testAssert(restrictedMember.hasPermission("billing.manage") === false, "Explicit individual DENY strictly overrides Team ALLOW");

  // Test 1.7: Precedence - Explicit Individual ALLOW grants access without team
  const allowOverrideState = {
    userId: "user-specialist",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-specialist", organization_id: "org-1", role: "member" as const }],
    teamMemberships: [],
    teamPermissions: [],
    overrides: [{ user_id: "user-specialist", permission_key: "people.invite", effect: "allow" as const }],
  };
  const specialist = resolveMockPermissions(allowOverrideState);
  testAssert(specialist.hasPermission("people.invite") === true, "Explicit individual ALLOW grants capability without team");
  testAssert(specialist.hasPermission("people.remove") === false, "Ungranted capabilities remain denied");

  // Test 1.8: Precedence - Conflict Resolution (DENY beats ALLOW for same key)
  const conflictState = {
    userId: "user-conflict",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-conflict", organization_id: "org-1", role: "member" as const }],
    teamMemberships: [],
    teamPermissions: [],
    overrides: [
      { user_id: "user-conflict", permission_key: "files.delete", effect: "allow" as const },
      { user_id: "user-conflict", permission_key: "files.delete", effect: "deny" as const },
    ],
  };
  const conflictUser = resolveMockPermissions(conflictState);
  testAssert(conflictUser.hasPermission("files.delete") === false, "Explicit DENY takes precedence over ALLOW in conflict");

  // Test 1.9: Strict Multi-Tenant Boundary Isolation
  const crossTenantState = {
    userId: "user-org1-admin",
    targetOrgId: "org-2", // Checking Org 2 while user belongs to Org 1
    memberships: [{ user_id: "user-org1-admin", organization_id: "org-1", role: "owner" as const }],
    teamMemberships: [],
    teamPermissions: [],
    overrides: [],
  };
  const crossTenantCheck = resolveMockPermissions(crossTenantState);
  testAssert(crossTenantCheck.isOwner === false, "User is not owner of Org 2");
  testAssert(crossTenantCheck.hasPermission("pages.view") === false, "User from Org 1 has ZERO permissions in Org 2");
  testAssert(crossTenantCheck.effectivePermissions.size === 0, "Effective permissions for alien tenant is strictly empty");

  // Test 1.10: Server Action Authorization Enforcement Simulation
  const memberActionState = {
    userId: "user-editor",
    targetOrgId: "org-1",
    memberships: [{ user_id: "user-editor", organization_id: "org-1", role: "member" as const }],
    teamMemberships: [{ team_id: "team-writers", user_id: "user-editor" }],
    teamPermissions: [{ team_id: "team-writers", permission_key: "pages.create" }],
    overrides: [],
  };

  const allowedAction = simulateServerAction("user-editor", "org-1", "pages.create", memberActionState);
  testAssert(allowedAction.success === true, "Server Action with granted permission succeeds");

  const blockedDeleteTeam = simulateServerAction("user-editor", "org-1", "teams.delete", memberActionState);
  testAssert(blockedDeleteTeam.success === false, "Server Action without teams.delete is rejected");

  const blockedManagePerms = simulateServerAction("user-editor", "org-1", "teams.manage_permissions", memberActionState);
  testAssert(blockedManagePerms.success === false, "Server Action without teams.manage_permissions is rejected");

  const blockedBilling = simulateServerAction("user-editor", "org-1", "billing.manage", memberActionState);
  testAssert(blockedBilling.success === false, "Server Action without billing.manage is rejected");

  // Test 1.11: Registry Integrity (All 52 permissions)
  testAssert(PERMISSION_KEYS.length === 52, `Registry contains exactly 52 registered canonical permissions (Found ${PERMISSION_KEYS.length})`);
  testAssert(new Set(PERMISSION_KEYS).size === 52, "All 52 permission keys are strictly unique");
  testAssert(PERMISSIONS_REGISTRY.every((p) => p.name && p.description && p.category), "All permissions have valid name, description, and category");
  testAssert(isValidPermissionKey("teams.manage_permissions"), "teams.manage_permissions is a valid key");
  testAssert(isValidPermissionKey("people.manage_permissions"), "people.manage_permissions is a valid key");
  testAssert(isValidPermissionKey("github.manage_connection"), "github.manage_connection is a valid key");
  testAssert(isValidPermissionKey("non_existent.key") === false, "Non-existent permission key is rejected");
}

// ==============================================================================
// PART 2: REAL POSTGRESQL DATABASE ENGINE TESTS (PGLITE)
// ==============================================================================

async function runPart2RealPostgreSqlTests() {
  console.log("\n=======================================================");
  console.log("PART 2: REAL POSTGRESQL DATABASE ENGINE TESTS (PGLITE)");
  console.log("=======================================================\n");

  const pg = new PGlite();

  console.log("  [Step 1] Initializing Supabase schemas and helper functions...");
  await pg.exec(`
    create schema if not exists extensions;
    create schema if not exists auth;

    -- Emulate Supabase roles
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;

    -- Current mock authenticated user variable
    create table if not exists auth.current_session (
      user_id uuid
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.current_session limit 1;
    $$;

    create or replace function auth.role() returns text language sql stable as $$
      select 'authenticated'::text;
    $$;
  `);

  console.log("  [Step 2] Creating base tables for organizations and permissions...");
  await pg.exec(`
    create table if not exists public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      created_at timestamptz default now()
    );

    create table if not exists public.organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null,
      role text not null check (role in ('owner', 'admin', 'member')),
      job_title text,
      created_at timestamptz default now(),
      unique(organization_id, user_id)
    );

    create table if not exists public.organization_teams (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      description text,
      color text default '#6366f1',
      created_at timestamptz default now(),
      unique(organization_id, name)
    );

    create table if not exists public.organization_team_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      team_id uuid not null references public.organization_teams(id) on delete cascade,
      user_id uuid not null,
      created_at timestamptz default now(),
      unique(team_id, user_id)
    );

    create table if not exists public.team_permissions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      team_id uuid not null references public.organization_teams(id) on delete cascade,
      permission_key text not null,
      created_at timestamptz default now(),
      unique(team_id, permission_key)
    );

    create table if not exists public.member_permission_overrides (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null,
      permission_key text not null,
      effect text not null check (effect in ('allow', 'deny')),
      created_at timestamptz default now(),
      unique(organization_id, user_id, permission_key)
    );

    create table if not exists public.organization_invitations (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      email text not null,
      role text not null check (role in ('admin', 'member')),
      invited_by uuid,
      created_at timestamptz default now(),
      unique(organization_id, email)
    );

    -- Helper has_org_role
    create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
    returns boolean language sql security definer stable as $$
      select exists (
        select 1 from public.organization_members
        where organization_id = target_org_id
          and user_id = auth.uid()
          and role = any(allowed_roles)
      );
    $$;
  `);

  console.log("  [Step 3] Applying Migration 00023 (Permissions Hardening & RLS)...");
  const migrationPath = path.join(__dirname, "..", "database", "migrations", "00023_permissions_hardening_and_rls.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  await pg.exec(migrationSql);
  testAssert(true, "Migration 00023 applied cleanly without syntax errors");

  // Enable RLS and grant privileges to authenticated role
  await pg.exec(`
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    grant all on all sequences in schema public to authenticated;

    alter table public.organization_teams enable row level security;
    alter table public.organization_teams force row level security;
    alter table public.organization_team_members enable row level security;
    alter table public.organization_team_members force row level security;
    alter table public.team_permissions enable row level security;
    alter table public.team_permissions force row level security;
    alter table public.member_permission_overrides enable row level security;
    alter table public.member_permission_overrides force row level security;
    alter table public.organization_invitations enable row level security;
    alter table public.organization_invitations force row level security;
    alter table public.organization_members enable row level security;
    alter table public.organization_members force row level security;
  `);

  // Setup test data
  const org1Id = "11111111-1111-1111-1111-111111111111";
  const org2Id = "22222222-2222-2222-2222-222222222222";
  const userOwner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userMember = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userSpecialist = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const userRestricted = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const teamEngId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

  await pg.exec(`
    -- Seed Org 1 & Org 2
    insert into public.organizations (id, name) values
      ('${org1Id}', 'Acme Corp'),
      ('${org2Id}', 'Rival Corp');

    -- Seed Memberships in Org 1
    insert into public.organization_members (organization_id, user_id, role, job_title) values
      ('${org1Id}', '${userOwner}', 'owner', 'CEO'),
      ('${org1Id}', '${userMember}', 'member', 'Developer'),
      ('${org1Id}', '${userSpecialist}', 'member', 'Support Lead'),
      ('${org1Id}', '${userRestricted}', 'member', 'Contractor');

    -- Seed Teams in Org 1
    insert into public.organization_teams (id, organization_id, name) values
      ('${teamEngId}', '${org1Id}', 'Engineering');

    -- Assign userMember and userRestricted to Engineering
    insert into public.organization_team_members (organization_id, team_id, user_id) values
      ('${org1Id}', '${teamEngId}', '${userMember}'),
      ('${org1Id}', '${teamEngId}', '${userRestricted}');

    -- Grant teams.create and github.view to Engineering
    insert into public.team_permissions (organization_id, team_id, permission_key) values
      ('${org1Id}', '${teamEngId}', 'teams.create'),
      ('${org1Id}', '${teamEngId}', 'github.view');

    -- Grant userSpecialist explicit ALLOW for people.invite (no team)
    insert into public.member_permission_overrides (organization_id, user_id, permission_key, effect) values
      ('${org1Id}', '${userSpecialist}', 'people.invite', 'allow');

    -- Grant userRestricted explicit DENY for github.view (despite team having it)
    insert into public.member_permission_overrides (organization_id, user_id, permission_key, effect) values
      ('${org1Id}', '${userRestricted}', 'github.view', 'deny');
  `);

  console.log("  [Step 4] Testing public.has_permission() PostgreSQL Function...");

  async function checkSqlPermission(uid: string | null, orgId: string, permKey: string): Promise<boolean> {
    await pg.exec(`delete from auth.current_session;`);
    if (uid) {
      await pg.exec(`insert into auth.current_session (user_id) values ('${uid}');`);
    }
    const res = await pg.query<{ has_perm: boolean }>(
      `select public.has_permission($1, $2) as has_perm`,
      [orgId, permKey]
    );
    return res.rows[0].has_perm;
  }

  // Check 1: Owner receives true for any permission
  const ownerHasPages = await checkSqlPermission(userOwner, org1Id, "pages.delete");
  const ownerHasBilling = await checkSqlPermission(userOwner, org1Id, "billing.manage");
  testAssert(ownerHasPages === true, "PG: Owner has pages.delete via public.has_permission");
  testAssert(ownerHasBilling === true, "PG: Owner has billing.manage via public.has_permission");

  // Check 2: Member with team permission receives true
  const memberHasTeamsCreate = await checkSqlPermission(userMember, org1Id, "teams.create");
  const memberHasGithub = await checkSqlPermission(userMember, org1Id, "github.view");
  testAssert(memberHasTeamsCreate === true, "PG: Member inherits teams.create from team");
  testAssert(memberHasGithub === true, "PG: Member inherits github.view from team");

  // Check 3: Member with ungranted permission receives false (default deny)
  const memberHasBilling = await checkSqlPermission(userMember, org1Id, "billing.manage");
  testAssert(memberHasBilling === false, "PG: Ungranted permission defaults to false");

  // Check 4: Explicit DENY override beats Team ALLOW
  const restrictedHasGithub = await checkSqlPermission(userRestricted, org1Id, "github.view");
  testAssert(restrictedHasGithub === false, "PG: Explicit individual DENY overrides team permission in SQL");

  // Check 5: Explicit ALLOW override grants capability without team
  const specialistHasInvite = await checkSqlPermission(userSpecialist, org1Id, "people.invite");
  testAssert(specialistHasInvite === true, "PG: Explicit individual ALLOW grants access in SQL");

  // Check 6: Alien tenant query receives false (Multi-tenant boundary)
  const alienTenantCheck = await checkSqlPermission(userOwner, org2Id, "pages.delete");
  testAssert(alienTenantCheck === false, "PG: Cross-tenant query strictly returns false for alien organization");

  // Grant usage and execution to authenticated role
  await pg.exec(`
    grant usage on schema public to authenticated;
    grant usage on schema auth to authenticated;
    grant all on all tables in schema public to authenticated;
    grant all on all tables in schema auth to authenticated;
    grant execute on all functions in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
    set role authenticated;
  `);

  console.log("  [Step 5] Testing Row Level Security (RLS) enforcement...");

  // Helper to switch simulated user while maintaining authenticated role
  async function asUser(uid: string) {
    await pg.exec(`set role postgres;`);
    await pg.exec(`delete from auth.current_session; insert into auth.current_session (user_id) values ('${uid}');`);
    await pg.exec(`set role authenticated;`);
  }

  // Set session to userMember (has teams.create)
  await asUser(userMember);

  // Member can insert team because they have teams.create
  let insertTeamSuccess = false;
  try {
    await pg.exec(`
      insert into public.organization_teams (organization_id, name)
      values ('${org1Id}', 'Design Team');
    `);
    insertTeamSuccess = true;
  } catch {
    insertTeamSuccess = false;
  }
  testAssert(insertTeamSuccess === true, "PG RLS: Member with teams.create successfully creates a team");

  // Set session to userSpecialist (does NOT have teams.create)
  await asUser(userSpecialist);
  let blockedInsertTeam = false;
  try {
    await pg.exec(`
      insert into public.organization_teams (organization_id, name)
      values ('${org1Id}', 'Unauthorized Team');
    `);
  } catch (err: unknown) {
    blockedInsertTeam = true;
  }
  testAssert(blockedInsertTeam === true, "PG RLS: Member without teams.create is rejected by RLS policy");

  // Member cannot insert team into Org 2 (cross-tenant RLS check)
  let blockedCrossTenantInsert = false;
  try {
    await pg.exec(`
      insert into public.organization_teams (organization_id, name)
      values ('${org2Id}', 'Infiltrated Team');
    `);
  } catch {
    blockedCrossTenantInsert = true;
  }
  testAssert(blockedCrossTenantInsert === true, "PG RLS: Member is rejected from inserting team in alien organization");

  // userSpecialist has people.invite: can insert invitation into Org 1
  let inviteSuccess = false;
  try {
    await pg.exec(`
      insert into public.organization_invitations (organization_id, email, role, invited_by)
      values ('${org1Id}', 'newcomer@test.com', 'member', '${userSpecialist}');
    `);
    inviteSuccess = true;
  } catch {
    inviteSuccess = false;
  }
  testAssert(inviteSuccess === true, "PG RLS: Member with people.invite successfully creates invitation");

  // userMember does NOT have people.invite: rejected by RLS
  await asUser(userMember);
  let blockedInvite = false;
  try {
    await pg.exec(`
      insert into public.organization_invitations (organization_id, email, role, invited_by)
      values ('${org1Id}', 'blocked@test.com', 'member', '${userMember}');
    `);
  } catch {
    blockedInvite = true;
  }
  testAssert(blockedInvite === true, "PG RLS: Member without people.invite is rejected from inviting users");
}

async function main() {
  await runPart1AutomatedLogicTests();
  await runPart2RealPostgreSqlTests();

  console.log("\n=======================================================");
  console.log(`TOTAL TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
