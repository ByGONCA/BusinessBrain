/**
 * BusinessBrain — AI Foundation & BYOK Security Verification Suite (TEST-00038)
 *
 * Verifies:
 * 1. Clean DDL application of Migration 00038 (organization_ai_credentials, ai_conversations, ai_messages, ai_usage_ledger)
 * 2. Cryptographic security: AES-256-GCM JIT encryption/decryption and HMAC-SHA256 fingerprinting
 * 3. Multi-tenant Row-Level Security (RLS) enforcement on all 4 new tables
 * 4. Role-based security: Owner/Admin exclusivity for BYOK credentials
 * 5. Cross-tenant leakage prevention (Org A vs Org B)
 * 6. User privacy boundaries: Conversational messages strictly isolated per author and organization
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  encryptAICredential,
  decryptAICredential,
  computeKeyFingerprint,
} from "../lib/crypto/encryption";

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

async function runTestSuite() {
  console.log("=======================================================");
  console.log("AI FOUNDATION & BYOK SECURITY VERIFICATION (TEST-00038)");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // PART 1: IN-MEMORY CRYPTOGRAPHIC UNIT TESTS
  // ---------------------------------------------------------------------------
  console.log("PART 1: Cryptographic Verification (AES-256-GCM & Fingerprinting)");
  console.log("-----------------------------------------------------------------");

  const sampleApiKey = "AIzaSyD-sample-google-gemini-key-1234567890abcdef";
  const encrypted = encryptAICredential(sampleApiKey);

  testAssert(typeof encrypted === "string", "encryptAICredential returns a string");
  const parts = encrypted.split(":");
  testAssert(parts.length === 3, "Encrypted payload has format iv:tag:ciphertext");
  testAssert(parts[0].length === 24, "IV length is 12 bytes (24 hex characters)");
  testAssert(parts[1].length === 32, "AuthTag length is 16 bytes (32 hex characters)");
  testAssert(parts[2].length > 0, "Ciphertext is non-empty");

  const decrypted = decryptAICredential(encrypted);
  testAssert(decrypted === sampleApiKey, "decryptAICredential recovers identical plaintext key");

  // Tamper detection test
  const tamperedCiphertext = parts[0] + ":" + parts[1] + ":" + parts[2].slice(0, -2) + "aa";
  let tamperCaught = false;
  try {
    decryptAICredential(tamperedCiphertext);
  } catch {
    tamperCaught = true;
  }
  testAssert(tamperCaught, "Tampered ciphertext is detected and rejected by GCM auth tag");

  // Fingerprint test
  const fingerprint1 = computeKeyFingerprint(sampleApiKey);
  const fingerprint2 = computeKeyFingerprint(sampleApiKey);
  testAssert(fingerprint1.length === 64, "Key fingerprint is 64-character SHA-256 hex");
  testAssert(fingerprint1 === fingerprint2, "Key fingerprint is deterministic for duplicate detection");
  testAssert(fingerprint1 !== sampleApiKey, "Key fingerprint does not expose raw API key");

  // ---------------------------------------------------------------------------
  // PART 2: POSTGRESQL ENGINE DDL & RLS VERIFICATION (PGLITE)
  // ---------------------------------------------------------------------------
  console.log("\nPART 2: PostgreSQL Engine DDL & RLS Verification (PGlite)");
  console.log("---------------------------------------------------------");

  const pg = new PGlite();

  // Step 1: Base environment setup
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;

    -- Emulate Supabase auth.users
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text,
      created_at timestamptz DEFAULT now()
    );

    -- Emulate Supabase roles
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

    -- Session state table for testing RLS context
    CREATE TABLE IF NOT EXISTS auth.current_session (
      user_id uuid
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT user_id FROM auth.current_session LIMIT 1;
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT 'authenticated'::text;
    $$;

    -- Base organizations and members
    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
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

    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

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
  `);

  testAssert(true, "Base Supabase environment initialized in PGlite");

  // Step 2: Apply Migration 00038
  const migrationPath = path.join(__dirname, "../database/migrations/00038_ai_foundation_and_byok.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await pg.exec(migrationSql);
  testAssert(true, "Migration 00038 executed cleanly without DDL errors");

  // Step 3: Seed two distinct organizations
  const org1Id = "11111111-1111-1111-1111-111111111111";
  const org2Id = "22222222-2222-2222-2222-222222222222";
  const userAdminOrg1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userMemberOrg1 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userAdminOrg2 = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  await pg.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${userAdminOrg1}', 'admin1@acme.com'),
      ('${userMemberOrg1}', 'member1@acme.com'),
      ('${userAdminOrg2}', 'admin2@stark.com');

    INSERT INTO public.organizations (id, name) VALUES
      ('${org1Id}', 'Acme Corporation (Org 1)'),
      ('${org2Id}', 'Stark Industries (Org 2)');

    INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
      ('${org1Id}', '${userAdminOrg1}', 'owner'),
      ('${org1Id}', '${userMemberOrg1}', 'member'),
      ('${org2Id}', '${userAdminOrg2}', 'owner');
  `);

  // Grant privileges to authenticated role so RLS is evaluated as in Supabase
  await pg.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
  `);

  // Helper to switch active session user with authenticated role
  async function switchUser(userId: string | null) {
    await pg.exec("SET ROLE postgres;");
    await pg.exec("DELETE FROM auth.current_session;");
    if (userId) {
      await pg.exec(`INSERT INTO auth.current_session (user_id) VALUES ('${userId}');`);
      await pg.exec("SET ROLE authenticated;");
    }
  }

  // ---------------------------------------------------------------------------
  // TEST: organization_ai_credentials (BYOK RLS & Deduplication)
  // ---------------------------------------------------------------------------
  console.log("\n  [Testing organization_ai_credentials RLS & Constraints]");

  // 1. Admin of Org 1 can insert a credential
  await switchUser(userAdminOrg1);
  const credFingerprint = computeKeyFingerprint(sampleApiKey);
  await pg.exec(`
    INSERT INTO public.organization_ai_credentials (
      organization_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, created_by_user_id
    ) VALUES (
      '${org1Id}', 'gemini', 'Primary Gemini Key', 'AIza...bcde', '${encrypted}', '${credFingerprint}', '${userAdminOrg1}'
    );
  `);
  testAssert(true, "Admin Org 1 can successfully insert BYOK credential");

  // 2. Duplicate key fingerprint in SAME org is rejected by unique constraint
  let duplicateRejected = false;
  try {
    await pg.exec(`
      INSERT INTO public.organization_ai_credentials (
        organization_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, created_by_user_id
      ) VALUES (
        '${org1Id}', 'gemini', 'Duplicate Key Attempt', 'AIza...bcde', '${encrypted}', '${credFingerprint}', '${userAdminOrg1}'
      );
    `);
  } catch {
    duplicateRejected = true;
  }
  testAssert(duplicateRejected, "Duplicate API key fingerprint in same org is strictly rejected");

  // 3. Same key in a DIFFERENT org is allowed (multi-tenant portability)
  await switchUser(userAdminOrg2);
  let crossOrgInsertAllowed = false;
  try {
    await pg.exec(`
      INSERT INTO public.organization_ai_credentials (
        organization_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, created_by_user_id
      ) VALUES (
        '${org2Id}', 'gemini', 'Stark Gemini Key', 'AIza...bcde', '${encrypted}', '${credFingerprint}', '${userAdminOrg2}'
      );
    `);
    crossOrgInsertAllowed = true;
  } catch (err) {
    console.error("Error inserting in Org 2:", err);
  }
  testAssert(crossOrgInsertAllowed, "Same API key can be configured in a separate tenant independently");

  // 4. Regular member of Org 1 CANNOT read credentials (RLS blocks)
  await switchUser(userMemberOrg1);
  const memberCredRead = await pg.query("SELECT * FROM public.organization_ai_credentials;");
  testAssert(memberCredRead.rows.length === 0, "Regular member cannot read organization AI credentials (RLS)");

  // 5. Admin Org 2 cannot read Org 1 credentials
  await switchUser(userAdminOrg2);
  const org2CredRead = await pg.query(`
    SELECT * FROM public.organization_ai_credentials WHERE organization_id = '${org1Id}';
  `);
  testAssert(org2CredRead.rows.length === 0, "Admin Org 2 cannot read Org 1 credentials (cross-tenant isolation)");

  // ---------------------------------------------------------------------------
  // TEST: ai_conversations & ai_messages (Privacy & Scoping)
  // ---------------------------------------------------------------------------
  console.log("\n  [Testing ai_conversations & ai_messages Isolation]");

  // 1. Member Org 1 creates conversation
  await switchUser(userMemberOrg1);
  const convResult = await pg.query<{ id: string }>(`
    INSERT INTO public.ai_conversations (
      organization_id, user_id, title, provider, model
    ) VALUES (
      '${org1Id}', '${userMemberOrg1}', 'Estratégia Q4', 'gemini', 'gemini-2.5-flash'
    ) RETURNING id;
  `);
  const convId = convResult.rows[0].id;
  testAssert(typeof convId === "string", "Member Org 1 can create a private conversation");

  // 2. Member Org 1 inserts messages
  await pg.exec(`
    INSERT INTO public.ai_messages (
      conversation_id, organization_id, user_id, role, content
    ) VALUES 
      ('${convId}', '${org1Id}', '${userMemberOrg1}', 'user', 'Qual é a meta de MRR?'),
      ('${convId}', '${org1Id}', NULL, 'assistant', 'A meta é de 20.000 € segundo a última ata.');
  `);
  const msgRead = await pg.query("SELECT * FROM public.ai_messages WHERE conversation_id = '" + convId + "';");
  testAssert(msgRead.rows.length === 2, "Conversation author can read their messages");

  // 3. Admin Org 1 CANNOT read private conversation of Member Org 1 (User isolation)
  await switchUser(userAdminOrg1);
  const adminConvRead = await pg.query("SELECT * FROM public.ai_conversations WHERE id = '" + convId + "';");
  testAssert(adminConvRead.rows.length === 0, "Other members (even admins) cannot read private conversations of peers");

  // 4. Admin Org 2 CANNOT read messages or conversations of Org 1
  await switchUser(userAdminOrg2);
  const alienMsgRead = await pg.query("SELECT * FROM public.ai_messages WHERE organization_id = '" + org1Id + "';");
  testAssert(alienMsgRead.rows.length === 0, "Alien organization is strictly blocked from reading messages (RLS)");

  // ---------------------------------------------------------------------------
  // TEST: ai_usage_ledger (Auditing & Quotas)
  // ---------------------------------------------------------------------------
  console.log("\n  [Testing ai_usage_ledger Audit Trail]");

  // Member Org 1 inserts an audit log
  await switchUser(userMemberOrg1);
  await pg.exec(`
    INSERT INTO public.ai_usage_ledger (
      organization_id, user_id, conversation_id, provider, model, prompt_tokens, completion_tokens, estimated_cost_usd, status
    ) VALUES (
      '${org1Id}', '${userMemberOrg1}', '${convId}', 'gemini', 'gemini-2.5-flash', 1500, 300, 0.000203, 'success'
    );
  `);
  const usageOrg1 = await pg.query("SELECT * FROM public.ai_usage_ledger WHERE organization_id = '" + org1Id + "';");
  testAssert(usageOrg1.rows.length === 1, "Usage ledger accurately records token consumption in Org 1");

  // Alien user from Org 2 cannot read Org 1 usage
  await switchUser(userAdminOrg2);
  const alienUsageRead = await pg.query("SELECT * FROM public.ai_usage_ledger WHERE organization_id = '" + org1Id + "';");
  testAssert(alienUsageRead.rows.length === 0, "Usage ledger is strictly partitioned per tenant (RLS)");

  // ---------------------------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TOTAL TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});
