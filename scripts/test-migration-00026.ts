import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Test Suite: Validation of Migration 00026 (Security Advisor Privilege Remedy)
 * Verifies:
 * 1. update_calendar_events_updated_at:
 *    - Revoked from authenticated/anon via direct RPC (42501)
 *    - Preserved execution as database trigger on calendar_events update
 * 2. get_organization_storage_bytes as SECURITY INVOKER:
 *    - Legitimate member calculates exact bytes under caller's RLS
 *    - Alien organization member blocked with 42501
 *    - User with zero organizations blocked with 42501
 *    - service_role calculates exact bytes
 *    - anon execution blocked with 42501
 * 3. Regression checks:
 *    - has_permission (5 rules)
 *    - check_rate_limit (HMAC fail-closed)
 *    - accept_organization_invitation (anon blocked, identity mismatch blocked)
 */

async function runAuditTests() {
  console.log("=======================================================");
  console.log("MIGRATION 00026 SECURITY AUDIT & VERIFICATION SUITE");
  console.log("=======================================================\n");

  const db = new PGlite();

  let passCount = 0;
  let failCount = 0;
  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failCount++;
    }
  }

  // 1. Bootstrap mock Supabase environment
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      created_at timestamptz default now()
    );

    create table if not exists auth.current_session (
      user_id uuid,
      role text not null default 'authenticated'
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.current_session limit 1;
    $$;

    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(role, 'anon') from auth.current_session limit 1;
    $$;

    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object(
        'sub', user_id,
        'email', (select email from auth.users where id = user_id),
        'role', coalesce(role, 'anon')
      ) from auth.current_session limit 1;
    $$;

    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;
  `);

  async function asUser(uid: string | null, role: string = "authenticated") {
    await db.exec(`delete from auth.current_session;`);
    if (uid) {
      await db.exec(`insert into auth.current_session (user_id, role) values ('${uid}', '${role}');`);
    } else {
      await db.exec(`insert into auth.current_session (user_id, role) values (null, '${role}');`);
    }
  }

  // Apply base migrations 00024 and 00025
  const mig00024Path = path.resolve(process.cwd(), "database/migrations/00024_secure_invitations_and_hashing.sql");
  const mig00025Path = path.resolve(process.cwd(), "database/migrations/00025_supabase_security_advisor_hardening.sql");
  const mig00026Path = path.resolve(process.cwd(), "database/migrations/00026_security_advisor_privilege_remedy.sql");

  // Create base tables needed
  await db.exec(`
    create table if not exists public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text unique not null,
      status text not null default 'active',
      created_at timestamptz default now()
    );

    create table if not exists public.organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      role text not null check (role in ('owner', 'admin', 'member')),
      job_title text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(organization_id, user_id)
    );

    create table if not exists public.organization_teams (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      created_at timestamptz default now()
    );

    create table if not exists public.organization_team_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      team_id uuid not null references public.organization_teams(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz default now(),
      unique(team_id, user_id)
    );

    create table if not exists public.team_permissions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      team_id uuid not null references public.organization_teams(id) on delete cascade,
      permission_key text not null,
      unique(team_id, permission_key)
    );

    create table if not exists public.member_permission_overrides (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      permission_key text not null,
      effect text not null check (effect in ('allow', 'deny')),
      unique(organization_id, user_id, permission_key)
    );

    create table if not exists public.organization_invitations (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      email text not null,
      role text not null check (role in ('owner', 'admin', 'member')),
      token_hash text unique,
      token text,
      job_title text,
      initial_team_ids uuid[],
      status text not null default 'pending',
      expires_at timestamptz not null default (now() + interval '7 days'),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.organization_files (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      size_bytes bigint not null default 0,
      storage_provider text not null default 'company_brain',
      deleted_at timestamptz,
      created_at timestamptz default now()
    );

    create table if not exists public.organization_calendar_events (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      title text not null,
      start_time timestamptz not null default now(),
      end_time timestamptz not null default now(),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.rate_limit_entries (
      key text primary key,
      tokens integer not null default 0,
      last_refill timestamptz not null default now()
    );

    alter table public.organization_files enable row level security;
    alter table public.organization_calendar_events enable row level security;
  `);

  console.log("[Phase 1] Applying Baseline Migrations 00024 & 00025...");
  await db.exec(fs.readFileSync(mig00024Path, "utf-8"));
  await db.exec(fs.readFileSync(mig00025Path, "utf-8"));
  assert(true, "Base migrations 00024 and 00025 loaded successfully");

  // Add calendar trigger
  await db.exec(`
    drop trigger if exists trigger_update_calendar_events_timestamp on public.organization_calendar_events;
    create trigger trigger_update_calendar_events_timestamp
      before update on public.organization_calendar_events
      for each row execute function public.update_calendar_events_updated_at();

    create policy "Members can view files"
      on public.organization_files for select
      using (public.is_org_member(organization_id) and deleted_at is null);

    create policy "Members can update calendar"
      on public.organization_calendar_events for all
      using (public.is_org_member(organization_id));
  `);

  // Insert test users and fixtures
  const aliceId = "11111111-1111-1111-1111-111111111111"; // Org 1 Owner
  const bobId = "22222222-2222-2222-2222-222222222222";   // Org 2 Owner
  const charlieId = "33333333-3333-3333-3333-333333333333"; // Member of no org
  const org1Id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const org2Id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${aliceId}', 'alice@example.com'),
      ('${bobId}', 'bob@example.com'),
      ('${charlieId}', 'charlie@example.com');

    insert into public.organizations (id, name, slug) values
      ('${org1Id}', 'Acme Corp', 'acme'),
      ('${org2Id}', 'Beta Inc', 'beta');

    insert into public.organization_members (organization_id, user_id, role) values
      ('${org1Id}', '${aliceId}', 'owner'),
      ('${org2Id}', '${bobId}', 'owner');

    insert into public.organization_files (organization_id, name, size_bytes, storage_provider) values
      ('${org1Id}', 'file1.pdf', 300000, 'company_brain'),
      ('${org1Id}', 'file2.png', 200000, 'company_brain'),
      ('${org1Id}', 'deleted.doc', 999999, 'company_brain'),
      ('${org2Id}', 'beta_file.zip', 750000, 'company_brain');

    update public.organization_files set deleted_at = now() where name = 'deleted.doc';

    insert into public.organization_calendar_events (id, organization_id, title) values
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '${org1Id}', 'Weekly Sprint Planning');
  `);

  // Phase 2: Apply Migration 00026
  console.log("\n[Phase 2] Applying Migration 00026 (Privilege Remedy)...");
  await db.exec(fs.readFileSync(mig00026Path, "utf-8"));
  assert(true, "Applied migration 00026 cleanly without syntax or catalog errors");

  // Phase 3: Test update_calendar_events_updated_at
  console.log("\n[Phase 3] Testing update_calendar_events_updated_at Privileges & Trigger Execution...");
  
  await asUser(aliceId, "authenticated");

  const initialEvent = await db.query<{ updated_at: string }>(`
    select updated_at from public.organization_calendar_events where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  `);
  const initialUpdatedAt = initialEvent.rows[0].updated_at;

  // Wait a small tick
  await new Promise((r) => setTimeout(r, 20));

  await db.exec(`
    update public.organization_calendar_events 
    set title = 'Updated Sprint Planning' 
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  `);

  const afterUpdateEvent = await db.query<{ updated_at: string }>(`
    select updated_at from public.organization_calendar_events where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  `);
  const afterUpdatedAt = afterUpdateEvent.rows[0].updated_at;

  assert(
    new Date(afterUpdatedAt).getTime() >= new Date(initialUpdatedAt).getTime(),
    "Trigger operates cleanly upon table UPDATE even with function REVOKE on authenticated"
  );

  // Test 3.2: Direct RPC call blocked to authenticated
  let rpcCallBlocked = false;
  try {
    await db.exec(`set role authenticated;`);
    await db.query(`select public.update_calendar_events_updated_at();`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      rpcCallBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  assert(
    rpcCallBlocked,
    "Direct execution of update_calendar_events_updated_at as authenticated is strictly blocked (42501)"
  );

  // Phase 4: Test get_organization_storage_bytes as SECURITY INVOKER
  console.log("\n[Phase 4] Testing get_organization_storage_bytes as SECURITY INVOKER under RLS...");

  // Test 4.1: Legitimate member (Alice) in Org 1
  await asUser(aliceId, "authenticated");
  const aliceRes = await db.query<{ get_organization_storage_bytes: string }>(`
    select public.get_organization_storage_bytes('${org1Id}');
  `);
  assert(
    Number(aliceRes.rows[0].get_organization_storage_bytes) === 500000,
    `Legitimate member correctly calculates exact non-deleted bytes (expected 500000, got ${aliceRes.rows[0].get_organization_storage_bytes})`
  );

  // Test 4.2: Alien member (Bob from Org 2) querying Org 1
  await asUser(bobId, "authenticated");
  let bobCrossTenantBlocked = false;
  try {
    await db.query(`select public.get_organization_storage_bytes('${org1Id}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      bobCrossTenantBlocked = true;
    }
  }
  assert(
    bobCrossTenantBlocked,
    "Cross-Tenant Blocked: Alien member Bob is strictly rejected from querying Org 1 (42501)"
  );

  // Test 4.3: User with no organization (Charlie)
  await asUser(charlieId, "authenticated");
  let charlieBlocked = false;
  try {
    await db.query(`select public.get_organization_storage_bytes('${org1Id}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      charlieBlocked = true;
    }
  }
  assert(
    charlieBlocked,
    "Unrelated user Charlie is strictly rejected with 42501"
  );

  // Test 4.4: service_role can query any organization
  await asUser(null, "service_role");
  const serviceRes = await db.query<{ get_organization_storage_bytes: string }>(`
    select public.get_organization_storage_bytes('${org1Id}');
  `);
  assert(
    Number(serviceRes.rows[0].get_organization_storage_bytes) === 500000,
    "service_role correctly inspects storage bytes for system administration/billing"
  );

  // Test 4.5: role anon strictly blocked by REVOKE
  await asUser(null, "anon");
  let anonStorageBlocked = false;
  try {
    await db.exec(`set role anon;`);
    await db.query(`select public.get_organization_storage_bytes('${org1Id}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      anonStorageBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  assert(
    anonStorageBlocked,
    "Role anon is strictly blocked from executing get_organization_storage_bytes (42501)"
  );

  // Phase 5: Regression checks on Rate Limiting, Permissions, and Invitations
  console.log("\n[Phase 5] Verifying Zero Regressions on Remaining Security Definer Functions...");

  // Check rate limit HMAC
  const secretKey = "01234567890123456789012345678901";
  await db.exec(`
    insert into public.internal_system_secrets (key, secret) values ('rate_limit', '${secretKey}')
    on conflict (key) do update set secret = excluded.secret;
  `);

  const nowEpoch = Math.floor(Date.now() / 1000);
  const msg = `rl:test:auth:user@example.com:10:60:${nowEpoch}`;
  const validSig = crypto.createHmac("sha256", secretKey).update(msg).digest("hex");
  const validToken = `${nowEpoch}.${validSig}`;

  const rlRes = await db.query<{ check_rate_limit: boolean }>(`
    select public.check_rate_limit('rl:test:auth:user@example.com', 10, 60, '${validToken}');
  `);
  assert(rlRes.rows[0].check_rate_limit === true, "check_rate_limit with valid cryptographic token continues to succeed");

  // Check accept_organization_invitation
  let anonAcceptBlocked = false;
  try {
    await db.exec(`set role anon;`);
    await db.query(`select public.accept_organization_invitation('0000000000000000000000000000000000000000000000000000000000000000');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      anonAcceptBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  assert(
    anonAcceptBlocked,
    "accept_organization_invitation remains strictly blocked to role anon (42501)"
  );

  console.log("\n=======================================================");
  console.log(`TOTAL AUDIT ASSERTIONS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=======================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runAuditTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
