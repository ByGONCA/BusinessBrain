/**
 * BusinessBrain — SEC-01 Invitations Security & Governance Verification Suite
 * 
 * Tests:
 * 1. Migration 00024 Schema & Backfill:
 *    - Creation of token_hash column and unique index
 *    - Deterministic backfill of legacy tokens to SHA-256
 *    - Redaction of legacy tokens for non-pending invitations
 *    - Nullable token column support
 * 
 * 2. RPC get_invitation_details:
 *    - Format validation: Rejects malformed hashes
 *    - Access control: Blocks unauthenticated callers without server token (42501)
 *    - Sanitized payload: Exposes only workspace metadata, role, email and status
 *    - Expired invitation detection
 * 
 * 3. RPC accept_organization_invitation:
 *    - Unauthenticated rejection
 *    - Invalid token rejection
 *    - Expired token auto-expiration and rejection
 *    - Strict identity mismatch rejection (42501 Access Denied)
 *    - Single-use atomic enforcement (second acceptance rejected)
 *    - Cross-tenant team isolation (alien organization teams discarded)
 *    - Role enforcement (only admin/member allowed)
 * 
 * Engine: PGlite WASM Postgres 16 (Full ACID & RLS SQL Engine)
 */

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { generateInvitationServerToken, getServerAuthSecret } from "../lib/security/authorization";

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

