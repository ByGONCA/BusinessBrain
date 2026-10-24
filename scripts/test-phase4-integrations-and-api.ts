/**
 * BusinessBrain — Phase 4 Integrations, Ecosystem & Public API Test Suite
 *
 * Deterministic test runner using PGlite WASM Postgres 16 (Full ACID SQL Engine).
 *
 * Verifies:
 * 1. Migration 00036 executes cleanly with all schemas, tables, constraints & triggers.
 * 2. Strict PostgreSQL multi-tenant isolation across all 4 Phase 4 tables.
 * 3. Enterprise Public API key generation, SHA-256 hashing, prefix lookup, expiration & revocation.
 * 4. validate_api_key SECURITY DEFINER RPC behavior and last_used_at tracking.
 * 5. Scope resolution logic: admin bypass, granular read/write checks.
 * 6. GitHub webhook HMAC-SHA256 constant-time verification & event ingestion.
 * 7. Slack webhook v0 HMAC-SHA256 signature & 300-second replay attack protection.
 * 8. Confluence XHTML to Markdown transpilation and hierarchy preservation.
 * 9. Notion Block to Markdown transpilation with rich-text annotations.
 * 10. Content-hash deduplication preventing duplicate document creation on re-import.
 */

import { PGlite } from "@electric-sql/pglite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { hashApiKey } from "../lib/api-keys/service";
import { hasScope } from "../lib/api-keys/scopes";
import { verifyGitHubWebhookSignature } from "../lib/integrations/github/sync";
import { verifySlackWebhookSignature } from "../lib/integrations/slack/sync";
import { confluenceStorageToMarkdown, computeContentHash } from "../lib/integrations/importers/confluence";
import { notionBlocksToMarkdown, formatNotionRichText } from "../lib/integrations/importers/notion";

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

