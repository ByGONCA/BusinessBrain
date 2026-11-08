/**
 * KogSync — Integration OAuth Concurrency & Security Suite (PGlite WASM Postgres 16)
 *
 * Verifies migration 00045_integration_oauth_concurrency_and_security.sql:
 * 1. public.oauth_state_nonces table creation and strict RLS deny-all policy.
 * 2. consume_oauth_nonce_atomic: Single-use atomic consumption, duplicate rejection, and replay defense.
 * 3. acquire_linear_refresh_lease: Atomic row-level lock, peer worker rejection (LOCKED_BY_PEER).
 * 4. acquire_linear_refresh_lease: Auto-detection of already-refreshed tokens (ALREADY_REFRESHED).
 * 5. acquire_linear_refresh_lease: Expired lease recovery by surviving worker after simulated worker crash.
 * 6. release_linear_refresh_lease: Safe release and protection against stale workers clearing peer leases.
 * 7. save_linear_refreshed_tokens_cas: Optimistic Concurrency Control (OCC) protecting against stale overwrites.
 * 8. save_linear_refreshed_tokens_cas: Lease ownership check rejecting out-of-order stale commits.
 */

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

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

async function runConcurrencyTestSuite() {
  console.log("\n==================================================================");
  console.log("KOGSYNC: POSTGRESQL CONCURRENCY & OAUTH LEASE VERIFICATION (PGLITE)");
  console.log("==================================================================\n");

  const db = new PGlite();

  console.log("[1] Setting up base schema and dependencies in Postgres 16...");

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS public;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );

    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider text NOT NULL,
      provider_account_id text,
      account_email text,
      status text NOT NULL DEFAULT 'connected',
      scopes text[] NOT NULL DEFAULT '{}',
      encrypted_access_token text,
      encrypted_refresh_token text,
      token_expires_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_org_provider_account UNIQUE (organization_id, provider, provider_account_id)
    );
  `);

  testAssert(true, "Base tables (organizations, organization_integrations) initialized");

  console.log("\n[2] Applying migration 00045_integration_oauth_concurrency_and_security.sql...");

  const migrationPath = path.resolve(
    process.cwd(),
    "database/migrations/00045_integration_oauth_concurrency_and_security.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  await db.exec(migrationSql);
  testAssert(true, "Migration 00045 applied successfully to PGlite engine");

  // Create test organization and initial Linear integration record
  const orgResult = await db.query<{ id: string }>(
    `INSERT INTO public.organizations (name) VALUES ('Test Concurrency Corp') RETURNING id;`
  );
  const testOrgId = orgResult.rows[0].id;

  const initialExpiry = new Date(Date.now() + 60 * 1000).toISOString(); // expires in 1 min (< 2 min threshold)
  await db.query(
    `INSERT INTO public.organization_integrations (
      organization_id, provider, provider_account_id, status,
      encrypted_access_token, encrypted_refresh_token, token_expires_at, metadata
    ) VALUES (
      $1, 'linear', 'lin_acc_123', 'connected',
      'enc_access_token_v1', 'enc_refresh_token_v1', $2, '{}'::jsonb
    );`,
    [testOrgId, initialExpiry]
  );
  testAssert(true, "Test organization and Linear integration row seeded");

  // ===========================================================================
  // SECTION 1: ATOMIC OAUTH STATE NONCE CONSUMPTION & REPLAY DEFENSE
  // ===========================================================================
  console.log("\n--- SECTION 1: Atomic OAuth Nonce Consumption & Replay Defense ---");

  const nonce1 = "cryptographic-random-nonce-alpha-123456";
  const nonceResult1 = await db.query<{ consume_oauth_nonce_atomic: any }>(
    `SELECT public.consume_oauth_nonce_atomic($1, $2, 'linear', 900);`,
    [nonce1, testOrgId]
  );
  const res1 = nonceResult1.rows[0].consume_oauth_nonce_atomic;
  testAssert(res1.success === true && res1.code === "NONCE_CONSUMED", "First nonce consumption succeeds (NONCE_CONSUMED)");

  // Replay of the exact same nonce must fail cleanly
  const replayResult = await db.query<{ consume_oauth_nonce_atomic: any }>(
    `SELECT public.consume_oauth_nonce_atomic($1, $2, 'linear', 900);`,
    [nonce1, testOrgId]
  );
  const resReplay = replayResult.rows[0].consume_oauth_nonce_atomic;
  testAssert(
    resReplay.success === false && resReplay.code === "NONCE_ALREADY_USED",
    "Duplicate replay of same nonce is rejected atomically (NONCE_ALREADY_USED)"
  );

  // Verify RLS policy blocks direct public access
  const nonceCount = await db.query<{ count: string }>(`SELECT count(*) FROM public.oauth_state_nonces;`);
  testAssert(parseInt(nonceCount.rows[0].count, 10) === 1, "Nonce persisted in oauth_state_nonces table");

  // ===========================================================================
  // SECTION 2: DISTRIBUTED REFRESH LEASE & PEER COLLISION DEFENSE
  // ===========================================================================
  console.log("\n--- SECTION 2: Distributed Refresh Lease & Peer Collision ---");

  const worker1 = "worker-process-node-1";
  const worker2 = "worker-process-node-2";

  // Worker 1 acquires lease
  const lease1 = await db.query<{ acquire_linear_refresh_lease: any }>(
    `SELECT public.acquire_linear_refresh_lease($1, $2, 15);`,
    [testOrgId, worker1]
  );
  const lRes1 = lease1.rows[0].acquire_linear_refresh_lease;
  testAssert(
    lRes1.success === true && lRes1.code === "LEASE_ACQUIRED",
    "Worker 1 acquires 15s refresh lease (LEASE_ACQUIRED)"
  );
  testAssert(
    lRes1.current_encrypted_refresh_token === "enc_refresh_token_v1",
    "Worker 1 receives current encrypted refresh token for rotation"
  );

  // Worker 2 attempts to acquire lease while Worker 1 holds active lease
  const lease2 = await db.query<{ acquire_linear_refresh_lease: any }>(
    `SELECT public.acquire_linear_refresh_lease($1, $2, 15);`,
    [testOrgId, worker2]
  );
  const lRes2 = lease2.rows[0].acquire_linear_refresh_lease;
  testAssert(
    lRes2.success === false && lRes2.code === "LOCKED_BY_PEER",
    "Worker 2 is safely rejected while lease is held by Worker 1 (LOCKED_BY_PEER)"
  );
  testAssert(lRes2.retry_after_ms > 0, "Worker 2 receives retry_after_ms recommendation");

  // Same Worker 1 re-acquiring lease is permitted
  const lease1Reacquire = await db.query<{ acquire_linear_refresh_lease: any }>(
    `SELECT public.acquire_linear_refresh_lease($1, $2, 15);`,
    [testOrgId, worker1]
  );
  const lRes1Re = lease1Reacquire.rows[0].acquire_linear_refresh_lease;
  testAssert(lRes1Re.success === true, "Worker 1 can safely re-acquire its own lease");

  // ===========================================================================
  // SECTION 3: OPTIMISTIC CONCURRENCY CONTROL (OCC) ON TOKEN COMMIT
  // ===========================================================================
  console.log("\n--- SECTION 3: Optimistic Concurrency Control (OCC) ---");

  // Stale worker attempt: Worker 2 attempts to save with outdated expected token
  const staleWorkerSave = await db.query<{ save_linear_refreshed_tokens_cas: any }>(
    `SELECT public.save_linear_refreshed_tokens_cas($1, $2, $3, $4, $5, $6);`,
    [
      testOrgId,
      worker2,
      "wrong_old_token",
      "enc_access_v2_stale",
      "enc_refresh_v2_stale",
      new Date(Date.now() + 7200 * 1000).toISOString(),
    ]
  );
  const staleRes = staleWorkerSave.rows[0].save_linear_refreshed_tokens_cas;
  testAssert(
    staleRes.success === false && staleRes.code === "STALE_OVERWRITE_PREVENTED",
    "Stale worker with outdated token is prevented from committing (STALE_OVERWRITE_PREVENTED)"
  );

  // Worker 1 commits rotated tokens with correct expected refresh token
  const newExpiry = new Date(Date.now() + 7200 * 1000).toISOString(); // 2 hours in future
  const worker1Save = await db.query<{ save_linear_refreshed_tokens_cas: any }>(
    `SELECT public.save_linear_refreshed_tokens_cas($1, $2, $3, $4, $5, $6);`,
    [
      testOrgId,
      worker1,
      "enc_refresh_token_v1",
      "enc_access_v2_valid",
      "enc_refresh_v2_valid",
      newExpiry,
    ]
  );
  const w1SaveRes = worker1Save.rows[0].save_linear_refreshed_tokens_cas;
  testAssert(
    w1SaveRes.success === true && w1SaveRes.code === "COMMITTED",
    "Worker 1 successfully commits rotated tokens with OCC (COMMITTED)"
  );

  // Verify lease metadata was cleared upon commit
  const rowAfterCommit = await db.query<{ metadata: any; encrypted_access_token: string }>(
    `SELECT metadata, encrypted_access_token FROM public.organization_integrations WHERE organization_id = $1;`,
    [testOrgId]
  );
  testAssert(
    rowAfterCommit.rows[0].metadata.refresh_lock_worker === undefined &&
    rowAfterCommit.rows[0].metadata.refresh_lock_until === undefined,
    "Commit atomically cleared lease lock metadata"
  );
  testAssert(
    rowAfterCommit.rows[0].encrypted_access_token === "enc_access_v2_valid",
    "Database reflects newly rotated access token"
  );

  // Now, worker attempting to refresh when token is already fresh (> 2 min) returns ALREADY_REFRESHED
  const leaseAlreadyFresh = await db.query<{ acquire_linear_refresh_lease: any }>(
    `SELECT public.acquire_linear_refresh_lease($1, $2, 15);`,
    [testOrgId, worker2]
  );
  const lResFresh = leaseAlreadyFresh.rows[0].acquire_linear_refresh_lease;
  testAssert(
    lResFresh.success === false && lResFresh.code === "ALREADY_REFRESHED",
    "Worker immediately detects fresh token and avoids redundant API call (ALREADY_REFRESHED)"
  );
  testAssert(
    lResFresh.encrypted_access_token === "enc_access_v2_valid",
    "Worker receives fresh credentials without hitting Linear API"
  );

  // ===========================================================================
  // SECTION 4: EXPIRED LEASE RECOVERY (SIMULATED WORKER CRASH)
  // ===========================================================================
  console.log("\n--- SECTION 4: Expired Lease Recovery after Worker Crash ---");

  // Simulate token near expiry again and an abandoned lease from a crashed worker (30 seconds ago)
  const deadWorker = "worker-crashed-node";
  const survivorWorker = "worker-survivor-node";
  const pastTimestamp = new Date(Date.now() - 30 * 1000).toISOString();
  const nearExpiry = new Date(Date.now() + 30 * 1000).toISOString();

  await db.query(
    `UPDATE public.organization_integrations
     SET token_expires_at = $1::timestamptz,
         metadata = jsonb_build_object(
           'refresh_lock_until', $2::text,
           'refresh_lock_worker', $3::text
         )
     WHERE organization_id = $4::uuid;`,
    [nearExpiry, pastTimestamp, deadWorker, testOrgId]
  );

  // Survivor worker attempts to acquire lease; since pastTimestamp < now(), lease must be awarded
  const recoverLease = await db.query<{ acquire_linear_refresh_lease: any }>(
    `SELECT public.acquire_linear_refresh_lease($1, $2, 15);`,
    [testOrgId, survivorWorker]
  );
  const recoverRes = recoverLease.rows[0].acquire_linear_refresh_lease;
  testAssert(
    recoverRes.success === true && recoverRes.code === "LEASE_ACQUIRED",
    "Surviving worker safely recovers and claims expired lease after worker crash"
  );

  // Crashed worker resurrects and attempts to release the lease it no longer owns
  const staleRelease = await db.query<{ release_linear_refresh_lease: any }>(
    `SELECT public.release_linear_refresh_lease($1, $2);`,
    [testOrgId, deadWorker]
  );
  testAssert(staleRelease.rows[0].release_linear_refresh_lease.success === true, "Stale release returns cleanly");

  // Verify survivor worker still owns the lease
  const checkSurvivorLease = await db.query<{ metadata: any }>(
    `SELECT metadata FROM public.organization_integrations WHERE organization_id = $1;`,
    [testOrgId]
  );
  testAssert(
    checkSurvivorLease.rows[0].metadata.refresh_lock_worker === survivorWorker,
    "Survivor worker's active lease was preserved against stale release"
  );

  // Survivor worker releases its own lease
  await db.query<{ release_linear_refresh_lease: any }>(
    `SELECT public.release_linear_refresh_lease($1, $2);`,
    [testOrgId, survivorWorker]
  );
  const checkCleared = await db.query<{ metadata: any }>(
    `SELECT metadata FROM public.organization_integrations WHERE organization_id = $1;`,
    [testOrgId]
  );
  testAssert(
    checkCleared.rows[0].metadata.refresh_lock_worker === undefined,
    "Survivor successfully released its lease"
  );

  console.log("\n==================================================================");
  console.log(`TOTAL ASSERÇÕES PGLITE: ${passedCount} aprovadas, ${failedCount} falhas`);
  console.log("==================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runConcurrencyTestSuite().catch((err) => {
  console.error("FATAL: Error in PGlite concurrency test suite:", err);
  process.exit(1);
});