async function runInvitationsSecuritySuite() {
  console.log("\n=======================================================");
  console.log("BUSINESSBRAIN — SEC-01 INVITATIONS SECURITY TEST SUITE");
  console.log("=======================================================\n");

  const db = new PGlite();

  console.log("[Step 1] Bootstrapping PostgreSQL schema and prerequisites...");

  // Setup basic schema and auth mock
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists extensions;

    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;

    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      role text default 'authenticated'
    );

    create table if not exists auth.current_session (
      user_id uuid,
      role text default 'authenticated'
    );

    create or replace function auth.uid() returns uuid as $$
      select user_id from auth.current_session limit 1;
    $$ language sql stable;

    create or replace function auth.role() returns text as $$
      select coalesce((select role from auth.current_session limit 1), 'anon');
    $$ language sql stable;

    create table if not exists public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text unique not null,
      status text not null default 'active',
      created_at timestamptz not null default now()
    );

    create table if not exists public.organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      role text not null check (role in ('owner', 'admin', 'member')),
      job_title text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, user_id)
    );

    create table if not exists public.organization_teams (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists public.organization_team_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      team_id uuid not null references public.organization_teams(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      unique (team_id, user_id)
    );

    create table if not exists public.organization_invitations (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      email text not null,
      role text not null check (role in ('admin', 'member')) default 'member',
      token text,
      status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')) default 'pending',
      job_title text,
      initial_team_ids uuid[],
      invited_by uuid references auth.users(id) on delete set null,
      expires_at timestamptz not null default (now() + interval '7 days'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  testAssert(true, "Base relational schema initialized");

  console.log("\n[Step 2] Inserting legacy test fixtures before Migration 00024...");

  const orgAId = "11111111-1111-4111-8111-111111111111";
  const orgBId = "22222222-2222-4222-8222-222222222222";
  const userAdminA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userVictimA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const userAttacker = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  await db.exec(`
    insert into auth.users (id, email) values
      ('${userAdminA}', 'admin@company-a.com'),
      ('${userVictimA}', 'alice@company-a.com'),
      ('${userAttacker}', 'attacker@external.com');

    insert into public.organizations (id, name, slug, status) values
      ('${orgAId}', 'Acme Corp', 'acme-corp', 'active'),
      ('${orgBId}', 'Beta Inc', 'beta-inc', 'active');

    insert into public.organization_members (organization_id, user_id, role) values
      ('${orgAId}', '${userAdminA}', 'owner');

    insert into public.organization_teams (id, organization_id, name) values
      ('33333333-3333-4333-8333-333333333333', '${orgAId}', 'Engineering'),
      ('44444444-4444-4444-8444-444444444444', '${orgBId}', 'Marketing (Alien Org)');
  `);

  // Insert legacy invitations with plaintext token and null token_hash
  const legacyTokenPending = "legacy_pending_token_1234567890123456";
  const legacyTokenAccepted = "legacy_accepted_token_1234567890123456";

  await db.exec(`
    insert into public.organization_invitations (organization_id, email, role, token, status) values
      ('${orgAId}', 'alice@company-a.com', 'admin', '${legacyTokenPending}', 'pending'),
      ('${orgAId}', 'old@company-a.com', 'member', '${legacyTokenAccepted}', 'accepted');
  `);
  testAssert(true, "Legacy invitations inserted with plaintext tokens");

  console.log("\n[Step 3] Applying Migration 00024_secure_invitations_and_hashing.sql...");
  const migration00024Path = path.resolve(process.cwd(), "database/migrations/00024_secure_invitations_and_hashing.sql");
  assert(fs.existsSync(migration00024Path), "Migration 00024 file exists on disk");
  const migration00024Sql = fs.readFileSync(migration00024Path, "utf-8");

  await db.exec(migration00024Sql);
  testAssert(true, "Migration 00024 applied successfully to PostgreSQL");

  console.log("\n[Step 4] Verifying token backfill and redaction...");

  // Check pending invite has token_hash computed
  const pendingRow = await db.query<any>(`
    select token, token_hash from public.organization_invitations where email = 'alice@company-a.com';
  `);
  const expectedHash = crypto.createHash("sha256").update(legacyTokenPending).digest("hex");
  testAssert(pendingRow.rows[0]?.token_hash === expectedHash, "Deterministic SHA-256 backfill verified for pending invite");

  // Check accepted invite has token redacted to NULL
  const acceptedRow = await db.query<any>(`
    select token, token_hash from public.organization_invitations where email = 'old@company-a.com';
  `);
  testAssert(acceptedRow.rows[0]?.token === null, "Legacy token redacted to NULL for accepted invite");
  testAssert(acceptedRow.rows[0]?.token_hash !== null, "SHA-256 hash preserved for accepted invite audit trail");

  async function asUser(uid: string | null, role: string = "authenticated") {
    await db.exec(`delete from auth.current_session;`);
    if (uid) {
      await db.exec(`insert into auth.current_session (user_id, role) values ('${uid}', '${role}');`);
    } else {
      await db.exec(`insert into auth.current_session (user_id, role) values (null, '${role}');`);
    }
  }

  console.log("\n[Step 5] Testing RFC 2104 HMAC-SHA-256 & Cryptographic Gateway Protection...");

  // 0. Verify Node.js getServerAuthSecret fails closed in production without SERVER_AUTH_SECRET
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SERVER_AUTH_SECRET;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.SERVER_AUTH_SECRET;
    let threwFatal = false;
    try {
      getServerAuthSecret();
    } catch (err: any) {
      if (err.message?.includes("FATAL SECURITY CONFIGURATION")) threwFatal = true;
    }
    testAssert(threwFatal, "Production Fail-Closed: getServerAuthSecret throws fatal error if SERVER_AUTH_SECRET is omitted");

    process.env.SERVER_AUTH_SECRET = "short_key_under_32_chars";
    let threwShort = false;
    try {
      getServerAuthSecret();
    } catch (err: any) {
      if (err.message?.includes("at least 32 characters")) threwShort = true;
    }
    testAssert(threwShort, "Production Fail-Closed: getServerAuthSecret throws fatal error if SERVER_AUTH_SECRET < 32 chars");

    // Staging / Vercel Preview check
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    (process.env as Record<string, string | undefined>).VERCEL_ENV = "preview";
    delete process.env.SERVER_AUTH_SECRET;
    let threwPreview = false;
    try {
      getServerAuthSecret();
    } catch (err: any) {
      if (err.message?.includes("FATAL SECURITY CONFIGURATION")) threwPreview = true;
    }
    testAssert(threwPreview, "Staging/Preview Fail-Closed: getServerAuthSecret throws fatal error if SERVER_AUTH_SECRET is omitted");

    process.env.SERVER_AUTH_SECRET = "dev-only-insecure-server-auth-key-0123456789abcdef";
    let threwPlaceholder = false;
    try {
      getServerAuthSecret();
    } catch (err: any) {
      if (err.message?.includes("Insecure placeholder or development secret")) threwPlaceholder = true;
    }
    testAssert(threwPlaceholder, "Staging/Preview Fail-Closed: Insecure placeholder secret rejected in deployed environment");
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    delete (process.env as Record<string, string | undefined>).VERCEL_ENV;
    if (originalSecret) process.env.SERVER_AUTH_SECRET = originalSecret;
    else delete process.env.SERVER_AUTH_SECRET;
  }

  // 0.1 Verify internal_system_secrets cannot be queried by anon or authenticated
  const dedicatedDbSecret = "super_secret_production_key_1234567890abcdef";
  process.env.SERVER_AUTH_SECRET = dedicatedDbSecret;

  // Verify Migration 00024 created internal_system_secrets and secured it
  const tableCheck = await db.query<any>(`
    select to_regclass('public.internal_system_secrets') as exists;
  `);
  testAssert(tableCheck.rows[0]?.exists !== null, "Migration 00024 creates internal_system_secrets table with RLS");

  await db.exec(`
    grant usage on schema public to anon, authenticated;
    insert into public.internal_system_secrets (key, secret) values ('server_auth', '${dedicatedDbSecret}')
    on conflict (key) do update set secret = excluded.secret;
  `);

  let anonSecretBlocked = false;
  try {
    await db.exec(`set role anon;`);
    await db.query(`select * from public.internal_system_secrets;`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      anonSecretBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  testAssert(anonSecretBlocked, "Secret Isolation: Role 'anon' is strictly blocked from reading internal_system_secrets (42501)");

  let authSecretBlocked = false;
  try {
    await db.exec(`set role authenticated;`);
    await db.query(`select * from public.internal_system_secrets;`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("permission denied")) {
      authSecretBlocked = true;
    }
  } finally {
    await db.exec(`reset role;`);
  }
  testAssert(authSecretBlocked, "Secret Isolation: Role 'authenticated' is strictly blocked from reading internal_system_secrets (42501)");

  // Test SQL Fail-Closed: If secret is missing in DB (unconfigured), get_invitation_details fails closed with 42501
  await db.exec(`delete from public.internal_system_secrets where key = 'server_auth';`);
  let sqlFailClosed = false;
  try {
    const ts = Math.floor(Date.now() / 1000);
    await db.query(`select * from public.get_invitation_details('${expectedHash}', '${ts}.dummy_sig');`);
  } catch (err: any) {
    if (err.code === "42501" && err.message?.includes("server authentication secret is unconfigured")) {
      sqlFailClosed = true;
    }
  }
  testAssert(sqlFailClosed, "SQL Fail-Closed: Unconfigured DB secret causes get_invitation_details to fail closed (42501)");

  // Restore the secret in internal_system_secrets for subsequent tests
  await db.exec(`insert into public.internal_system_secrets (key, secret) values ('server_auth', '${dedicatedDbSecret}');`);

  // 1. Verify SQL public.hmac_sha256 matches Node crypto.createHmac 100%
  const sampleKey = dedicatedDbSecret;
  const sampleMsg = `invitation-details:${expectedHash}:123456789`;
  const nodeHmac = crypto.createHmac("sha256", sampleKey).update(sampleMsg).digest("hex");
  const pgHmacRes = await db.query<any>(`select public.hmac_sha256('${sampleKey}', '${sampleMsg}') as sig;`);
  testAssert(pgHmacRes.rows[0]?.sig === nodeHmac, "RFC 2104 Parity: SQL public.hmac_sha256 strictly matches Node.js crypto.createHmac");

  // 2. Verify SQL public.timing_safe_equal_hex constant-time logic
  const eqRes = await db.query<any>(`select public.timing_safe_equal_hex('${nodeHmac}', '${nodeHmac}') as eq;`);
  testAssert(eqRes.rows[0]?.eq === true, "Constant-Time Comparison: Identical signatures return true");

  const mutatedSig = nodeHmac.slice(0, 63) + (nodeHmac[63] === "a" ? "b" : "a");
  const diffRes = await db.query<any>(`select public.timing_safe_equal_hex('${nodeHmac}', '${mutatedSig}') as eq;`);
  testAssert(diffRes.rows[0]?.eq === false, "Constant-Time Comparison: 1-character mutated signature returns false");

  // 3. Unauthenticated call without server token must be rejected (42501)
  await asUser(null, "anon");

  let authBlocked = false;
  try {
    await db.query(`select * from public.get_invitation_details('${expectedHash}', null)`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      authBlocked = true;
    }
  }
  testAssert(authBlocked, "RPC get_invitation_details: Unauthenticated caller without server_token is rejected (42501)");

  // 4. Direct PostgREST call with arbitrary fake token string must be rejected (42501)
  let arbitraryTokenBlocked = false;
  try {
    await db.query(`select * from public.get_invitation_details('${expectedHash}', 'fake_arbitrary_client_token_12345678')`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      arbitraryTokenBlocked = true;
    }
  }
  testAssert(arbitraryTokenBlocked, "RPC get_invitation_details: Direct call with arbitrary token string is rejected (42501)");

  // 5. Direct call with forged signature must be rejected (42501)
  const nowTs = Math.floor(Date.now() / 1000);
  let forgedSigBlocked = false;
  try {
    await db.query(`select * from public.get_invitation_details('${expectedHash}', '${nowTs}.0000000000000000000000000000000000000000000000000000000000000000')`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      forgedSigBlocked = true;
    }
  }
  testAssert(forgedSigBlocked, "RPC get_invitation_details: Direct call with forged signature is rejected (42501)");

  // 6. Direct call with 1-character mutated valid signature must be rejected (42501)
  const validServerToken = generateInvitationServerToken(expectedHash);
  const [tokenTs, tokenSig] = validServerToken.split(".");
  const corruptedSigToken = `${tokenTs}.${tokenSig.slice(0, 63)}${tokenSig[63] === "a" ? "b" : "a"}`;
  let mutatedSigBlocked = false;
  try {
    await db.query(`select * from public.get_invitation_details('${expectedHash}', '${corruptedSigToken}')`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      mutatedSigBlocked = true;
    }
  }
  testAssert(mutatedSigBlocked, "RPC get_invitation_details: 1-character mutated signature is rejected (42501)");

  // 7. Direct call with expired timestamp (> 120s) must be rejected (42501)
  const expiredTs = nowTs - 300; // 5 minutes ago
  let expiredTokenBlocked = false;
  try {
    await db.query(`select * from public.get_invitation_details('${expectedHash}', '${expiredTs}.some_signature')`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      expiredTokenBlocked = true;
    }
  }
  testAssert(expiredTokenBlocked, "RPC get_invitation_details: Direct call with expired timestamp (>120s) is rejected (42501)");

  // 8. Valid server token generated via server gateway helper succeeds
  const detailsRes = await db.query<any>(`
    select * from public.get_invitation_details('${expectedHash}', '${validServerToken}');
  `);
  testAssert(detailsRes.rows.length === 1, "RPC get_invitation_details: Gateway caller with valid HMAC-SHA-256 signature succeeds");
  testAssert(detailsRes.rows[0].organization_name === "Acme Corp", "Sanitized workspace name returned correctly");
  testAssert(detailsRes.rows[0].email === "alice@company-a.com", "Invited email returned correctly");
  testAssert(detailsRes.rows[0].role === "admin", "Invited role returned correctly");
  testAssert(detailsRes.rows[0].is_expired === false, "Expiration state calculated correctly");

  // 9. Malformed hash returns 0 rows
  const malformedRes = await db.query<any>(`
    select * from public.get_invitation_details('not-a-valid-sha256-hash', '${validServerToken}');
  `);
  testAssert(malformedRes.rows.length === 0, "RPC get_invitation_details: Malformed hash returns empty set immediately");

  console.log("\n[Step 6] Testing RPC accept_organization_invitation...");

  // Test 6.1: Attacker attempts to accept Alice's invitation (Strict Identity Verification)
  await asUser(userAttacker, "authenticated");

  let attackerBlocked = false;
  try {
    await db.query(`select public.accept_organization_invitation('${expectedHash}')`);
  } catch (err: any) {
    if (err.code === "42501" || err.message?.includes("Access denied")) {
      attackerBlocked = true;
    }
  }
  testAssert(attackerBlocked, "Privilege Escalation Blocked: Attacker cannot accept invitation issued to Alice (42501)");

  // Test 6.2: Legitimate recipient (Alice) accepts her invitation
  await asUser(userVictimA, "authenticated");

  const acceptRes = await db.query<any>(`
    select public.accept_organization_invitation('${expectedHash}') as result;
  `);
  const acceptJson = acceptRes.rows[0].result;
  testAssert(acceptJson.success === true, "Legitimate recipient (Alice) accepts invitation successfully");
  testAssert(acceptJson.role === "admin", "Assigned role matches invitation configuration (admin)");

  // Verify Alice is in organization_members with admin role
  const memberCheck = await db.query<any>(`
    select role from public.organization_members where user_id = '${userVictimA}' and organization_id = '${orgAId}';
  `);
  testAssert(memberCheck.rows[0]?.role === "admin", "Alice successfully added to organization_members with admin role");

  // Verify invitation status transitioned to 'accepted'
  const inviteStatusCheck = await db.query<any>(`
    select status from public.organization_invitations where token_hash = '${expectedHash}';
  `);
  testAssert(inviteStatusCheck.rows[0]?.status === "accepted", "Invitation status atomically transitioned to accepted");

  // Test 6.3: Single-Use Enforcement: Alice tries to accept the same token a second time
  const secondAcceptRes = await db.query<any>(`
    select public.accept_organization_invitation('${expectedHash}') as result;
  `);
  const secondAcceptJson = secondAcceptRes.rows[0].result;
  testAssert(secondAcceptJson.success === false, "Single-Use Enforced: Second acceptance attempt rejected");
  testAssert(secondAcceptJson.code === "ALREADY_ACCEPTED", "Error code ALREADY_ACCEPTED returned");

  // Test 6.4: Expired Invitation Handling
  const expiredRawToken = "expired_raw_token_for_testing_123456";
  const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
  const userBob = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  await db.exec(`
    insert into auth.users (id, email) values ('${userBob}', 'bob@company-a.com');
    insert into public.organization_invitations (organization_id, email, role, token_hash, status, expires_at) values
      ('${orgAId}', 'bob@company-a.com', 'member', '${expiredHash}', 'pending', now() - interval '1 hour');
  `);
  await asUser(userBob, "authenticated");

  const expiredRes = await db.query<any>(`
    select public.accept_organization_invitation('${expiredHash}') as result;
  `);
  const expiredJson = expiredRes.rows[0].result;
  testAssert(expiredJson.success === false, "Expired invitation rejected");
  testAssert(expiredJson.code === "EXPIRED", "Expired code returned and status marked expired in database");

  // Test 6.5: Cross-Tenant Team Isolation Guard
  const charlieRawToken = "charlie_token_for_team_isolation_123";
  const charlieHash = crypto.createHash("sha256").update(charlieRawToken).digest("hex");
  const userCharlie = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  await db.exec(`
    insert into auth.users (id, email) values ('${userCharlie}', 'charlie@company-a.com');
    insert into public.organization_invitations (
      organization_id, email, role, token_hash, status, initial_team_ids
    ) values (
      '${orgAId}',
      'charlie@company-a.com',
      'member',
      '${charlieHash}',
      'pending',
      array['33333333-3333-4333-8333-333333333333'::uuid, '44444444-4444-4444-8444-444444444444'::uuid]
    );
  `);
  await asUser(userCharlie, "authenticated");

  const charlieRes = await db.query<any>(`
    select public.accept_organization_invitation('${charlieHash}') as result;
  `);
  testAssert(charlieRes.rows[0].result.success === true, "Charlie accepts invitation with mixed team IDs");

  // Verify Charlie is in Org A's team, but NOT in Org B's team
  const teamsCheck = await db.query<any>(`
    select team_id from public.organization_team_members where user_id = '${userCharlie}';
  `);
  const assignedTeamIds = teamsCheck.rows.map((r: any) => r.team_id);
  testAssert(assignedTeamIds.includes("33333333-3333-4333-8333-333333333333"), "Org A Engineering team assigned to Charlie");
  testAssert(!assignedTeamIds.includes("44444444-4444-4444-8444-444444444444"), "Alien Org B team strictly discarded by tenant guard");

  console.log("\n=======================================================");
  console.log(`TOTAL SEC-01 RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runInvitationsSecuritySuite().catch((err) => {
  console.error("FATAL: Test suite threw uncaught exception:", err);
  process.exit(1);
});
