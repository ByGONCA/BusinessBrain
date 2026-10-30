/**
 * BusinessBrain — Staging Physical Multi-Connection Concurrency Load Test
 *
 * Requirements:
 * - Executes against a real staging PostgreSQL instance (DATABASE_URL).
 * - Opens 50 simultaneous physical pooled database connections.
 * - Fires 50 concurrent requests against public.reserve_ai_credits_atomic.
 * - Asserts row-level locking (FOR UPDATE) prevents overdraft, race conditions, and deadlocks.
 *
 * Usage:
 *   DATABASE_URL="postgres://postgres:password@localhost:5432/postgres" npx tsx scripts/staging-load-test-concurrency.ts
 */

async function runStagingLoadTest() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.log("-------------------------------------------------------------------------------");
    console.log("STAGING LOAD TEST HARNESS (MULTI-CONNECTION POOL)");
    console.log("-------------------------------------------------------------------------------");
    console.log("INFO: No DATABASE_URL or SUPABASE_DB_URL environment variable provided.");
    console.log("To execute against staging or a dedicated test PostgreSQL server, run:");
    console.log('  DATABASE_URL="postgresql://user:pass@staging-db.supabase.co:5432/postgres" npx tsx scripts/staging-load-test-concurrency.ts');
    console.log("-------------------------------------------------------------------------------");
    process.exit(0);
  }

  let Pool: any;
  try {
    // Dynamic import to avoid missing module in local dev without pg installed
    const pgModule = await import("pg" as any);
    Pool = pgModule.default?.Pool || pgModule.Pool;
  } catch {
    console.error("ERRO: O pacote 'pg' é necessário para o teste de pool físico multi-conexão.");
    console.error("Instale temporariamente para o teste de staging: npm install --no-save pg @types/pg");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL pool with 50 max connections...");
  const pool = new Pool({
    connectionString,
    max: 50,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  try {
    // 1. Setup clean test tenant
    const client = await pool.connect();
    let testOrgId: string;
    let testUserId: string;

    try {
      const orgRes = await client.query(
        "INSERT INTO public.organizations (name, workspace_type) VALUES ('Staging Concurrency Test Org', 'team') RETURNING id"
      );
      testOrgId = orgRes.rows[0].id;

      const userRes = await client.query(
        "INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'concurrency-staging@businessbrain.test') RETURNING id"
      );
      testUserId = userRes.rows[0].id;

      await client.query(
        "INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
        [testOrgId, testUserId]
      );
    } finally {
      client.release();
    }

    console.log(`Created test tenant ${testOrgId}. Firing 50 concurrent requests...`);
    const quota = 50; // Quota: 50 credits (50k tokens)
    const requestCredits = 5; // 5 credits per request -> Max allowed = 10 requests

    const startTime = Date.now();
    const tasks = Array.from({ length: 50 }, async () => {
      const workerClient = await pool.connect();
      try {
        const res = await workerClient.query(
          "SELECT * FROM public.reserve_ai_credits_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [testOrgId, testUserId, null, "general_chat", "gemini", "gemini-2.5-flash", false, requestCredits, quota]
        );
        return { success: true, row: res.rows[0] };
      } catch (err: any) {
        return { success: false, error: err.message };
      } finally {
        workerClient.release();
      }
    });

    const results = await Promise.all(tasks);
    const totalTimeMs = Date.now() - startTime;

    const accepted = results.filter((r) => r.success && r.row?.allowed);
    const rejected = results.filter((r) => r.success && !r.row?.allowed);
    const errors = results.filter((r) => !r.success);

    console.log("===============================================================================");
    console.log("STAGING LOAD TEST RESULTS (50 CONCURRENT WORKERS)");
    console.log("===============================================================================");
    console.log(`Total Time       : ${totalTimeMs}ms`);
    console.log(`Accepted (200)   : ${accepted.length} (Expected: 10)`);
    console.log(`Rejected (429)   : ${rejected.length} (Expected: 40)`);
    console.log(`Driver Errors    : ${errors.length} (Expected: 0)`);

    // Verify DB consistency
    const verifyClient = await pool.connect();
    try {
      const dbCheck = await verifyClient.query(
        "SELECT sum(reserved_credits) as total_locked FROM public.ai_credit_reservations WHERE organization_id = $1 AND status = 'reserved'",
        [testOrgId]
      );
      const totalLocked = Number(dbCheck.rows[0].total_locked);
      console.log(`DB Total Locked  : ${totalLocked} credits (Expected: 50)`);

      if (accepted.length === 10 && rejected.length === 40 && errors.length === 0 && totalLocked === 50) {
        console.log("✅ CERTIFICATION: Strict zero-overdraft row-locking verified under multi-connection load!");
      } else {
        console.error("❌ FAILURE: Invariant breach detected under concurrency!");
        process.exit(1);
      }
    } finally {
      verifyClient.release();
    }
  } finally {
    await pool.end();
  }
}

runStagingLoadTest().catch((err) => {
  console.error("Fatal load test error:", err);
  process.exit(1);
});
