import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * BusinessBrain — SEC-01 End-to-End Invitation Lifecycle Verification
 * 
 * Verifies the complete browser & server-side flow:
 * 1. Scenario A: Invalid / non-existent token handling (Fail-closed)
 * 2. Scenario B: Expired token handling
 * 3. Scenario C: Public unauthenticated invitation view (returns org name & email, prompts auth)
 * 4. Scenario D: Identity mismatch denial (attacker attempts to accept another user's invite)
 * 5. Scenario E: Legitimate acceptance, atomic membership, role assignment & team scoping
 * 6. Scenario F: Replay prevention / single-use enforcement (already accepted rejection)
 * 7. Scenario G: Active organization cookie (cb_active_org_id) & subsequent workspace authorization
 */

async function runE2EInvitationFlow() {
  console.log("=================================================================");
  console.log("BUSINESSBRAIN — E2E INVITATION FLOW & SECURITY VERIFICATION");
  console.log("=================================================================\n");

  const db = new PGlite();
  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${title}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${title}${details ? ` -> ${details}` : ""}`);
      failCount++;
    }
  }

  // 1. Initialize complete Supabase schema & auth mock
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text unique not null,
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
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
  `);

  async function setSession(uid: string | null, role: string = "authenticated") {
    await db.exec(`delete from auth.current_session;`);
    if (uid) {
      await db.exec(`insert into auth.current_session (user_id, role) values ('${uid}', '${role}');`);
    } else {
      await db.exec(`insert into auth.current_session (user_id, role) values (null, '${role}');`);
    }
  }

  // Apply migrations 00024, 00025, 00026
  const mig00024 = fs.readFileSync("database/migrations/00024_secure_invitations_and_hashing.sql", "utf-8");
  const mig00025 = fs.readFileSync("database/migrations/00025_supabase_security_advisor_hardening.sql", "utf-8");
  const mig00026 = fs.readFileSync("database/migrations/00026_security_advisor_privilege_remedy.sql", "utf-8");

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
  `);

  console.log("[Phase 1] Bootstrapping Database & Migrations 00024-00026...");
  await db.exec(mig00024);
  await db.exec(mig00025);
  await db.exec(mig00026);
  assert(true, "All migrations (00024, 00025, 00026) applied cleanly");

  // Configure high-entropy 256-bit server secret
  const serverAuthSecret = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  await db.exec(`
    insert into public.internal_system_secrets (key, secret) values ('server_auth', '${serverAuthSecret}')
    on conflict (key) do update set secret = excluded.secret;
  `);

  // Setup test organizations & teams
  const orgAId = "11111111-1111-1111-1111-111111111111";
  const orgBId = "22222222-2222-2222-2222-222222222222"; // Alien org
  const teamEngineeringOrgA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const teamAlienOrgB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const adminUser = "99999999-9999-9999-9999-999999999999";
  const legitInvitee = "33333333-3333-3333-3333-333333333333";
  const attackerUser = "44444444-4444-4444-4444-444444444444";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${adminUser}', 'admin@acmecorp.com'),
      ('${legitInvitee}', 'sarah.engineer@acmecorp.com'),
      ('${attackerUser}', 'mallory.attacker@external.com');

    insert into public.organizations (id, name, slug) values
      ('${orgAId}', 'Acme Corporation', 'acme-corp'),
      ('${orgBId}', 'Alien Industries', 'alien-ind');

    insert into public.organization_members (organization_id, user_id, role) values
      ('${orgAId}', '${adminUser}', 'owner');

    insert into public.organization_teams (id, organization_id, name) values
      ('${teamEngineeringOrgA}', '${orgAId}', 'Engineering Team'),
      ('${teamAlienOrgB}', '${orgBId}', 'Alien Stealth Team');
  `);

  // Helper to generate HMAC server token matching Node.js gateway
  function makeServerToken(tokenHash: string): string {
    const epoch = Math.floor(Date.now() / 1000);
    const message = `invitation-details:${tokenHash.toLowerCase().trim()}:${epoch}`;
    const sig = crypto.createHmac("sha256", serverAuthSecret).update(message).digest("hex");
    return `${epoch}.${sig}`;
  }

  // Helper to simulate gateway /invite/[token] view
  async function simulateInvitePageLoad(token: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const serverToken = makeServerToken(tokenHash);

    const res = await db.query<any>(`
      select * from public.get_invitation_details('${tokenHash}', '${serverToken}');
    `);
    return res.rows[0] || null;
  }

  // ---------------------------------------------------------------------------
  // SCENARIO A: Invalid / Non-Existent Token
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario A] Testing Invalid / Non-Existent Token...");
  const invalidToken = "non_existent_token_1234567890abcdef1234567890abcdef";
  const invalidRes = await simulateInvitePageLoad(invalidToken);
  assert(invalidRes === null || invalidRes === undefined, "Non-existent token returns empty set (Page renders 'Invalid Invitation')");

  // ---------------------------------------------------------------------------
  // SCENARIO B: Expired Token
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario B] Testing Expired Token...");
  const expiredRawToken = crypto.randomBytes(32).toString("hex");
  const expiredTokenHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");

  await db.exec(`
    insert into public.organization_invitations (
      organization_id, email, role, token_hash, status, expires_at
    ) values (
      '${orgAId}', 'expired.user@acmecorp.com', 'member', '${expiredTokenHash}',
      'pending', now() - interval '2 days'
    );
  `);

  const expiredRes = await simulateInvitePageLoad(expiredRawToken);
  assert(
    expiredRes !== null && expiredRes.is_expired === true,
    "Expired token correctly detected as is_expired = true (Page renders 'Invitation Expired')"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO C: Public Unauthenticated View of Legitimate Invitation
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario C] Testing Public Unauthenticated Invitation View...");
  const legitRawToken = crypto.randomBytes(32).toString("hex");
  const legitTokenHash = crypto.createHash("sha256").update(legitRawToken).digest("hex");

  await db.exec(`
    insert into public.organization_invitations (
      organization_id, email, role, job_title, initial_team_ids, token_hash, status, expires_at
    ) values (
      '${orgAId}', 'sarah.engineer@acmecorp.com', 'member', 'Senior Frontend Engineer',
      array['${teamEngineeringOrgA}', '${teamAlienOrgB}']::uuid[],
      '${legitTokenHash}', 'pending', now() + interval '7 days'
    );
  `);

  const legitView = await simulateInvitePageLoad(legitRawToken);
  assert(legitView !== null, "Legitimate invitation details successfully retrieved via HMAC gateway");
  assert(legitView.organization_name === "Acme Corporation", "Workspace name accurately resolved for UI banner");
  assert(legitView.email === "sarah.engineer@acmecorp.com", "Invited email accurately resolved");
  assert(legitView.role === "member", "Assigned role accurately resolved");
  assert(legitView.is_expired === false, "Expiration state accurately resolved as active");

  // ---------------------------------------------------------------------------
  // SCENARIO D: Identity Mismatch Denial (Attacker Attempts Acceptance)
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario D] Testing Identity Mismatch Denial (Privilege Escalation Guard)...");
  await setSession(attackerUser, "authenticated");

  let attackerError: any = null;
  try {
    await db.query(`select public.accept_organization_invitation('${legitTokenHash}');`);
  } catch (err: any) {
    attackerError = err;
  }

  assert(
    attackerError !== null && (attackerError.code === "42501" || attackerError.message?.includes("Access denied")),
    "Attacker blocked from accepting invitation issued to different email address (42501)"
  );

  // Confirm invite remained pending
  const checkStatusAfterAttack = await db.query<any>(`
    select status from public.organization_invitations where token_hash = '${legitTokenHash}';
  `);
  assert(checkStatusAfterAttack.rows[0].status === "pending", "Invitation status preserved as 'pending' after failed attack");

  // ---------------------------------------------------------------------------
  // SCENARIO E: Legitimate Acceptance & Atomic Membership Provisioning
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario E] Testing Legitimate Acceptance & Atomic Team Scoping...");
  await setSession(legitInvitee, "authenticated");

  const acceptRes = await db.query<any>(`
    select public.accept_organization_invitation('${legitTokenHash}') as result;
  `);

  const resJson = typeof acceptRes.rows[0].result === "string" 
    ? JSON.parse(acceptRes.rows[0].result) 
    : acceptRes.rows[0].result;

  assert(resJson.success === true, "Legitimate recipient successfully accepted invitation");
  assert(resJson.organization_id === orgAId, "Result contains target organization_id for cookie creation");

  // Verify membership record created with correct role and job_title
  const memberRecord = await db.query<any>(`
    select role, job_title from public.organization_members
    where organization_id = '${orgAId}' and user_id = '${legitInvitee}';
  `);
  assert(memberRecord.rows.length === 1, "Member record created in organization_members");
  assert(memberRecord.rows[0].role === "member", "Role assigned strictly matches invitation (member)");
  assert(memberRecord.rows[0].job_title === "Senior Frontend Engineer", "Job title assigned strictly matches invitation");

  // Verify atomic team assignment & cross-tenant security guard
  const teamMemberships = await db.query<any>(`
    select team_id from public.organization_team_members
    where user_id = '${legitInvitee}';
  `);
  assert(
    teamMemberships.rows.some((r) => r.team_id === teamEngineeringOrgA),
    "Legitimate team (Engineering Team in Org A) correctly assigned"
  );
  assert(
    !teamMemberships.rows.some((r) => r.team_id === teamAlienOrgB),
    "Cross-Tenant Team Guard: Alien team (Team in Org B) strictly discarded"
  );

  // Verify invitation state transitioned to accepted
  const finalInviteRecord = await db.query<any>(`
    select status from public.organization_invitations where token_hash = '${legitTokenHash}';
  `);
  assert(finalInviteRecord.rows[0].status === "accepted", "Invitation status atomically transitioned to 'accepted'");

  // ---------------------------------------------------------------------------
  // SCENARIO F: Single-Use Enforcement & Replay Rejection
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario F] Testing Single-Use Enforcement & Replay Rejection...");
  const replayRes = await db.query<any>(`
    select public.accept_organization_invitation('${legitTokenHash}') as result;
  `);
  const replayJson = typeof replayRes.rows[0].result === "string" 
    ? JSON.parse(replayRes.rows[0].result) 
    : replayRes.rows[0].result;

  assert(replayJson.success === false, "Second acceptance attempt strictly rejected");
  assert(replayJson.code === "ALREADY_ACCEPTED", "Error code ALREADY_ACCEPTED returned on replay attempt");

  // ---------------------------------------------------------------------------
  // SCENARIO G: Cookie Behavior & Subsequent Workspace Authorization
  // ---------------------------------------------------------------------------
  console.log("\n[Scenario G] Testing Cookie cb_active_org_id & Dashboard Authorization...");

  // Simulate cookie cb_active_org_id = orgAId
  const activeOrgCookie = orgAId;

  // In Next.js middleware/server components: is_org_member(cb_active_org_id) is evaluated
  const memberCheck = await db.query<any>(`
    select public.is_org_member('${activeOrgCookie}') as is_member;
  `);
  assert(memberCheck.rows[0].is_member === true, "Active organization cookie grants valid membership access to dashboard");

  // Alien organization cookie evaluation
  const alienCookieCheck = await db.query<any>(`
    select public.is_org_member('${orgBId}') as is_member;
  `);
  assert(alienCookieCheck.rows[0].is_member === false, "Tampered/Alien organization cookie strictly rejected (is_org_member = false)");

  console.log("\n=================================================================");
  console.log(`E2E TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=================================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runE2EInvitationFlow().catch((err) => {
  console.error("FATAL E2E SUITE ERROR:", err);
  process.exit(1);
});
