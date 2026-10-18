/**
 * BusinessBrain — SEC-01 Multi-Connection PostgreSQL Concurrency Test
 * 
 * Verifies that concurrent acceptance attempts using independent TCP connections
 * to a real PostgreSQL instance are serialized safely by pessimistic row locking
 * (SELECT ... FOR UPDATE) inside public.accept_organization_invitation.
 * 
 * Requirements:
 * - Requires a running PostgreSQL instance (e.g. local Supabase or Docker Postgres).
 * - Run with:
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres" npx tsx scripts/test-real-postgres-concurrency.ts
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("\n=================================================================");
  console.log("BUSINESSBRAIN — REAL POSTGRESQL MULTI-CONNECTION CONCURRENCY TEST");
  console.log("=================================================================\n");

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    console.warn("⚠️  DATABASE_URL environment variable is not defined.\n");
    console.log("WHY REAL POSTGRESQL IS REQUIRED FOR CONCURRENCY VALIDATION:");
    console.log("------------------------------------------------------------");
    console.log("1. In-memory WASM SQL engines (like PGlite) run single-threaded in");
    console.log("   the Node.js process and execute async queries cooperatively.");
    console.log("2. Real concurrency validation requires distinct physical TCP socket");
    console.log("   connections, independent server-side Postgres backends, and genuine");
    console.log("   row-level pessimistic locks (SELECT ... FOR UPDATE) under load.\n");
    console.log("HOW TO RUN THIS TEST LOCALLY:");
    console.log("-----------------------------");
    console.log("1. Start a local PostgreSQL instance (Supabase CLI or Docker):");
    console.log("     supabase start");
    console.log("   OR:");
    console.log("     docker run --name pg-test -e POSTGRES_PASSWORD=postgres -p 54322:5432 -d postgres:16\n");
    console.log("2. Execute this test suite with DATABASE_URL:");
    console.log("     DATABASE_URL=\"postgresql://postgres:postgres@localhost:54322/postgres\" npx tsx scripts/test-real-postgres-concurrency.ts\n");
    console.log("EXPECTED VERIFICATION RESULTS:");
    console.log("------------------------------");
    console.log("• Spawns 10 parallel connections calling accept_organization_invitation simultaneously.");
    console.log("• Exactly 1 connection succeeds (success: true).");
    console.log("• Exactly 9 connections are rejected with ALREADY_ACCEPTED or 42501.");
    console.log("• Database table organization_members contains strictly 1 record for the accepted user.");
    console.log("• Invitation status is strictly 'accepted'.\n");
    process.exit(0);
  }

  let Pool: any;
  try {
    const pgPackage = "pg";
    // @ts-ignore - Optional dependency for live PostgreSQL concurrency verification
    const pgModule = await import(pgPackage);
    Pool = pgModule.Pool || pgModule.default?.Pool;
  } catch {
    console.error("❌ 'pg' driver is required to run multi-connection TCP tests against live PostgreSQL.");
    console.log("Install pg locally with: npm install -D pg @types/pg");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log("✓ Connected to live PostgreSQL server:", connectionString.replace(/:[^:@]+@/, ":****@"));
    client.release();
  } catch (connErr: any) {
    console.error("❌ Failed to connect to PostgreSQL:", connErr.message);
    console.log("\nPlease verify that PostgreSQL is running and accessible at the specified URL.");
    process.exit(1);
  }

  try {
    // 1. Setup schema and fixtures
    const setupClient = await pool.connect();
    console.log("\n[Step 1] Applying migration 00024 to live database...");
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "database/migrations/00024_secure_invitations_and_hashing.sql"),
      "utf-8"
    );
    await setupClient.query(migrationSql);

    console.log("[Step 2] Inserting concurrency test workspace and invitation...");
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const email = `concurrency-${Date.now()}@test-org.com`;
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await setupClient.query(`
      insert into public.organizations (id, name, slug, status)
      values ($1, 'Concurrency Test Org', $2, 'active')
      on conflict (id) do nothing;
    `, [orgId, `concurrency-${Date.now()}`]);

    await setupClient.query(`
      insert into auth.users (id, email)
      values ($1, $2)
      on conflict (id) do nothing;
    `, [userId, email]);

    await setupClient.query(`
      insert into public.organization_invitations (organization_id, email, role, token_hash, status, expires_at)
      values ($1, $2, 'member', $3, 'pending', now() + interval '7 days');
    `, [orgId, email, tokenHash]);

    setupClient.release();
    console.log("✓ Fixtures prepared with token_hash:", tokenHash);

    // 2. Launch 10 simultaneous connections firing accept_organization_invitation
    console.log("\n[Step 3] Firing 10 concurrent requests across distinct TCP connections...");
    const CONCURRENCY_LEVEL = 10;

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY_LEVEL }).map(async (_, idx) => {
        const workerClient = await pool.connect();
        try {
          // Set session auth identity
          await workerClient.query(`
            do $$ begin
              perform set_config('request.jwt.claim.sub', '${userId}', true);
            end $$;
          `);

          // Execute acceptance RPC
          const res = await workerClient.query(`
            select public.accept_organization_invitation($1) as result;
          `, [tokenHash]);

          return { worker: idx, result: res.rows[0]?.result };
        } catch (workerErr: any) {
          return { worker: idx, error: workerErr.message };
        } finally {
          workerClient.release();
        }
      })
    );

    console.log("\n[Step 4] Analyzing concurrency execution results:");
    let successCount = 0;
    let rejectedCount = 0;

    results.forEach(({ worker, result, error }) => {
      if (result?.success === true) {
        successCount++;
        console.log(`  Connection ${worker}: ✅ SUCCESS (Accepted invitation)`);
      } else {
        rejectedCount++;
        const reason = result?.code || result?.error || error;
        console.log(`  Connection ${worker}: 🛑 REJECTED (${reason})`);
      }
    });

    // 3. Verify invariants
    console.log("\n[Step 5] Verifying database invariants in live PostgreSQL...");
    const verifyClient = await pool.connect();

    const membersRes = await verifyClient.query(`
      select count(*)::int as count from public.organization_members
      where organization_id = $1 and user_id = $2;
    `, [orgId, userId]);

    const inviteRes = await verifyClient.query(`
      select status from public.organization_invitations
      where organization_id = $1 and token_hash = $2;
    `, [orgId, tokenHash]);

    verifyClient.release();

    const memberCount = membersRes.rows[0]?.count;
    const finalStatus = inviteRes.rows[0]?.status;

    console.log(`  • Successful acceptances: ${successCount} (expected: 1)`);
    console.log(`  • Rejected connections:   ${rejectedCount} (expected: ${CONCURRENCY_LEVEL - 1})`);
    console.log(`  • Final member records:   ${memberCount} (expected: 1)`);
    console.log(`  • Final invitation status: '${finalStatus}' (expected: 'accepted')`);

    if (successCount === 1 && rejectedCount === CONCURRENCY_LEVEL - 1 && memberCount === 1 && finalStatus === "accepted") {
      console.log("\n=======================================================");
      console.log("✅ LIVE POSTGRESQL CONCURRENCY TEST PASSED (ZERO RACE CONDITIONS)");
      console.log("=======================================================\n");
    } else {
      console.error("\n❌ LIVE CONCURRENCY TEST FAILED: Race condition detected.");
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in concurrency test:", err);
  process.exit(1);
});
