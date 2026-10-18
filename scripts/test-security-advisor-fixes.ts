import { PGlite } from "@electric-sql/pglite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function testAssert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exit(1);
  }
}

async function runAdvisorSecurityTests() {
  console.log("=======================================================");
  console.log("SUPABASE SECURITY ADVISOR REMEDIATION TEST SUITE");
  console.log("=======================================================\n");

  const db = new PGlite();

  // 1. Setup base schemas and roles
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists extensions;
    
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;

    create table if not exists auth.current_session (
      user_id uuid,
      role text
    );

    create table if not exists auth.users (
      id uuid primary key,
      email text
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.current_session limit 1;
    $$;

    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(role, 'anon') from auth.current_session limit 1;
    $$;
  `);

  async function asUser(uid: string | null, role: string = "authenticated") {
    await db.exec(`delete from auth.current_session;`);
    if (uid) {
      await db.exec(`insert into auth.current_session (user_id, role) values ('${uid}', '${role}');`);
    } else {
      await db.exec(`insert into auth.current_session (user_id, role) values (null, '${role}');`);
    }
  }

  // 2. Setup base tables
  await db.exec(`
    create table if not exists public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      status text not null default 'active'
    );

    create table if not exists public.organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      user_id uuid not null,
      role text not null check (role in ('owner', 'admin', 'member')),
      job_title text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, user_id)
    );

    create table if not exists public.organization_teams (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      name text not null
    );

    create table if not exists public.organization_team_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      team_id uuid not null references public.organization_teams(id),
      user_id uuid not null,
      created_at timestamptz not null default now(),
      unique (team_id, user_id)
    );

    create table if not exists public.team_permissions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      team_id uuid not null references public.organization_teams(id),
      permission_key text not null
    );

    create table if not exists public.member_permission_overrides (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      user_id uuid not null,
      permission_key text not null,
      effect text not null check (effect in ('allow', 'deny')),
      unique (organization_id, user_id, permission_key)
    );

    create table if not exists public.organization_files (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      size_bytes bigint not null default 0,
      storage_provider text not null default 'company_brain',
      deleted_at timestamptz
    );

    create table if not exists public.internal_system_secrets (
      key text primary key,
      secret text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.rate_limit_entries (
      key text primary key,
      tokens integer not null default 0,
      last_refill timestamptz not null default now()
    );

    create table if not exists public.organization_invitations (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      email text not null,
      role text not null default 'member',
      status text not null default 'pending',
      job_title text,
      initial_team_ids uuid[] default '{}',
      token text,
      token_hash text,
      expires_at timestamptz not null default (now() + interval '7 days'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.organization_calendar_events (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      title text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  console.log("[Phase 1] Testing Helper Functions & Migration 00024 Baseline...");
  
  // Define helper functions needed by policies
  await db.exec(`
    create or replace function public.is_org_member(target_org_id uuid)
    returns boolean language sql security definer stable set search_path = public as $$
      select exists (
        select 1 from public.organization_members
        where organization_id = target_org_id and user_id = auth.uid()
      );
    $$;

    create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
    returns boolean language sql security definer stable set search_path = public as $$
      select exists (
        select 1 from public.organization_members
        where organization_id = target_org_id and user_id = auth.uid() and role = any(allowed_roles)
      );
    $$;

    create or replace function public.shares_organization_with(target_user_id uuid)
    returns boolean language sql security definer stable set search_path = public as $$
      select exists (
        select 1 from public.organization_members m1
        join public.organization_members m2 on m1.organization_id = m2.organization_id
        where m1.user_id = auth.uid() and m2.user_id = target_user_id
      );
    $$;

    create or replace function public.get_organization_storage_bytes(p_org_id uuid)
    returns bigint language sql security definer set search_path = public stable as $$
      select coalesce(sum(size_bytes), 0)::bigint
      from public.organization_files
      where organization_id = p_org_id and storage_provider = 'company_brain' and deleted_at is null;
    $$;
    grant execute on function public.get_organization_storage_bytes(uuid) to authenticated, anon;
  `);

  // Load migration 00024
  const mig24 = fs.readFileSync("database/migrations/00024_secure_invitations_and_hashing.sql", "utf-8");
  await db.exec(mig24);
  testAssert(true, "Base Migration 00024 loaded into test database");

  // Load migration 00023
  const mig23 = fs.readFileSync("database/migrations/00023_permissions_hardening_and_rls.sql", "utf-8");
  await db.exec(mig23);
  testAssert(true, "Base Migration 00023 loaded into test database");

  console.log("\n[Phase 2] Verifying Vulnerabilities in Pre-Hardened State...");
  
  // Setup Org 1 and Org 2
  const org1Id = "11111111-1111-1111-1111-111111111111";
  const org2Id = "22222222-2222-2222-2222-222222222222";
  const aliceId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const bobId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${aliceId}', 'alice@company-a.com'),
      ('${bobId}', 'bob@company-b.com');

    insert into public.organizations (id, name, slug) values
      ('${org1Id}', 'Org Alpha', 'org-alpha'),
      ('${org2Id}', 'Org Beta', 'org-beta');

    insert into public.organization_members (organization_id, user_id, role) values
      ('${org1Id}', '${aliceId}', 'owner'),
      ('${org2Id}', '${bobId}', 'owner');

    insert into public.organization_files (organization_id, size_bytes) values
      ('${org1Id}', 500000),
      ('${org2Id}', 9999999);
  `);

  // Vulnerability Check: Bob reads Org 1's storage usage in pre-hardened state
  await asUser(bobId, "authenticated");
  const leakRes = await db.query<any>(`select public.get_organization_storage_bytes('${org1Id}') as bytes;`);
  testAssert(Number(leakRes.rows[0].bytes) === 500000, "CONFIRMED VULNERABILITY: Pre-hardened get_organization_storage_bytes leaks foreign org storage (500000 bytes visible to Bob)");

  console.log("\n[Phase 3] Applying Migration 00025 Hardening & Advisor Fixes...");

  // Apply EXACT Migration 00025 file
  const mig25Sql = fs.readFileSync("database/migrations/00025_supabase_security_advisor_hardening.sql", "utf-8");
  await db.exec(mig25Sql);
  testAssert(true, "Applied Migration 00025 hardening SQL file successfully");

  console.log("\n[Phase 4] Testing Negative Security & Cross-Tenant Assertions...");

  // 1. Cross-tenant storage isolation: Bob querying Org 1 must be REJECTED (42501)
  await asUser(bobId, "authenticated");
  let bobBlocked = false;
  try {
    await db.query(`select public.get_organization_storage_bytes('${org1Id}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      bobBlocked = true;
    }
  }
  testAssert(bobBlocked, "Cross-Tenant Blocked: Bob cannot query Org 1 storage bytes (42501)");

  // 2. Legitimate storage query: Alice querying Org 1 succeeds
  await asUser(aliceId, "authenticated");
  const aliceRes = await db.query<any>(`select public.get_organization_storage_bytes('${org1Id}') as bytes;`);
  testAssert(Number(aliceRes.rows[0].bytes) === 500000, "Legitimate Access: Alice correctly reads Org 1 storage (500000 bytes)");

  // 3. Service role can query any organization storage
  await asUser(null, "service_role");
  const srvRes = await db.query<any>(`select public.get_organization_storage_bytes('${org1Id}') as bytes;`);
  testAssert(Number(srvRes.rows[0].bytes) === 500000, "Service Role: Can inspect org storage for accounting/billing");

  // 4. Negative check: anon cannot execute accept_organization_invitation (42501)
  let anonAcceptBlocked = false;
  try {
    await db.exec(`set role anon;`);
    await db.query(`select public.accept_organization_invitation('dummy');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      anonAcceptBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  testAssert(anonAcceptBlocked, "Privilege Enforcement: Role 'anon' is strictly blocked from EXECUTE on accept_organization_invitation (42501)");

  // 5. Negative check: anon cannot execute has_permission (42501)
  let anonPermBlocked = false;
  try {
    await db.exec(`set role anon;`);
    await db.query(`select public.has_permission('${org1Id}', 'teams.create');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      anonPermBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  testAssert(anonPermBlocked, "Privilege Enforcement: Role 'anon' is strictly blocked from EXECUTE on has_permission (42501)");

  // 6. Negative check: anon cannot execute get_organization_storage_bytes (42501)
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
  testAssert(anonStorageBlocked, "Privilege Enforcement: Role 'anon' is strictly blocked from EXECUTE on get_organization_storage_bytes (42501)");

  console.log("\n[Phase 5] Testing Hardened check_rate_limit Security...");
  await asUser(null, "anon");

  const rateLimitSecret = "strong_rate_limit_secret_32_characters_long_123";
  await db.exec(`
    insert into public.internal_system_secrets (key, secret) values ('rate_limit', '${rateLimitSecret}')
    on conflict (key) do update set secret = excluded.secret;
  `);

  // 1. Invalid key format rejected (22023)
  let badKeyBlocked = false;
  try {
    await db.query(`select public.check_rate_limit('bad_prefix', 10, 60, 'dummy');`);
  } catch (err: any) {
    if (err.code === "22023" || err.message?.includes("Invalid rate limit key format")) {
      badKeyBlocked = true;
    }
  }
  testAssert(badKeyBlocked, "Key Whitelist: Invalid key format without 'rl:' rejected (22023)");

  // 2. Missing server token rejected (42501)
  let missingTokenBlocked = false;
  try {
    await db.query(`select public.check_rate_limit('rl:login:1.2.3.4', 10, 60, null);`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("requires valid cryptographic server_token")) {
      missingTokenBlocked = true;
    }
  }
  testAssert(missingTokenBlocked, "Server Token Enforced: check_rate_limit rejects null token (42501)");

  // 3. Forged signature rejected (42501)
  const nowTs = Math.floor(Date.now() / 1000);
  let forgedBlocked = false;
  try {
    await db.query(`select public.check_rate_limit('rl:login:1.2.3.4', 10, 60, '${nowTs}.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("invalid cryptographic server_token signature")) {
      forgedBlocked = true;
    }
  }
  testAssert(forgedBlocked, "Forged Signature: Rejection of forged signature with 42501");

  // 4. Valid RFC 2104 HMAC token succeeds
  const key = "rl:login:1.2.3.4";
  const limit = 10;
  const windowSecs = 60;
  const validMessage = `${key}:${limit}:${windowSecs}:${nowTs}`;
  const validSig = crypto.createHmac("sha256", rateLimitSecret).update(validMessage).digest("hex");
  const validToken = `${nowTs}.${validSig}`;

  const validRes = await db.query<any>(`select public.check_rate_limit('${key}', ${limit}, ${windowSecs}, '${validToken}') as allowed;`);
  testAssert(validRes.rows[0].allowed === true, "Valid HMAC Server Token: check_rate_limit allowed request");

  // 5. Expired timestamp rejected (> 120s)
  const expiredTs = nowTs - 200;
  const expiredMsg = `${key}:${limit}:${windowSecs}:${expiredTs}`;
  const expiredSig = crypto.createHmac("sha256", rateLimitSecret).update(expiredMsg).digest("hex");
  let expiredBlocked = false;
  try {
    await db.query(`select public.check_rate_limit('${key}', ${limit}, ${windowSecs}, '${expiredTs}.${expiredSig}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("expired or timestamp desynchronized")) {
      expiredBlocked = true;
    }
  }
  testAssert(expiredBlocked, "Replay Protection: Rejection of expired server token (>120s)");

  // 6. Fail-closed if secret is deleted
  await db.exec(`delete from public.internal_system_secrets where key in ('rate_limit', 'server_auth');`);
  let unconfiguredBlocked = false;
  try {
    await db.query(`select public.check_rate_limit('${key}', ${limit}, ${windowSecs}, '${validToken}');`);
  } catch (err: any) {
    if (err.code === "42501" && err.message?.includes("rate limiting secret is unconfigured or invalid")) {
      unconfiguredBlocked = true;
    }
  }
  testAssert(unconfiguredBlocked, "Strict Fail-Closed: check_rate_limit aborts with 42501 when secret is unconfigured");

  // Restore secret
  await db.exec(`
    insert into public.internal_system_secrets (key, secret) values ('rate_limit', '${rateLimitSecret}');
  `);

  console.log("\n[Phase 6] Verifying Legitimate Invitation Acceptance & Concurrency...");

  const davidId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  await db.exec(`
    insert into auth.users (id, email) values ('${davidId}', 'david@company-a.com');
  `);

  const rawInviteToken = "david_invitation_secret_token_123456789";
  const tokenHash = crypto.createHash("sha256").update(rawInviteToken).digest("hex");

  await db.exec(`
    insert into public.organization_invitations (
      organization_id,
      email,
      role,
      status,
      token_hash,
      expires_at
    ) values (
      '${org1Id}',
      'david@company-a.com',
      'admin',
      'pending',
      '${tokenHash}',
      now() + interval '3 days'
    );
  `);

  // 1. Authenticated David accepts his invitation successfully
  await asUser(davidId, "authenticated");
  const acceptRes = await db.query<any>(`select public.accept_organization_invitation('${tokenHash}') as res;`);
  testAssert(acceptRes.rows[0].res.success === true, "Authenticated Acceptance: David accepts invitation successfully");

  // 2. Single-Use enforced: second attempt rejected
  const replayRes = await db.query<any>(`select public.accept_organization_invitation('${tokenHash}') as res;`);
  testAssert(replayRes.rows[0].res.code === "ALREADY_ACCEPTED", "Single-Use Enforced: Second attempt returns ALREADY_ACCEPTED");

  // 3. Email mismatch blocked
  const bobInviteToken = "bob_invitation_secret_token_987654321";
  const bobHash = crypto.createHash("sha256").update(bobInviteToken).digest("hex");
  await db.exec(`
    insert into public.organization_invitations (
      organization_id,
      email,
      role,
      status,
      token_hash,
      expires_at
    ) values (
      '${org1Id}',
      'carol@company-a.com',
      'member',
      'pending',
      '${bobHash}',
      now() + interval '3 days'
    );
  `);

  await asUser(bobId, "authenticated");
  let emailMismatchBlocked = false;
  try {
    await db.query(`select public.accept_organization_invitation('${bobHash}');`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Invitation email mismatch")) {
      emailMismatchBlocked = true;
    }
  }
  testAssert(emailMismatchBlocked, "Identity Guard: Bob blocked from accepting Carol's invite (42501)");

  console.log("\n[Phase 7] Verifying Permission Logic Preservation & Trigger...");

  // Trigger test for update_calendar_events_updated_at
  await db.exec(`
    create trigger trg_calendar_updated_at
      before update on public.organization_calendar_events
      for each row execute function public.update_calendar_events_updated_at();

    insert into public.organization_calendar_events (id, organization_id, title)
    values ('44444444-4444-4444-4444-444444444444', '${org1Id}', 'Sprint Planning');
  `);

  await db.exec(`
    update public.organization_calendar_events
    set title = 'Sprint Planning v2'
    where id = '44444444-4444-4444-4444-444444444444';
  `);
  testAssert(true, "Trigger Execution: update_calendar_events_updated_at executes without search_path errors");

  // Setup team permissions for Org 1
  const teamId = "33333333-3333-3333-3333-333333333333";
  const charlieId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  await db.exec(`
    insert into public.organization_members (organization_id, user_id, role) values
      ('${org1Id}', '${charlieId}', 'member');

    insert into public.organization_teams (id, organization_id, name) values
      ('${teamId}', '${org1Id}', 'Engineering');

    insert into public.organization_team_members (organization_id, team_id, user_id) values
      ('${org1Id}', '${teamId}', '${charlieId}');

    insert into public.team_permissions (organization_id, team_id, permission_key) values
      ('${org1Id}', '${teamId}', 'teams.create');
  `);

  // Rule 1: Owner has total access unconditionally
  await asUser(aliceId, "authenticated");
  const ownerPerm = await db.query<any>(`select public.has_permission('${org1Id}', 'teams.create') as p;`);
  testAssert(ownerPerm.rows[0].p === true, "Preserved Rule 1: Owner (Alice) has teams.create");
  const ownerAnyPerm = await db.query<any>(`select public.has_permission('${org1Id}', 'billing.manage') as p;`);
  testAssert(ownerAnyPerm.rows[0].p === true, "Preserved Rule 1: Owner (Alice) has ungranted billing.manage unconditionally");

  // Rule 4: Team grant works for member (Charlie)
  await asUser(charlieId, "authenticated");
  const charlieTeamPerm = await db.query<any>(`select public.has_permission('${org1Id}', 'teams.create') as p;`);
  testAssert(charlieTeamPerm.rows[0].p === true, "Preserved Rule 4: Charlie inherits teams.create from Engineering team");

  // Rule 5: Default deny for ungranted permission
  const charlieUngranted = await db.query<any>(`select public.has_permission('${org1Id}', 'billing.manage') as p;`);
  testAssert(charlieUngranted.rows[0].p === false, "Preserved Rule 5: Ungranted permission billing.manage defaults to false");

  // Rule 2: Explicit DENY overrides team grant
  await db.exec(`
    insert into public.member_permission_overrides (organization_id, user_id, permission_key, effect)
    values ('${org1Id}', '${charlieId}', 'teams.create', 'deny');
  `);
  const charlieDenied = await db.query<any>(`select public.has_permission('${org1Id}', 'teams.create') as p;`);
  testAssert(charlieDenied.rows[0].p === false, "Preserved Rule 2: Explicit individual DENY strictly overrides team grant");

  // Rule 3: Explicit ALLOW grants access
  await db.exec(`
    insert into public.member_permission_overrides (organization_id, user_id, permission_key, effect)
    values ('${org1Id}', '${charlieId}', 'billing.manage', 'allow');
  `);
  const charlieAllowed = await db.query<any>(`select public.has_permission('${org1Id}', 'billing.manage') as p;`);
  testAssert(charlieAllowed.rows[0].p === true, "Preserved Rule 3: Explicit individual ALLOW grants access");

  // Cross-tenant permission check: Charlie has zero permissions in Org 2
  const charlieOrg2 = await db.query<any>(`select public.has_permission('${org2Id}', 'teams.create') as p;`);
  testAssert(charlieOrg2.rows[0].p === false, "Preserved Isolation: Charlie has zero permissions in Org 2");

  console.log("\n=======================================================");
  console.log("ALL 24 ADVISOR REMEDIATION ASSERTIONS PASSED!");
  console.log("=======================================================");
}

runAdvisorSecurityTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