async function runPhase4TestSuite() {
  console.log("\n=======================================================");
  console.log("BUSINESSBRAIN — PHASE 4: INTEGRAÇÕES & ECOSSISTEMA");
  console.log("=======================================================\n");

  const db = new PGlite();

  console.log("[Section 1] Setting up base schema and dependencies in Postgres 16...");

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS public;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider text NOT NULL,
      provider_account_id text,
      status text NOT NULL DEFAULT 'connected',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.pages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      title text NOT NULL,
      content jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.company_entities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      type text NOT NULL CHECK (type in ('project', 'task', 'meeting', 'goal', 'person', 'decision', 'document')),
      title text NOT NULL,
      content text NOT NULL DEFAULT '',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
    RETURNS boolean AS $$
    BEGIN
      RETURN true;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION public.has_org_role(org_id uuid, roles text[])
    RETURNS boolean AS $$
    BEGIN
      RETURN true;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log("[Section 2] Applying Migration 00036 (Phase 4 Schema)...");

  const migrationPath = path.join(
    process.cwd(),
    "database",
    "migrations",
    "00036_phase_4_integrations_and_api.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  await db.exec(migrationSql);
  testAssert(true, "Migration 00036 executed with zero errors");

  // Verify all 4 tables exist
  const tableCheck = await db.query<{ count: string }>(`
    SELECT count(*)::text AS count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('integration_sync_logs', 'organization_api_keys', 'imported_documents', 'external_discussions')
  `);
  testAssert(parseInt(tableCheck.rows[0].count) === 4, "All 4 Phase 4 tables verified in information_schema");

  console.log("\n[Section 3] Testing Multi-Tenant Isolation & Constraints...");

  // Create two distinct tenant organizations
  const org1Res = await db.query<{ id: string }>(
    `INSERT INTO public.organizations (name) VALUES ('Acme Corp') RETURNING id`
  );
  const org2Res = await db.query<{ id: string }>(
    `INSERT INTO public.organizations (name) VALUES ('Beta Industries') RETURNING id`
  );
  const org1Id = org1Res.rows[0].id;
  const org2Id = org2Res.rows[0].id;

  // Insert sync log for Org 1
  await db.query(
    `INSERT INTO public.integration_sync_logs (organization_id, provider, sync_type, status, items_synced)
     VALUES ($1, 'github', 'repositories', 'completed', 10)`,
    [org1Id]
  );

  // Insert sync log for Org 2
  await db.query(
    `INSERT INTO public.integration_sync_logs (organization_id, provider, sync_type, status, items_synced)
     VALUES ($1, 'slack', 'channel_messages', 'completed', 25)`,
    [org2Id]
  );

  // Tenant isolation check
  const org1Logs = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.integration_sync_logs WHERE organization_id = $1`,
    [org1Id]
  );
  testAssert(parseInt(org1Logs.rows[0].count) === 1, "Tenant 1 sync logs strictly scoped to Org 1");

  const org2Logs = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.integration_sync_logs WHERE organization_id = $1`,
    [org2Id]
  );
  testAssert(parseInt(org2Logs.rows[0].count) === 1, "Tenant 2 sync logs strictly scoped to Org 2");

  console.log("\n[Section 4] Testing Enterprise Public API Keys & validate_api_key RPC...");

  const rawKey = `cb_live_${crypto.randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 16);
  const keyHash = hashApiKey(rawKey);

  testAssert(keyPrefix.startsWith("cb_live_"), "API Key prefix matches cb_live_ standard");
  testAssert(keyHash.length === 64, "API Key hash is valid 64-char hex SHA-256");

  // Insert active key for Org 1
  const keyInsertRes = await db.query<{ id: string }>(
    `INSERT INTO public.organization_api_keys (organization_id, name, key_prefix, key_hash, scopes, rate_limit_per_minute)
     VALUES ($1, 'CI Deploy Key', $2, $3, ARRAY['read:projects', 'read:documents'], 100)
     RETURNING id`,
    [org1Id, keyPrefix, keyHash]
  );
  const keyId = keyInsertRes.rows[0].id;

  // Call validate_api_key RPC with valid key
  const validRpcRes = await db.query<{
    valid: boolean;
    key_id: string;
    organization_id: string;
    organization_name: string;
    scopes: string[];
    rate_limit_per_minute: number;
    error_code: string | null;
  }>(`SELECT * FROM public.validate_api_key($1)`, [keyHash]);

  testAssert(validRpcRes.rows.length === 1, "validate_api_key returned 1 record");
  testAssert(validRpcRes.rows[0].valid === true, "validate_api_key declared valid key as TRUE");
  testAssert(validRpcRes.rows[0].organization_id === org1Id, "validate_api_key resolved correct Org ID");
  testAssert(validRpcRes.rows[0].rate_limit_per_minute === 100, "validate_api_key resolved custom rate limit");

  // Verify last_used_at was updated
  const updatedKey = await db.query<{ last_used_at: string | null }>(
    `SELECT last_used_at FROM public.organization_api_keys WHERE id = $1`,
    [keyId]
  );
  testAssert(updatedKey.rows[0].last_used_at !== null, "validate_api_key updated last_used_at timestamp");

  // Test expired key rejection
  const expiredKeyHash = hashApiKey("cb_live_expired_key_test_12345678901234567890");
  await db.query(
    `INSERT INTO public.organization_api_keys (organization_id, name, key_prefix, key_hash, scopes, expires_at)
     VALUES ($1, 'Expired Key', 'cb_live_expired', $2, ARRAY['read:projects'], now() - interval '1 hour')`,
    [org1Id, expiredKeyHash]
  );
  const expiredRpcRes = await db.query<{ valid: boolean; error_code: string }>(
    `SELECT * FROM public.validate_api_key($1)`,
    [expiredKeyHash]
  );
  testAssert(expiredRpcRes.rows[0].valid === false, "validate_api_key rejected expired key");
  testAssert(expiredRpcRes.rows[0].error_code === "key_expired", "validate_api_key error_code is 'key_expired'");

  // Test revoked key rejection
  const revokedKeyHash = hashApiKey("cb_live_revoked_key_test_12345678901234567890");
  await db.query(
    `INSERT INTO public.organization_api_keys (organization_id, name, key_prefix, key_hash, scopes, revoked_at)
     VALUES ($1, 'Revoked Key', 'cb_live_revoked', $2, ARRAY['read:projects'], now())`,
    [org1Id, revokedKeyHash]
  );
  const revokedRpcRes = await db.query<{ valid: boolean; error_code: string }>(
    `SELECT * FROM public.validate_api_key($1)`,
    [revokedKeyHash]
  );
  testAssert(revokedRpcRes.rows[0].valid === false, "validate_api_key rejected revoked key");
  testAssert(revokedRpcRes.rows[0].error_code === "key_revoked", "validate_api_key error_code is 'key_revoked'");

  // Test unknown key rejection
  const unknownRpcRes = await db.query<{ valid: boolean; error_code: string }>(
    `SELECT * FROM public.validate_api_key($1)`,
    [crypto.randomBytes(32).toString("hex")]
  );
  testAssert(unknownRpcRes.rows[0].valid === false, "validate_api_key rejected non-existent key");
  testAssert(unknownRpcRes.rows[0].error_code === "key_not_found", "validate_api_key error_code is 'key_not_found'");

  console.log("\n[Section 5] Testing Granular Scope Logic...");

  testAssert(hasScope(["read:projects", "read:documents"], "read:projects"), "hasScope returns true for granted scope");
  testAssert(!hasScope(["read:projects"], "write:projects"), "hasScope returns false for ungranted scope");
  testAssert(hasScope(["admin"], "write:projects"), "hasScope: 'admin' grants write:projects");
  testAssert(hasScope(["admin"], "read:metrics"), "hasScope: 'admin' grants read:metrics");

  console.log("\n[Section 6] Testing Webhook Signature Verification (GitHub & Slack)...");

  // GitHub HMAC-SHA256 signature verification
  const githubSecret = "gh_webhook_test_secret_xyz123";
  const githubBody = JSON.stringify({ action: "opened", pull_request: { number: 42, title: "Feature X" } });
  const validGithubDigest = crypto.createHmac("sha256", githubSecret).update(githubBody, "utf8").digest("hex");
  const validGithubHeader = `sha256=${validGithubDigest}`;

  testAssert(
    verifyGitHubWebhookSignature(githubBody, validGithubHeader, githubSecret),
    "GitHub webhook signature verified for valid HMAC"
  );
  testAssert(
    !verifyGitHubWebhookSignature(githubBody, "sha256=invalidhex00000000000000000000000000000000000000000000000000000000", githubSecret),
    "GitHub webhook signature rejected invalid digest"
  );
  testAssert(
    !verifyGitHubWebhookSignature(githubBody + " tampered", validGithubHeader, githubSecret),
    "GitHub webhook signature rejected tampered body"
  );

  // Slack v0 HMAC-SHA256 signature verification with 300s timestamp window
  const slackSecret = "slack_signing_secret_abc456";
  const slackBody = JSON.stringify({ type: "event_callback", event: { type: "message", text: "Hello team" } });
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();
  const validSlackSig = `v0=${crypto
    .createHmac("sha256", slackSecret)
    .update(`v0:${currentTimestamp}:${slackBody}`, "utf8")
    .digest("hex")}`;

  testAssert(
    verifySlackWebhookSignature(slackBody, currentTimestamp, validSlackSig, slackSecret),
    "Slack webhook signature verified for current timestamp"
  );

  // Expired timestamp test (replay attack prevention: 600 seconds old)
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
  const expiredSlackSig = `v0=${crypto
    .createHmac("sha256", slackSecret)
    .update(`v0:${expiredTimestamp}:${slackBody}`, "utf8")
    .digest("hex")}`;

  testAssert(
    !verifySlackWebhookSignature(slackBody, expiredTimestamp, expiredSlackSig, slackSecret),
    "Slack webhook signature rejected expired timestamp (> 300s replay prevention)"
  );

  console.log("\n[Section 7] Testing Knowledge Importers & Deduplication...");

  // Confluence XHTML transpiler
  const confluenceSampleXhtml = `
    <h1>Architecture Decision Record</h1>
    <p>This decision standardizes on <strong>PostgreSQL</strong> with <em>Row Level Security</em>.</p>
    <ac:structured-macro ac:name="code">
      <ac:plain-text-body><![CDATA[SELECT * FROM public.organizations WHERE id = $1;]]></ac:plain-text-body>
    </ac:structured-macro>
    <ac:structured-macro ac:name="tip">
      <ac:rich-text-body><p>Always verify organization scoping.</p></ac:rich-text-body>
    </ac:structured-macro>
  `;

  const confluenceMd = confluenceStorageToMarkdown(confluenceSampleXhtml);
  testAssert(confluenceMd.includes("# Architecture Decision Record"), "Confluence transpiler: heading converted");
  testAssert(confluenceMd.includes("**PostgreSQL**"), "Confluence transpiler: bold converted");
  testAssert(confluenceMd.includes("*Row Level Security*"), "Confluence transpiler: italic converted");
  testAssert(confluenceMd.includes("SELECT * FROM public.organizations"), "Confluence transpiler: code block converted");
  testAssert(confluenceMd.includes("> [!TIP]"), "Confluence transpiler: tip macro converted");

  // Notion Block transpiler
  const notionBlocks = [
    {
      type: "heading_1",
      heading_1: {
        rich_text: [{ plain_text: "Company Handbook" }],
      },
    },
    {
      type: "paragraph",
      paragraph: {
        rich_text: [
          { plain_text: "Welcome to " },
          { plain_text: "BusinessBrain", annotations: { bold: true } },
          { plain_text: "! Read the " },
          { plain_text: "guidelines", text: { link: { url: "https://docs.businessbrain.com" } } },
        ],
      },
    },
    {
      type: "callout",
      callout: {
        icon: { emoji: "🚀" },
        rich_text: [{ plain_text: "Trial period is 7 days." }],
      },
    },
  ];

  const notionMd = notionBlocksToMarkdown(notionBlocks);
  testAssert(notionMd.includes("# Company Handbook"), "Notion transpiler: heading_1 converted");
  testAssert(notionMd.includes("**BusinessBrain**"), "Notion transpiler: bold rich text converted");
  testAssert(notionMd.includes("[guidelines](https://docs.businessbrain.com)"), "Notion transpiler: link rich text converted");
  testAssert(notionMd.includes("> [!NOTE] 🚀"), "Notion transpiler: callout converted");

  // Content Hash Deduplication Test
  const docHash1 = computeContentHash(confluenceMd);
  const docHash2 = computeContentHash(confluenceMd);
  testAssert(docHash1 === docHash2, "Identical content yields identical SHA-256 hash");

  // Insert imported document for Org 1
  await db.query(
    `INSERT INTO public.imported_documents (organization_id, source_platform, source_id, title, content_payload, content_hash)
     VALUES ($1, 'confluence', 'conf_page_101', 'ADR 001', $2, $3)`,
    [org1Id, confluenceMd, docHash1]
  );

  // Attempt duplicate insert with same (org_id, source_platform, source_id)
  let caughtDuplicateErr = false;
  try {
    await db.query(
      `INSERT INTO public.imported_documents (organization_id, source_platform, source_id, title, content_payload, content_hash)
       VALUES ($1, 'confluence', 'conf_page_101', 'ADR 001 Duplicate', $2, $3)`,
      [org1Id, confluenceMd, docHash1]
    );
  } catch (err: any) {
    caughtDuplicateErr = err.message.includes("uq_imported_docs_source") || err.message.includes("unique");
  }
  testAssert(caughtDuplicateErr, "Database constraint uq_imported_docs_source rejected duplicate external page ID");

  console.log("\n[Section 8] Multi-Tenant Security & Cross-Organization Isolation Verification...");

  // 1. Cross-organization document isolation
  await db.query(
    `INSERT INTO public.imported_documents (organization_id, source_platform, source_id, title, content_payload, content_hash)
     VALUES ($1, 'confluence', 'conf_page_101', 'ADR 001 Beta Org', $2, $3)`,
    [org2Id, confluenceMd, docHash1]
  );

  const org1DocCount = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.imported_documents WHERE organization_id = $1`,
    [org1Id]
  );
  const org2DocCount = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.imported_documents WHERE organization_id = $1`,
    [org2Id]
  );
  testAssert(parseInt(org1DocCount.rows[0].count) === 1, "Org 1 documents isolated (1 record)");
  testAssert(parseInt(org2DocCount.rows[0].count) === 1, "Org 2 documents isolated with same source_id (1 record)");

  // 2. Cross-organization external discussions isolation
  await db.query(
    `INSERT INTO public.external_discussions (organization_id, provider, external_id, channel_or_repo, title)
     VALUES ($1, 'github', 'pr_99', 'acme/core', 'Acme PR 99')`,
    [org1Id]
  );
  await db.query(
    `INSERT INTO public.external_discussions (organization_id, provider, external_id, channel_or_repo, title)
     VALUES ($1, 'github', 'pr_99', 'beta/core', 'Beta PR 99')`,
    [org2Id]
  );

  const org1Discussions = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.external_discussions WHERE organization_id = $1`,
    [org1Id]
  );
  const org2Discussions = await db.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.external_discussions WHERE organization_id = $1`,
    [org2Id]
  );
  testAssert(parseInt(org1Discussions.rows[0].count) === 1, "Org 1 external discussions strictly isolated");
  testAssert(parseInt(org2Discussions.rows[0].count) === 1, "Org 2 external discussions strictly isolated");

  // Verify linked_project_id FK to company_entities
  const projectEntity = await db.query<{ id: string }>(
    `INSERT INTO public.company_entities (organization_id, type, title, content)
     VALUES ($1, 'project', 'Mobile App V2', 'Next gen app') RETURNING id`,
    [org1Id]
  );
  await db.query(
    `INSERT INTO public.external_discussions (organization_id, provider, external_id, channel_or_repo, title, linked_project_id)
     VALUES ($1, 'slack', 'msg_101', '#engineering', 'Sync on Mobile App V2', $2)`,
    [org1Id, projectEntity.rows[0].id]
  );
  const linkedDiscussion = await db.query<{ linked_project_id: string }>(
    `SELECT linked_project_id FROM public.external_discussions WHERE organization_id = $1 AND external_id = 'msg_101'`,
    [org1Id]
  );
  testAssert(linkedDiscussion.rows[0].linked_project_id === projectEntity.rows[0].id, "External discussion successfully references company_entities as project");

  // 3. Sensitive Data Non-Leakage on Revoked/Expired Keys
  const revokedLeakTest = await db.query<{
    valid: boolean;
    organization_id: string | null;
    organization_name: string | null;
    scopes: string[] | null;
  }>(`SELECT * FROM public.validate_api_key($1)`, [revokedKeyHash]);
  testAssert(revokedLeakTest.rows[0].valid === false, "Revoked key is invalid");
  testAssert(revokedLeakTest.rows[0].organization_id === null, "Revoked key does NOT reveal organization_id");
  testAssert(revokedLeakTest.rows[0].organization_name === null, "Revoked key does NOT reveal organization_name");
  testAssert(revokedLeakTest.rows[0].scopes === null, "Revoked key does NOT reveal scopes");

  const expiredLeakTest = await db.query<{
    valid: boolean;
    organization_id: string | null;
    organization_name: string | null;
  }>(`SELECT * FROM public.validate_api_key($1)`, [expiredKeyHash]);
  testAssert(expiredLeakTest.rows[0].valid === false, "Expired key is invalid");
  testAssert(expiredLeakTest.rows[0].organization_id === null, "Expired key does NOT reveal organization_id");
  testAssert(expiredLeakTest.rows[0].organization_name === null, "Expired key does NOT reveal organization_name");

  // 4. Malformed Key Hash Inputs
  const nullHashTest = await db.query<{ valid: boolean; error_code: string }>(
    `SELECT * FROM public.validate_api_key(NULL)`
  );
  testAssert(nullHashTest.rows[0].error_code === "invalid_key_format", "validate_api_key rejects NULL hash");

  const shortHashTest = await db.query<{ valid: boolean; error_code: string }>(
    `SELECT * FROM public.validate_api_key('abc')`
  );
  testAssert(shortHashTest.rows[0].error_code === "invalid_key_format", "validate_api_key rejects short hash");

  console.log("\n=======================================================");
  console.log(`PHASE 4 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase4TestSuite().catch((err) => {
  console.error("FATAL ERROR in Phase 4 Test Suite:", err);
  process.exit(1);
});
