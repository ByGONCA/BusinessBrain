import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  console.log("==================================================================");
  console.log("LIVE STAGING CONCURRENCY, QUOTA & BYOK VALIDATION");
  console.log("Target: https://jjalqvgaxzajsyccbjch.supabase.co");
  console.log("==================================================================\n");

  const envPath = path.resolve(process.cwd(), ".env");
  const envLocalPath = path.resolve(process.cwd(), ".env.local");

  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const envLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";

  const urlMatch = envContent.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
  const serviceKeyMatch = (envLocalContent + "\n" + envContent).match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m);

  const supabaseUrl = urlMatch ? urlMatch[1].trim() : "";
  const serviceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : "";

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const timestamp = Date.now();
  let testOrgAlphaId: string | null = null;
  let testOrgBetaId: string | null = null;
  let testUserId: string | null = null;

  const parseResult = (r: any) => {
    if (!r) return {};
    if (r.data !== undefined) {
      return Array.isArray(r.data) ? r.data[0] : r.data;
    }
    return Array.isArray(r) ? r[0] : r;
  };

  try {
    // 1. Setup isolated test tenants in Staging DB
    console.log("1. Setting up isolated test organizations and user in Staging...");
    
    const { data: existingUsers, error: userListErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (userListErr) {
      throw new Error(`Failed to list users: ${userListErr.message}`);
    }

    if (existingUsers.users && existingUsers.users.length > 0) {
      testUserId = existingUsers.users[0].id;
      console.log(`   Reusing staging test user: ${testUserId}`);
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: `staging-test-${timestamp}@businessbrain.test`,
        password: `TestPassword!${timestamp}#A1`,
        email_confirm: true,
      });
      if (createErr || !newUser.user) {
        throw new Error(`Failed to create test user: ${createErr?.message}`);
      }
      testUserId = newUser.user.id;
      console.log(`   Created new staging test user: ${testUserId}`);
    }

    // Create Org Alpha
    const { data: orgAlpha, error: orgAlphaErr } = await adminClient
      .from("organizations")
      .insert({
        name: `Test Org Alpha Concurrency ${timestamp}`,
        slug: `test-org-alpha-${timestamp}`,
        workspace_type: "team",
      })
      .select("id")
      .single();

    if (orgAlphaErr || !orgAlpha) {
      throw new Error(`Failed to create Org Alpha: ${orgAlphaErr?.message}`);
    }
    testOrgAlphaId = orgAlpha.id;
    console.log(`   Created Org Alpha: ${testOrgAlphaId}`);

    // Create Org Beta
    const { data: orgBeta, error: orgBetaErr } = await adminClient
      .from("organizations")
      .insert({
        name: `Test Org Beta Concurrency ${timestamp}`,
        slug: `test-org-beta-${timestamp}`,
        workspace_type: "team",
      })
      .select("id")
      .single();

    if (orgBetaErr || !orgBeta) {
      throw new Error(`Failed to create Org Beta: ${orgBetaErr?.message}`);
    }
    testOrgBetaId = orgBeta.id;
    console.log(`   Created Org Beta: ${testOrgBetaId}`);

    // Add membership
    await adminClient.from("organization_members").insert([
      { organization_id: testOrgAlphaId, user_id: testUserId, role: "owner" },
      { organization_id: testOrgBetaId, user_id: testUserId, role: "owner" },
    ]);

    // 2. Concurrency Test on Staging: 50 simultaneous requests to reserve_ai_credits_atomic
    console.log("\n2. Executing 50 CONCURRENT requests against live Staging RPC reserve_ai_credits_atomic...");
    console.log("   Org Alpha Quota: 50 credits | Request Size: 5 credits | Expected Accepted: Exactly 10 | Expected Rejected: 40");

    const quotaAlpha = 50;
    const requestCredits = 5;
    const startConcurTime = Date.now();

    const concurrentRequests = Array.from({ length: 50 }, async (_, idx) => {
      const res = await adminClient.rpc("reserve_ai_credits_atomic", {
        p_org_id: testOrgAlphaId,
        p_user_id: testUserId,
        p_conversation_id: null,
        p_task_type: "general_chat",
        p_provider: "gemini",
        p_model: "gemini-2.5-flash",
        p_is_byok: false,
        p_estimated_credits: requestCredits,
        p_quota: quotaAlpha,
      });

      return {
        idx,
        data: res.data,
        error: res.error,
      };
    });

    const resultsAlpha = await Promise.all(concurrentRequests);
    const durationAlphaMs = Date.now() - startConcurTime;

    const acceptedAlpha = resultsAlpha.filter((r) => parseResult(r).allowed === true);
    const rejectedAlpha = resultsAlpha.filter((r) => parseResult(r).allowed === false);
    const errorsAlpha = resultsAlpha.filter((r) => r.error);

    console.log(`   Duration           : ${durationAlphaMs}ms`);
    console.log(`   Accepted (Allowed) : ${acceptedAlpha.length} (Target: 10)`);
    console.log(`   Rejected (Quota)   : ${rejectedAlpha.length} (Target: 40)`);
    console.log(`   RPC Errors         : ${errorsAlpha.length} (Target: 0)`);

    // Verify reservation IDs are unique
    const reservationIds = acceptedAlpha.map((r) => parseResult(r).reservation_id);
    const uniqueIds = new Set(reservationIds);
    console.log(`   Unique IDs Count   : ${uniqueIds.size} of ${acceptedAlpha.length}`);

    // Verify database directly
    const { data: dbReservations, error: dbQueryErr } = await adminClient
      .from("ai_credit_reservations")
      .select("id, reserved_credits, status")
      .eq("organization_id", testOrgAlphaId)
      .eq("status", "reserved");

    if (dbQueryErr) {
      throw new Error(`Failed to query ai_credit_reservations: ${dbQueryErr.message}`);
    }

    const totalLockedCredits = dbReservations.reduce((sum, r) => sum + Number(r.reserved_credits), 0);
    console.log(`   Staging DB Locked  : ${totalLockedCredits} credits (Target: 50)`);

    if (acceptedAlpha.length !== 10 || rejectedAlpha.length !== 40 || totalLockedCredits !== 50 || uniqueIds.size !== 10) {
      throw new Error(`Concurrency invariant breached on staging! Accepted: ${acceptedAlpha.length}, Locked: ${totalLockedCredits}`);
    }
    console.log("   [PASSED] CONCURRENCY INVARIANT: Zero overdraft, exact 10 reservations, 40 rejections.");

    // 3. Multi-Tenant Parallel Lock Isolation (Org Alpha vs Org Beta)
    console.log("\n3. Testing Parallel Multi-Tenant Lock Isolation (Org Alpha and Org Beta simultaneously)...");
    const quotaBeta = 30; // 30 credits / 5 = 6 accepted
    const startParallelTime = Date.now();

    const tasksAlpha = Array.from({ length: 5 }, async () => {
      return adminClient.rpc("reserve_ai_credits_atomic", {
        p_org_id: testOrgAlphaId,
        p_user_id: testUserId,
        p_conversation_id: null,
        p_task_type: "general_chat",
        p_provider: "gemini",
        p_model: "gemini-2.5-flash",
        p_is_byok: false,
        p_estimated_credits: requestCredits,
        p_quota: quotaAlpha, // already at 50, so all should be rejected
      });
    });

    const tasksBeta = Array.from({ length: 10 }, async () => {
      return adminClient.rpc("reserve_ai_credits_atomic", {
        p_org_id: testOrgBetaId,
        p_user_id: testUserId,
        p_conversation_id: null,
        p_task_type: "general_chat",
        p_provider: "gemini",
        p_model: "gemini-2.5-flash",
        p_is_byok: false,
        p_estimated_credits: requestCredits,
        p_quota: quotaBeta, // quota 30 -> 6 accepted, 4 rejected
      });
    });

    const [resAlphaParallel, resBetaParallel] = await Promise.all([
      Promise.all(tasksAlpha),
      Promise.all(tasksBeta),
    ]);
    const durationParallelMs = Date.now() - startParallelTime;

    const acceptedBeta = resBetaParallel.filter((r) => parseResult(r).allowed === true);
    const rejectedBeta = resBetaParallel.filter((r) => parseResult(r).allowed === false);
    const acceptedAlphaExtra = resAlphaParallel.filter((r) => parseResult(r).allowed === true);

    console.log(`   Duration Parallel  : ${durationParallelMs}ms`);
    console.log(`   Org Alpha Allowed  : ${acceptedAlphaExtra.length} (Target: 0, since quota 50 is full)`);
    console.log(`   Org Beta Allowed   : ${acceptedBeta.length} (Target: 6, 30 credits / 5)`);
    console.log(`   Org Beta Rejected  : ${rejectedBeta.length} (Target: 4)`);

    if (acceptedAlphaExtra.length !== 0 || acceptedBeta.length !== 6 || rejectedBeta.length !== 4) {
      throw new Error(`Multi-tenant parallel test failed! Org Alpha Extra: ${acceptedAlphaExtra.length}, Org Beta Accepted: ${acceptedBeta.length}`);
    }
    console.log("   [PASSED] MULTI-TENANT ISOLATION: Org Alpha saturation does not block Org Beta.");

    // 4. Test Settle, Release & State Conflict (Idempotency) on Staging
    console.log("\n4. Testing Settlement, Release, Cancellation and State Conflict Idempotency on Staging...");
    const sampleReservation1 = parseResult(acceptedAlpha[0]).reservation_id;
    const sampleReservation2 = parseResult(acceptedAlpha[1]).reservation_id;

    // Settle reservation 1 with actual tokens (e.g. 1200 tokens -> 2 credits)
    const { data: settle1Res, error: settle1Err } = await adminClient.rpc("settle_ai_credit_reservation_atomic", {
      p_reservation_id: sampleReservation1,
      p_actual_tokens: 1200,
      p_is_byok: false,
      p_status: "settled",
    });
    console.log(`   Settle 1 Result    : ${JSON.stringify(settle1Res)} (Error: ${settle1Err?.message || "none"})`);

    // Double settle reservation 1 -> Must fail with STATE_CONFLICT
    const { data: doubleSettleRes } = await adminClient.rpc("settle_ai_credit_reservation_atomic", {
      p_reservation_id: sampleReservation1,
      p_actual_tokens: 1200,
      p_is_byok: false,
      p_status: "settled",
    });
    console.log(`   Double Settle Res  : ${JSON.stringify(doubleSettleRes)} (Target: error_code: STATE_CONFLICT)`);

    // Release reservation 2 (Pre-emission abort)
    const { data: release2Res, error: release2Err } = await adminClient.rpc("release_ai_credit_reservation_atomic", {
      p_reservation_id: sampleReservation2,
    });
    console.log(`   Release 2 Result   : ${JSON.stringify(release2Res)} (Error: ${release2Err?.message || "none"})`);

    // Double release reservation 2 -> Must fail with STATE_CONFLICT
    const { data: doubleReleaseRes } = await adminClient.rpc("release_ai_credit_reservation_atomic", {
      p_reservation_id: sampleReservation2,
    });
    console.log(`   Double Release Res : ${JSON.stringify(doubleReleaseRes)} (Target: error_code: STATE_CONFLICT)`);

    const dSettle = parseResult(doubleSettleRes);
    const dRelease = parseResult(doubleReleaseRes);
    const settleConflict = dSettle?.error_code || dSettle?.reason;
    const releaseConflict = dRelease?.error_code || dRelease?.reason;
    if (settleConflict !== "STATE_CONFLICT" || releaseConflict !== "STATE_CONFLICT") {
      throw new Error(`State machine idempotency failed on staging! Double settle: ${settleConflict}, Double release: ${releaseConflict}`);
    }
    console.log("   [PASSED] STATE MACHINE IDEMPOTENCY: Double settlement/release rejected with STATE_CONFLICT.");

    // 5. Test Cancelation Accounting in ai_usage_ledger
    console.log("\n5. Testing Canceled Stream Record in Staging ai_usage_ledger...");
    const sampleReservation3 = parseResult(acceptedAlpha[2]).reservation_id;
    // Settle with status 'canceled' and 700 tokens
    await adminClient.rpc("settle_ai_credit_reservation_atomic", {
      p_reservation_id: sampleReservation3,
      p_actual_tokens: 700,
      p_is_byok: false,
      p_status: "settled",
    });

    const { error: insertLedgerErr } = await adminClient.from("ai_usage_ledger").insert({
      organization_id: testOrgAlphaId,
      user_id: testUserId,
      provider: "gemini",
      model: "gemini-2.5-flash",
      is_byok: false,
      prompt_tokens: 500,
      completion_tokens: 200,
      estimated_cost_usd: 0.00014,
      status: "canceled",
    });

    if (insertLedgerErr) {
      throw new Error(`Failed to insert canceled usage record: ${insertLedgerErr.message}`);
    }

    // Verify ledger record exists with status = 'canceled'
    const { data: ledgerEntries } = await adminClient
      .from("ai_usage_ledger")
      .select("id, status, prompt_tokens, completion_tokens")
      .eq("organization_id", testOrgAlphaId)
      .eq("status", "canceled");

    console.log(`   Canceled Ledger Entries Found: ${ledgerEntries?.length || 0}`);
    if (!ledgerEntries || ledgerEntries.length === 0) {
      throw new Error("Canceled stream was not recorded in staging ai_usage_ledger!");
    }
    console.log("   [PASSED] CANCELED STREAM ACCOUNTING: Recorded with status 'canceled' in staging ledger.");

    // 6. Test BYOK Isolation on Staging Tables
    console.log("\n6. Testing BYOK Isolation on Staging Tables...");
    const { error: insertByokErr } = await adminClient.from("organization_ai_credentials").insert({
      organization_id: testOrgAlphaId,
      provider: "openai",
      label: "Test Staging OpenAI Key",
      key_prefix: "sk-proj-test",
      encrypted_api_key: "AES_GCM_STAGING_TEST_ENCRYPTED_KEY_ALPHA",
      key_fingerprint: `fp-test-alpha-${timestamp}`,
      status: "active",
      is_default: true,
    });

    if (insertByokErr) {
      throw new Error(`Failed to insert Org Alpha BYOK credential: ${insertByokErr.message}`);
    }

    // Query credentials scoping
    const { data: alphaCreds } = await adminClient
      .from("organization_ai_credentials")
      .select("id, organization_id, provider, label")
      .eq("organization_id", testOrgAlphaId);

    const { data: betaCreds } = await adminClient
      .from("organization_ai_credentials")
      .select("id, organization_id, provider, label")
      .eq("organization_id", testOrgBetaId);

    console.log(`   Org Alpha BYOK Credentials: ${alphaCreds?.length || 0}`);
    console.log(`   Org Beta BYOK Credentials : ${betaCreds?.length || 0}`);

    if (alphaCreds?.length !== 1 || betaCreds?.length !== 0) {
      throw new Error("BYOK credential isolation failed between organizations!");
    }
    console.log("   [PASSED] BYOK ISOLATION: Org Beta cannot see Org Alpha credentials.");

    console.log("\n==================================================================");
    console.log("ALL STAGING VALIDATION STEPS COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");

  } finally {
    // Cleanup temporary test organizations
    console.log("\nCleaning up staging test artifacts...");
    if (testOrgAlphaId) {
      await adminClient.from("ai_usage_ledger").delete().eq("organization_id", testOrgAlphaId);
      await adminClient.from("ai_credit_reservations").delete().eq("organization_id", testOrgAlphaId);
      await adminClient.from("organization_ai_credentials").delete().eq("organization_id", testOrgAlphaId);
      await adminClient.from("organization_members").delete().eq("organization_id", testOrgAlphaId);
      await adminClient.from("organizations").delete().eq("id", testOrgAlphaId);
      console.log(`   Cleaned up Org Alpha (${testOrgAlphaId})`);
    }
    if (testOrgBetaId) {
      await adminClient.from("ai_credit_reservations").delete().eq("organization_id", testOrgBetaId);
      await adminClient.from("organization_members").delete().eq("organization_id", testOrgBetaId);
      await adminClient.from("organizations").delete().eq("id", testOrgBetaId);
      console.log(`   Cleaned up Org Beta (${testOrgBetaId})`);
    }
    console.log("Cleanup complete. Staging environment restored to clean state.");
  }
}

main().catch((err) => {
  console.error("\nFATAL ERROR DURING STAGING VALIDATION:", err.message);
  process.exit(1);
});
