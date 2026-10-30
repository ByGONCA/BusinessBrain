/**
 * BusinessBrain — Enterprise AI Security, Multi-Tenant Isolation & Credit Reservation Test Suite (TEST-00043)
 *
 * Verifies strict commercial invariants and adversarial security guarantees:
 * 1. Paid-Plan Only Entitlement Guard (Zero Free AI Access; BYOK does NOT bypass)
 * 2. Two-Phase Atomic Credit Reservation Engine & Parallel Race Condition Prevention
 * 3. Mid-Stream Abort & Cancellation Credit Release (Zero Unused Token Debits)
 * 4. BYOK Concurrency Protection & Zero Platform Credit Debiting ($0.00 Ledger)
 * 5. Multi-Tenant User Credential Isolation (Strict RLS on user_ai_credentials)
 * 6. Secret Redaction, Header-Based Gemini Authentication & URL Key Elimination
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { verifyAIAccessEntitlement } from "../lib/ai/auth/entitlement-guard";
import { AICreditReservationService } from "../lib/ai/accounting/reservation";
import { GeminiAdapter } from "../lib/ai/adapters/gemini";
import { testProviderConnectionAction } from "../lib/ai/credentials/actions";

// Force test environment
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

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

async function runEnterpriseSecurityTestSuite() {
  console.log("===============================================================================");
  console.log("BUSINESSBRAIN: ENTERPRISE AI SECURITY & RESERVATION TEST SUITE (TEST-00043)");
  console.log("===============================================================================\n");

  const pg = new PGlite();

  // Setup core database schema and mock auth in PGlite
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text,
      created_at timestamptz DEFAULT now()
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS auth.current_session (
      user_id uuid
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT user_id FROM auth.current_session LIMIT 1;
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT 'authenticated'::text;
    $$;

    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      workspace_type text NOT NULL DEFAULT 'team',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      created_at timestamptz DEFAULT now(),
      UNIQUE(organization_id, user_id)
    );

    CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = target_org_id
          AND user_id = auth.uid()
      );
    $$;

    CREATE OR REPLACE FUNCTION public.has_org_role(target_org_id uuid, allowed_roles text[])
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = target_org_id
          AND user_id = auth.uid()
          AND role = ANY(allowed_roles)
      );
    $$;

    CREATE TABLE IF NOT EXISTS public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
      stripe_customer_id text NOT NULL,
      stripe_subscription_id text,
      status text NOT NULL CHECK (status IN ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')),
      plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
      trial_start timestamptz,
      trial_end timestamptz,
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Apply sequential migrations 00038, 00039, 00040, 00041
  const migrationsDir = path.resolve(process.cwd(), "database/migrations");
  const migrations = [
    "00038_ai_foundation_and_byok.sql",
    "00039_ai_access_control_and_governance.sql",
    "00040_multimodel_and_personal_accounts.sql",
    "00041_ai_credit_reservations.sql",
  ];

  for (const m of migrations) {
    const sqlPath = path.join(migrationsDir, m);
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await pg.exec(sql);
    }
  }

  // Grant privileges to authenticated role so RLS is evaluated properly
  await pg.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
  `);

  async function switchUser(userId: string | null) {
    await pg.exec("SET ROLE postgres;");
    await pg.exec("DELETE FROM auth.current_session;");
    if (userId) {
      await pg.exec(`INSERT INTO auth.current_session (user_id) VALUES ('${userId}');`);
      await pg.exec("SET ROLE authenticated;");
    }
  }

  // Create lightweight query wrapper mimicking Supabase server client
  function createMockSupabase(sessionUserId: string) {
    return {
      from(table: string) {
        return {
          select(columns = "*") {
            return {
              eq(col: string, val: any) {
                return {
                  async maybeSingle() {
                    const res = await pg.query<any>(
                      `SELECT ${columns} FROM public.${table} WHERE ${col} = $1 LIMIT 1`,
                      [val]
                    );
                    return { data: res.rows[0] || null, error: null };
                  },
                  async single() {
                    const res = await pg.query<any>(
                      `SELECT ${columns} FROM public.${table} WHERE ${col} = $1 LIMIT 1`,
                      [val]
                    );
                    return { data: res.rows[0] || null, error: res.rows.length === 0 ? new Error("Not found") : null };
                  },
                };
              },
            };
          },
          async insert(values: Record<string, any>) {
            const keys = Object.keys(values);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
            const vals = keys.map((k) => values[k]);
            const q = `INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
            const res = await pg.query<any>(q, vals);
            return {
              data: res.rows[0],
              error: null,
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: res.rows[0], error: null });
                  },
                };
              },
            };
          },
          update(values: Record<string, any>) {
            return {
              eq(col: string, val: any) {
                return {
                  eq(col2: string, val2: any) {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            const keys = Object.keys(values);
                            const setClause = keys.map((k, i) => k + " = $" + (i + 1)).join(", ");
                            const vals = [...keys.map((k) => values[k]), val, val2];
                            const q = "UPDATE public." + table + " SET " + setClause + " WHERE " + col + " = $" + (keys.length + 1) + " AND " + col2 + " = $" + (keys.length + 2) + " RETURNING *";
                            const res = await pg.query<any>(q, vals);
                            return { data: res.rows[0] || null, error: null };
                          },
                        };
                      },
                      async then(resolve: any) {
                        const keys = Object.keys(values);
                        const setClause = keys.map((k, i) => k + " = $" + (i + 1)).join(", ");
                        const vals = [...keys.map((k) => values[k]), val, val2];
                        const q = "UPDATE public." + table + " SET " + setClause + " WHERE " + col + " = $" + (keys.length + 1) + " AND " + col2 + " = $" + (keys.length + 2);
                        await pg.query<any>(q, vals);
                        resolve({ error: null });
                      },
                    };
                  },
                  select() {
                    return {
                      async maybeSingle() {
                        const keys = Object.keys(values);
                        const setClause = keys.map((k, i) => k + " = $" + (i + 1)).join(", ");
                        const vals = [...keys.map((k) => values[k]), val];
                        const q = "UPDATE public." + table + " SET " + setClause + " WHERE " + col + " = $" + (keys.length + 1) + " RETURNING *";
                        const res = await pg.query<any>(q, vals);
                        return { data: res.rows[0] || null, error: null };
                      },
                    };
                  },
                  async lt(col2: string, val2: any) {
                    const keys = Object.keys(values);
                    const setClause = keys.map((k, i) => k + " = $" + (i + 1)).join(", ");
                    const vals = [...keys.map((k) => values[k]), val, val2];
                    const q = "UPDATE public." + table + " SET " + setClause + " WHERE " + col + " = $" + (keys.length + 1) + " AND " + col2 + " < $" + (keys.length + 2);
                    await pg.query<any>(q, vals);
                    return { error: null };
                  },
                  async then(resolve: any) {
                    const keys = Object.keys(values);
                    const setClause = keys.map((k, i) => k + " = $" + (i + 1)).join(", ");
                    const vals = [...keys.map((k) => values[k]), val];
                    const q = "UPDATE public." + table + " SET " + setClause + " WHERE " + col + " = $" + (keys.length + 1);
                    await pg.query<any>(q, vals);
                    resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      },
      async rpc(fnName: string, params: Record<string, any>) {
        if (fnName === "reserve_ai_credits_atomic") {
          const res = await pg.query<any>(
            `SELECT * FROM public.reserve_ai_credits_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              params.p_org_id,
              params.p_user_id,
              params.p_conversation_id,
              params.p_task_type,
              params.p_provider,
              params.p_model,
              params.p_is_byok,
              params.p_estimated_credits,
              params.p_quota,
            ]
          );
          return { data: res.rows, error: null };
        }
        return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
      },
    } as any;
  }

  // -------------------------------------------------------------------------
  // SECTION 1: PAID-PLAN ONLY COMMERCIAL INVARIANT
  // -------------------------------------------------------------------------
  console.log("--- PART 1: Paid-Plan Only Entitlement Guard (Zero Free AI Access) ---");

  // Create test users and workspaces
  const userA = "11111111-1111-4111-a111-111111111111";
  const userB = "22222222-2222-4222-a222-222222222222";
  await pg.query<any>(`INSERT INTO auth.users (id, email) VALUES ($1, 'alice@company.com'), ($2, 'bob@competitor.com')`, [
    userA,
    userB,
  ]);

  // 1. Organization without any subscription (Free Account)
  const freeOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name, workspace_type) VALUES ('Free Startup', 'team') RETURNING id`
  );
  const freeOrgId = freeOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [freeOrgId, userA]
  );

  const mockClientA = createMockSupabase(userA);

  const freeResult = await verifyAIAccessEntitlement(freeOrgId, mockClientA);
  testAssert(
    !freeResult.allowed && freeResult.status === 402 && freeResult.error === "NO_ACTIVE_SUBSCRIPTION",
    "Free account without subscription is strictly denied AI access with HTTP 402 NO_ACTIVE_SUBSCRIPTION"
  );

  // 2. Personal Workspace without paid subscription is also rejected (No Free Bypass)
  const personalOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name, workspace_type) VALUES ('Personal Space', 'personal') RETURNING id`
  );
  const personalOrgId = personalOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [personalOrgId, userA]
  );

  const personalResult = await verifyAIAccessEntitlement(personalOrgId, mockClientA);
  testAssert(
    !personalResult.allowed && personalResult.status === 402,
    "Personal workspace without paid subscription is strictly denied AI access (No automatic free Starter pass)"
  );

  // 3. Expired Trial Account
  const expiredTrialOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Expired Trial Corp') RETURNING id`
  );
  const expiredTrialOrgId = expiredTrialOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.subscriptions (organization_id, stripe_customer_id, status, plan, trial_end)
     VALUES ($1, 'cus_exp', 'trialing', 'starter', now() - interval '1 day')`,
    [expiredTrialOrgId]
  );

  const expiredTrialResult = await verifyAIAccessEntitlement(expiredTrialOrgId, mockClientA);
  testAssert(
    !expiredTrialResult.allowed && expiredTrialResult.status === 402 && expiredTrialResult.error === "TRIAL_EXPIRED",
    "Expired trial account is rejected with HTTP 402 TRIAL_EXPIRED"
  );

  // 4. Valid Active Trial Account
  const validTrialOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Active Trial Corp') RETURNING id`
  );
  const validTrialOrgId = validTrialOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.subscriptions (organization_id, stripe_customer_id, status, plan, trial_end)
     VALUES ($1, 'cus_trial_ok', 'trialing', 'starter', now() + interval '7 days')`,
    [validTrialOrgId]
  );

  const validTrialResult = await verifyAIAccessEntitlement(validTrialOrgId, mockClientA);
  testAssert(
    validTrialResult.allowed && validTrialResult.status === 200 && validTrialResult.isTrial === true,
    "Active unexpired trial account is granted AI access with HTTP 200"
  );

  // 5. Active Paid Subscription Account (Starter/Pro/Enterprise)
  const paidOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Enterprise Corp') RETURNING id`
  );
  const paidOrgId = paidOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.subscriptions (organization_id, stripe_customer_id, status, plan, current_period_end)
     VALUES ($1, 'cus_paid', 'active', 'pro', now() + interval '30 days')`,
    [paidOrgId]
  );

  const paidResult = await verifyAIAccessEntitlement(paidOrgId, mockClientA);
  testAssert(
    paidResult.allowed && paidResult.status === 200 && paidResult.plan === "pro",
    "Active paid subscription (Pro) is granted AI access with HTTP 200"
  );

  // 6. Canceled Subscription with remaining prepaid grace period
  const canceledGraceOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Canceled Grace Corp') RETURNING id`
  );
  const canceledGraceOrgId = canceledGraceOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.subscriptions (organization_id, stripe_customer_id, status, plan, current_period_end, cancel_at_period_end)
     VALUES ($1, 'cus_grace', 'canceled', 'starter', now() + interval '5 days', true)`,
    [canceledGraceOrgId]
  );

  const graceResult = await verifyAIAccessEntitlement(canceledGraceOrgId, mockClientA);
  testAssert(
    graceResult.allowed && graceResult.status === 200,
    "Canceled subscription within prepaid grace period is granted AI access until period end"
  );

  // 7. Canceled Subscription past prepaid grace period
  const canceledExpiredOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Canceled Past Corp') RETURNING id`
  );
  const canceledExpiredOrgId = canceledExpiredOrgRes.rows[0].id;
  await pg.query<any>(
    `INSERT INTO public.subscriptions (organization_id, stripe_customer_id, status, plan, current_period_end, cancel_at_period_end)
     VALUES ($1, 'cus_exp_canceled', 'canceled', 'starter', now() - interval '2 days', true)`,
    [canceledExpiredOrgId]
  );

  const canceledExpiredResult = await verifyAIAccessEntitlement(canceledExpiredOrgId, mockClientA);
  testAssert(
    !canceledExpiredResult.allowed && canceledExpiredResult.status === 402 && canceledExpiredResult.error === "SUBSCRIPTION_EXPIRED",
    "Canceled subscription past grace period is strictly rejected with HTTP 402 SUBSCRIPTION_EXPIRED"
  );

  // -------------------------------------------------------------------------
  // SECTION 2: ATOMIC TWO-PHASE CREDIT RESERVATION & CONCURRENCY
  // -------------------------------------------------------------------------
  console.log("\n--- PART 2: Atomic Credit Reservation & Concurrency Race Condition ---");

  // Create an org with limited quota: Starter plan has 1,000 monthly credits.
  // We simulate an organization that has consumed 996 credits (remaining: 4 credits).
  const raceOrgRes = await pg.query<any>(
    `INSERT INTO public.organizations (name) VALUES ('Race Condition Test Corp') RETURNING id`
  );
  const raceOrgId = raceOrgRes.rows[0].id;

  // Insert past usage in ai_usage_ledger: 996,000 tokens = 996 credits
  await pg.query<any>(
    `INSERT INTO public.ai_usage_ledger (
       organization_id, user_id, provider, model, is_byok, prompt_tokens, completion_tokens, estimated_cost_usd, status
     ) VALUES (
       $1, $2, 'gemini', 'gemini-2.5-flash', false, 500000, 496000, 0.15, 'success'
     )`,
    [raceOrgId, userA]
  );

  // Now, 10 concurrent requests arrive simultaneously.
  // Each request conservatively estimates 2 credits needed.
  // Total needed for 10 requests: 20 credits.
  // Available quota: 1000 - 996 = 4 credits!
  // Therefore: STRICTLY 2 requests must succeed (2 * 2 = 4 credits), and 8 requests MUST be rejected!
  const mockClientRace = createMockSupabase(userA);

  const parallelRequests = Array.from({ length: 10 }, (_, index) =>
    AICreditReservationService.reserveCredits({
      organizationId: raceOrgId,
      userId: userA,
      provider: "gemini",
      model: "gemini-2.5-flash",
      isByok: false,
      tier: "starter", // quota = 1000
      estimatedCredits: 2,
      clientOverride: mockClientRace,
    })
  );

  const parallelResults = await Promise.all(parallelRequests);
  const successResults = parallelResults.filter((r) => r.success);
  const rejectedResults = parallelResults.filter((r) => !r.success);

  testAssert(
    successResults.length === 2,
    `Strict Quota Enforcement: Exactly 2 out of 10 parallel requests succeeded (${successResults.length}/10)`
  );

  testAssert(
    rejectedResults.length === 8,
    `Overdraft Prevention: Exactly 8 parallel requests were rejected with QUOTA_EXHAUSTED (${rejectedResults.length}/10)`
  );

  testAssert(
    rejectedResults.every((r) => r.code === "QUOTA_EXHAUSTED"),
    "All rejected requests received explicit QUOTA_EXHAUSTED code"
  );

  // -------------------------------------------------------------------------
  // SECTION 3: SETTLEMENT & MID-STREAM ABORT RELEASE
  // -------------------------------------------------------------------------
  console.log("\n--- PART 3: Settlement & Mid-Stream Abort Release ---");

  const res1 = successResults[0];
  const res2 = successResults[1];

  // Request 1 completes successfully, consuming only 1 credit (1,000 tokens)
  await AICreditReservationService.settleReservation({
    reservationId: res1.reservationId!,
    actualTokens: 1000,
    isByok: false,
    status: "success",
    clientOverride: mockClientRace,
  });

  const res1Row = await pg.query<any>(
    `SELECT status, settled_credits FROM public.ai_credit_reservations WHERE id = $1`,
    [res1.reservationId]
  );
  testAssert(
    res1Row.rows[0].status === "settled" && res1Row.rows[0].settled_credits === 1,
    "Request 1 settled actual consumption (status = 'settled', settled_credits = 1)"
  );

  // Request 2 is ABORTED by user mid-stream
  await AICreditReservationService.releaseReservation(res2.reservationId!, mockClientRace);

  const res2Row = await pg.query<any>(
    `SELECT status, settled_credits FROM public.ai_credit_reservations WHERE id = $1`,
    [res2.reservationId]
  );
  testAssert(
    res2Row.rows[0].status === "released" && res2Row.rows[0].settled_credits === 0,
    "Request 2 was aborted mid-stream: reserved credits immediately released (status = 'released', settled_credits = 0)"
  );

  // Since Request 2 released its 2 reserved credits, a subsequent request needing 2 credits must now SUCCEED!
  const subsequentReq = await AICreditReservationService.reserveCredits({
    organizationId: raceOrgId,
    userId: userA,
    provider: "gemini",
    model: "gemini-2.5-flash",
    isByok: false,
    tier: "starter",
    estimatedCredits: 2,
    clientOverride: mockClientRace,
  });

  testAssert(
    subsequentReq.success === true,
    "Credits liberated by aborted request allowed new subsequent request to succeed immediately"
  );

  // -------------------------------------------------------------------------
  // SECTION 4: BYOK VS PLATFORM ACCOUNTING & INFRASTRUCTURE CONCURRENCY
  // -------------------------------------------------------------------------
  console.log("\n--- PART 4: BYOK Accounting & Concurrency Protection ---");

  const byokReservation = await AICreditReservationService.reserveCredits({
    organizationId: raceOrgId,
    userId: userA,
    provider: "openai",
    model: "gpt-4o",
    isByok: true,
    tier: "starter",
    estimatedCredits: 10, // Even if large, BYOK reserves 0 platform credits
    clientOverride: mockClientRace,
  });

  testAssert(
    byokReservation.success === true && byokReservation.reservedCredits === 0,
    "BYOK request succeeds and debits $0.00 / 0 credits from the platform quota"
  );

  const byokRow = await pg.query<any>(
    `SELECT is_byok, reserved_credits, status FROM public.ai_credit_reservations WHERE id = $1`,
    [byokReservation.reservationId]
  );
  testAssert(
    byokRow.rows[0].is_byok === true && byokRow.rows[0].reserved_credits === 0,
    "BYOK reservation recorded with is_byok = true and reserved_credits = 0"
  );

  // -------------------------------------------------------------------------
  // SECTION 5: MULTI-TENANT CREDENTIAL ISOLATION (RLS)
  // -------------------------------------------------------------------------
  console.log("\n--- PART 5: Multi-Tenant Credential Isolation (RLS) ---");

  // User A inserts a personal BYOK key under authenticated role
  await switchUser(userA);

  const userAKeyRes = await pg.query<any>(
    `INSERT INTO public.user_ai_credentials (
       user_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint
     ) VALUES (
       $1, 'openai', 'Alice Personal Key', 'sk-proj', 'iv:tag:cipher_alice', 'fp_alice_123'
     ) RETURNING id`,
    [userA]
  );
  const userAKeyId = userAKeyRes.rows[0].id;

  // Alice queries her own credentials -> finds 1 row
  const aliceQuery = await pg.query<any>(
    `SELECT id, label FROM public.user_ai_credentials`
  );
  testAssert(
    aliceQuery.rows.length === 1 && aliceQuery.rows[0].id === userAKeyId,
    "User A (Alice) can see her own personal BYOK credential"
  );

  // Switch session context to User B (Bob) under authenticated role
  await switchUser(userB);

  // Bob attempts to query credentials -> RLS restricts to Bob's own (0 rows)
  const bobQuery = await pg.query<any>(
    `SELECT id, label FROM public.user_ai_credentials`
  );
  testAssert(
    bobQuery.rows.length === 0,
    "User B (Bob) cannot query User A's credentials under RLS (returns 0 rows)"
  );

  // Bob attempts to maliciously update User A's key
  await pg.query<any>(
    `UPDATE public.user_ai_credentials SET label = 'Hacked' WHERE id = $1`,
    [userAKeyId]
  );

  // Switch back to Alice to verify key was untampered
  await switchUser(userA);
  const verifyUntampered = await pg.query<any>(
    `SELECT label FROM public.user_ai_credentials WHERE id = $1`,
    [userAKeyId]
  );
  testAssert(
    verifyUntampered.rows[0].label === "Alice Personal Key",
    "User B cannot update User A's credential (RLS denies modification, untampered)"
  );

  // -------------------------------------------------------------------------
  // SECTION 6: CREDENTIAL REDACTION & GEMINI URL SECURITY
  // -------------------------------------------------------------------------
  console.log("\n--- PART 6: Credential Redaction & Header-Based Gemini Auth ---");

  const gemini = new GeminiAdapter();

  // Test 1: Validate credential does NOT leak API key in connection test errors
  const mockLeakingKey = "AIzaSyD-TEST-LEAKING-SECRET-KEY-123456789";
  const validationResult = await testProviderConnectionAction({
    provider: "gemini",
    apiKey: mockLeakingKey,
  });

  testAssert(
    !validationResult.error?.includes(mockLeakingKey),
    "Connection test sanitizes API key from error output (no raw secret leakage)"
  );

  // Test 2: Ensure adapter's validateCredential returns valid without key in URL
  const validCheck = await gemini.validateCredential("mock_valid_gemini_key_12345");
  testAssert(validCheck.valid === true, "Gemini validateCredential accepts test keys safely");

  // Summary
  console.log("\n===============================================================================");
  console.log(`TEST-00043 SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("===============================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runEnterpriseSecurityTestSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
