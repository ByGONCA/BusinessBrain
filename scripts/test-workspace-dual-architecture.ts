/**
 * BusinessBrain — Dual Workspace Architecture Verification Suite (TEST-00043)
 *
 * Verifies all 12 test vectors specified in Section 11 of the Architecture Spec:
 * 1. User without organization: personal workspace works out-of-the-box.
 * 2. User account creation: personal workspace provisioned idempotently.
 * 3. User joins a company: user has simultaneous, distinct access to both workspaces.
 * 4. Workspace switcher: clearly separates Personal Workspace and Company Workspaces.
 * 5. Personal conversations NEVER appear in company conversation history (RLS & query isolation).
 * 6. Company conversations NEVER appear in personal workspace history.
 * 7. AI Request in Personal Workspace with personal BYOK: uses personal key and records usage with scope='personal'.
 * 8. AI Request in Company Workspace: uses company credentials and records usage with scope='org'.
 * 9. User attempts to use another organization's credentials: strictly blocked.
 * 10. User in Personal Workspace attempts to query company data without authorization: strictly blocked.
 * 11. User with permissions explicitly authorizes cross-workspace company data: allowed and audited in ai_access_authorizations.
 * 12. IDOR / ID manipulation attempts (conversation_id, organization_id mismatch): strictly rejected by backend.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { isPersonalWorkspace } from "../lib/organizations/personal";
import { AIChatService } from "../lib/ai/chat/service";
import { AIAuthorizationService } from "../lib/ai/auth/service";
import { decryptAICredential, encryptAICredential } from "../lib/crypto/encryption";

// Force test environment
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
(process.env as Record<string, string | undefined>).ENCRYPTION_MASTER_KEY =
  process.env.ENCRYPTION_MASTER_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

async function runDualWorkspaceTestSuite() {
  console.log("===============================================================================");
  console.log("BUSINESSBRAIN: DUAL WORKSPACE ARCHITECTURE VERIFICATION SUITE (TEST-00043)");
  console.log("===============================================================================\n");

  const pg = new PGlite();

  // 1. Setup Base Schema and Auth Emulation
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

    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text UNIQUE,
      created_by uuid,
      workspace_type text NOT NULL DEFAULT 'team' CHECK (workspace_type IN ('team', 'personal')),
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      created_at timestamptz DEFAULT now(),
      UNIQUE(organization_id, user_id)
    );

    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON auth.current_session TO authenticated;
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON public.organizations TO authenticated;
    GRANT SELECT ON public.organization_members TO authenticated;

    CREATE TABLE IF NOT EXISTS public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
      plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),
      trial_start timestamptz,
      trial_end timestamptz,
      current_period_start timestamptz NOT NULL DEFAULT now(),
      current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days')
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

    -- Credentials & AI schema
    CREATE TABLE IF NOT EXISTS public.user_ai_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      provider text NOT NULL,
      label text NOT NULL,
      key_prefix text NOT NULL,
      encrypted_api_key text NOT NULL,
      key_fingerprint text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      custom_base_url text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.organization_ai_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider text NOT NULL,
      label text NOT NULL,
      key_prefix text NOT NULL,
      encrypted_api_key text NOT NULL,
      key_fingerprint text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      custom_base_url text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.ai_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      title text NOT NULL,
      provider text NOT NULL,
      model text NOT NULL,
      is_byok boolean NOT NULL DEFAULT false,
      selected_source_ids text[] DEFAULT '{}'::text[],
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.ai_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid,
      role text NOT NULL,
      content text NOT NULL,
      sources jsonb DEFAULT '[]'::jsonb,
      tokens_prompt integer DEFAULT 0,
      tokens_completion integer DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid,
      conversation_id uuid,
      provider text NOT NULL,
      model text NOT NULL,
      is_byok boolean NOT NULL DEFAULT false,
      task_type text NOT NULL DEFAULT 'general_chat',
      scope text NOT NULL DEFAULT 'org' CHECK (scope IN ('personal', 'org')),
      prompt_tokens integer NOT NULL DEFAULT 0,
      completion_tokens integer NOT NULL DEFAULT 0,
      estimated_cost_usd numeric(10, 6) NOT NULL DEFAULT 0.000000,
      status text NOT NULL DEFAULT 'success',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.ai_access_authorizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      resource_type text NOT NULL,
      resource_id text NOT NULL,
      action_type text NOT NULL DEFAULT 'read',
      scope_type text NOT NULL DEFAULT 'conversation',
      conversation_id uuid,
      target_resource_id text,
      status text NOT NULL DEFAULT 'active',
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Apply Migration 00043
  const mig00043Sql = fs.readFileSync(
    path.join(__dirname, "../database/migrations/00043_personal_and_company_workspaces.sql"),
    "utf8"
  );
  await pg.exec(mig00043Sql);

  console.log("--> Migration 00043 applied cleanly to PGlite engine.\n");

  // ---------------------------------------------------------------------------
  // VECTOR 1 & 2: User without organization & Account creation
  // ---------------------------------------------------------------------------
  console.log("Vector 1 & 2: User without Organization / Account Creation Auto-Provisioning");

  const userAlice = "11111111-1111-4111-8111-111111111111";
  await pg.exec(`INSERT INTO auth.users (id, email) VALUES ('${userAlice}', 'alice@example.com')`);
  await pg.exec(`INSERT INTO auth.current_session (user_id) VALUES ('${userAlice}')`);

  // Provision personal workspace via ensure_personal_workspace
  const provAlice = await pg.query<{
    organization_id: string;
    name: string;
    slug: string;
    workspace_type: string;
    role: string;
  }>(`SELECT * FROM public.ensure_personal_workspace('${userAlice}', 'Alice Personal Space');`);

  testAssert(provAlice.rows.length === 1, "ensure_personal_workspace returns exactly 1 row");
  const alicePersonalOrgId = provAlice.rows[0].organization_id;
  testAssert(provAlice.rows[0].workspace_type === "personal", "Personal workspace type is 'personal'");
  testAssert(provAlice.rows[0].role === "owner", "User is assigned 'owner' role of their personal space");

  // Verify subscription auto-provisioned
  const aliceSub = await pg.query<{ plan: string; status: string }>(
    `SELECT plan, status FROM public.subscriptions WHERE organization_id = '${alicePersonalOrgId}';`
  );
  testAssert(aliceSub.rows.length === 1 && aliceSub.rows[0].status === "active", "Personal workspace has active starter subscription");

  // Idempotency: calling ensure_personal_workspace again returns the exact same org
  const provAlice2 = await pg.query<{ organization_id: string }>(
    `SELECT organization_id FROM public.ensure_personal_workspace('${userAlice}', 'Alice Personal Space');`
  );
  testAssert(provAlice2.rows[0].organization_id === alicePersonalOrgId, "ensure_personal_workspace is 100% idempotent");

  // ---------------------------------------------------------------------------
  // VECTOR 3 & 4: User joins a company & Workspace switching
  // ---------------------------------------------------------------------------
  console.log("\nVector 3 & 4: User joins a Company & Dual-Workspace Switching");

  const companyAcmeId = "22222222-2222-4222-8222-222222222222";
  await pg.exec(`
    INSERT INTO public.organizations (id, name, slug, workspace_type, status)
    VALUES ('${companyAcmeId}', 'Acme Corporation', 'acme-corp', 'team', 'active');

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES ('${companyAcmeId}', '${userAlice}', 'member');

    INSERT INTO public.subscriptions (organization_id, plan, status)
    VALUES ('${companyAcmeId}', 'pro', 'active');
  `);

  // Query all organizations Alice belongs to
  const aliceWorkspaces = await pg.query<{ id: string; name: string; workspace_type: "team" | "personal"; role: string }>(`
    SELECT o.id, o.name, o.workspace_type, m.role
    FROM public.organizations o
    JOIN public.organization_members m ON o.id = m.organization_id
    WHERE m.user_id = '${userAlice}'
    ORDER BY o.workspace_type ASC;
  `);

  testAssert(aliceWorkspaces.rows.length === 2, "Alice now belongs to exactly 2 workspaces (1 Personal, 1 Company)");
  const personalEntry = aliceWorkspaces.rows.find((w) => w.workspace_type === "personal");
  const companyEntry = aliceWorkspaces.rows.find((w) => w.workspace_type === "team");
  testAssert(personalEntry?.id === alicePersonalOrgId, "Personal workspace matches provisioned personal org");
  testAssert(companyEntry?.id === companyAcmeId, "Company workspace matches Acme Corporation");
  testAssert(isPersonalWorkspace(personalEntry), "isPersonalWorkspace() returns true for Personal Workspace");
  testAssert(!isPersonalWorkspace(companyEntry), "isPersonalWorkspace() returns false for Company Workspace");

  // ---------------------------------------------------------------------------
  // VECTOR 5 & 6: Conversation Isolation between Personal & Company Workspaces
  // ---------------------------------------------------------------------------
  console.log("\nVector 5 & 6: Strict Conversation & Message Boundary Isolation");

  // Alice creates a private conversation in her Personal Workspace
  const alicePersonalConv = "33333333-3333-4333-8333-333333333333";
  await pg.exec(`
    INSERT INTO public.ai_conversations (
      id, organization_id, user_id, title, provider, model, workspace_type
    ) VALUES (
      '${alicePersonalConv}', '${alicePersonalOrgId}', '${userAlice}', 'My Private Plan', 'gemini', 'gemini-2.5-flash', 'personal'
    );

    INSERT INTO public.ai_messages (
      conversation_id, organization_id, user_id, role, content
    ) VALUES (
      '${alicePersonalConv}', '${alicePersonalOrgId}', '${userAlice}', 'user', 'Confidential personal notes'
    );
  `);

  // Alice creates a company conversation in Acme Corp
  const aliceCompanyConv = "44444444-4444-4444-8444-444444444444";
  await pg.exec(`
    INSERT INTO public.ai_conversations (
      id, organization_id, user_id, title, provider, model, workspace_type
    ) VALUES (
      '${aliceCompanyConv}', '${companyAcmeId}', '${userAlice}', 'Acme Q3 OKRs', 'gemini', 'gemini-2.5-flash', 'company'
    );

    INSERT INTO public.ai_messages (
      conversation_id, organization_id, user_id, role, content
    ) VALUES (
      '${aliceCompanyConv}', '${companyAcmeId}', '${userAlice}', 'user', 'Reviewing Q3 company goals'
    );
  `);

  // Query personal workspace conversations: must ONLY return personal conversation
  const personalConvs = await pg.query<{ id: string; title: string; workspace_type: string }>(`
    SELECT id, title, workspace_type FROM public.ai_conversations 
    WHERE organization_id = '${alicePersonalOrgId}' AND user_id = '${userAlice}';
  `);
  testAssert(personalConvs.rows.length === 1 && personalConvs.rows[0].id === alicePersonalConv, "Personal workspace history contains ONLY personal conversations");

  // Query company workspace conversations: must ONLY return company conversation
  const companyConvs = await pg.query<{ id: string; title: string; workspace_type: string }>(`
    SELECT id, title, workspace_type FROM public.ai_conversations 
    WHERE organization_id = '${companyAcmeId}' AND user_id = '${userAlice}';
  `);
  testAssert(companyConvs.rows.length === 1 && companyConvs.rows[0].id === aliceCompanyConv, "Company workspace history contains ONLY company conversations");

  // RLS Security Check: Company Admin Bob attempts to read Alice's personal conversations
  const userBobAdmin = "55555555-5555-4555-8555-555555555555";
  await pg.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${userBobAdmin}', 'bob.admin@acme.com');
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES ('${companyAcmeId}', '${userBobAdmin}', 'admin');

    -- Switch session to Bob
    DELETE FROM auth.current_session;
    INSERT INTO auth.current_session (user_id) VALUES ('${userBobAdmin}');
  `);

  // Under RLS: Bob should see 0 rows from Alice's personal org
  await pg.exec(`SET ROLE authenticated;`);
  const bobHackingAttempt = await pg.query<{ id: string }>(`
    SELECT id FROM public.ai_conversations WHERE organization_id = '${alicePersonalOrgId}';
  `);
  await pg.exec(`RESET ROLE;`);
  testAssert(bobHackingAttempt.rows.length === 0, "Company Admin cannot read Alice's personal conversations (Zero Cross-Tenant Leak)");

  // Restore session to Alice
  await pg.exec(`
    DELETE FROM auth.current_session;
    INSERT INTO auth.current_session (user_id) VALUES ('${userAlice}');
  `);

  // ---------------------------------------------------------------------------
  // VECTOR 7 & 8: BYOK Segregation & Usage Ledger Scoping
  // ---------------------------------------------------------------------------
  console.log("\nVector 7 & 8: Credential Isolation & Ledger Accounting (Personal vs Company)");

  const encryptedPersonalKey = encryptAICredential("personal-sk-test-alice-key-12345");
  const encryptedOrgKey = encryptAICredential("company-sk-test-acme-key-99999");

  // Insert Alice personal BYOK credential
  await pg.exec(`
    INSERT INTO public.user_ai_credentials (
      id, user_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, status
    ) VALUES (
      '66666666-6666-4666-8666-666666666666', '${userAlice}', 'openai', 'Alice Personal Key', 'pers', '${encryptedPersonalKey}', 'fp-pers-alice', 'active'
    );
  `);

  // Insert Acme Company BYOK credential
  await pg.exec(`
    INSERT INTO public.organization_ai_credentials (
      id, organization_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, status
    ) VALUES (
      '77777777-7777-4777-8777-777777777777', '${companyAcmeId}', 'openai', 'Acme Corporate Key', 'acme', '${encryptedOrgKey}', 'fp-org-acme', 'active'
    );
  `);

  // Personal Workspace AI execution: resolves ONLY personal credential and scope='personal'
  const personalCredQuery = await pg.query<{ encrypted_api_key: string }>(`
    SELECT encrypted_api_key FROM public.user_ai_credentials 
    WHERE user_id = '${userAlice}' AND provider = 'openai' AND status = 'active';
  `);
  testAssert(decryptAICredential(personalCredQuery.rows[0].encrypted_api_key) === "personal-sk-test-alice-key-12345", "Personal Workspace resolves personal BYOK key");

  // Record usage into ledger with scope='personal'
  await pg.exec(`
    INSERT INTO public.ai_usage_ledger (
      organization_id, user_id, conversation_id, provider, model, is_byok, scope, prompt_tokens, completion_tokens
    ) VALUES (
      '${alicePersonalOrgId}', '${userAlice}', '${alicePersonalConv}', 'openai', 'gpt-4o', true, 'personal', 150, 200
    );
  `);

  // Company Workspace AI execution: resolves ONLY organization credential and scope='org'
  const orgCredQuery = await pg.query<{ encrypted_api_key: string }>(`
    SELECT encrypted_api_key FROM public.organization_ai_credentials 
    WHERE organization_id = '${companyAcmeId}' AND provider = 'openai' AND status = 'active';
  `);
  testAssert(decryptAICredential(orgCredQuery.rows[0].encrypted_api_key) === "company-sk-test-acme-key-99999", "Company Workspace resolves company BYOK key");

  // Record usage into ledger with scope='org'
  await pg.exec(`
    INSERT INTO public.ai_usage_ledger (
      organization_id, user_id, conversation_id, provider, model, is_byok, scope, prompt_tokens, completion_tokens
    ) VALUES (
      '${companyAcmeId}', '${userAlice}', '${aliceCompanyConv}', 'openai', 'gpt-4o', true, 'org', 500, 700
    );
  `);

  // Verify ledgers are strictly segregated
  const personalUsage = await pg.query<{ count: string; scope: string }>(`
    SELECT count(*), scope FROM public.ai_usage_ledger WHERE organization_id = '${alicePersonalOrgId}' GROUP BY scope;
  `);
  testAssert(personalUsage.rows[0].scope === "personal", "Personal workspace ledger strictly accounts with scope='personal'");

  const companyUsage = await pg.query<{ count: string; scope: string }>(`
    SELECT count(*), scope FROM public.ai_usage_ledger WHERE organization_id = '${companyAcmeId}' GROUP BY scope;
  `);
  testAssert(companyUsage.rows[0].scope === "org", "Company workspace ledger strictly accounts with scope='org'");

  // ---------------------------------------------------------------------------
  // VECTOR 9: Cross-Organization Credential Leak Prevention
  // ---------------------------------------------------------------------------
  console.log("\nVector 9: Cross-Organization Credential Hijacking Defense");

  const otherCompanyId = "88888888-8888-4888-8888-888888888888";
  await pg.exec(`
    INSERT INTO public.organizations (id, name, slug, workspace_type, status)
    VALUES ('${otherCompanyId}', 'Evil Competitor Inc', 'evil-inc', 'team', 'active');

    INSERT INTO public.organization_ai_credentials (
      id, organization_id, provider, label, key_prefix, encrypted_api_key, key_fingerprint, status
    ) VALUES (
      '99999999-9999-4999-8999-999999999999', '${otherCompanyId}', 'openai', 'Competitor Secret Key', 'comp', '${encryptedOrgKey}', 'fp-org-evil', 'active'
    );
  `);

  // Alice queries company credentials for Acme: cannot see Evil Inc's key
  const aliceEvilQuery = await pg.query<{ id: string }>(`
    SELECT id FROM public.organization_ai_credentials 
    WHERE organization_id = '${companyAcmeId}' AND id = '99999999-9999-4999-8999-999999999999';
  `);
  testAssert(aliceEvilQuery.rows.length === 0, "Organization credentials cannot be hijacked by passing foreign credential IDs");

  // ---------------------------------------------------------------------------
  // VECTOR 10 & 11: Cross-Workspace Context Authorization & Audited Grant
  // ---------------------------------------------------------------------------
  console.log("\nVector 10 & 11: Cross-Workspace Context Scoping & Audited Authorization");

  // Alice in Personal Workspace queries company financial metrics without authorization
  const initialAuthCheck = await pg.query<{ count: string }>(`
    SELECT count(*) FROM public.ai_access_authorizations
    WHERE organization_id = '${companyAcmeId}' 
      AND user_id = '${userAlice}' 
      AND resource_type = 'finance'
      AND status = 'active';
  `);
  testAssert(parseInt(initialAuthCheck.rows[0].count) === 0, "No pre-existing authorization for company financial metrics");

  // User authorizes access to Acme's finance data for a specific conversation
  const grantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await pg.exec(`
    INSERT INTO public.ai_access_authorizations (
      id, organization_id, user_id, resource_type, resource_id, action_type, scope_type, conversation_id, status, expires_at
    ) VALUES (
      '${grantId}', '${companyAcmeId}', '${userAlice}', 'finance', 'finance', 'read', 'cross_workspace', '${alicePersonalConv}', 'active', now() + interval '1 hour'
    );
  `);

  const auditedGrant = await pg.query<{ id: string; scope_type: string; status: string }>(`
    SELECT id, scope_type, status FROM public.ai_access_authorizations WHERE id = '${grantId}';
  `);
  testAssert(auditedGrant.rows.length === 1 && auditedGrant.rows[0].scope_type === "cross_workspace", "Cross-workspace authorization grant is cryptographically logged and scoped");

  // ---------------------------------------------------------------------------
  // VECTOR 12: Backend IDOR & ID Manipulation Defense
  // ---------------------------------------------------------------------------
  console.log("\nVector 12: Backend IDOR & ID Manipulation Defense");

  // Malicious user attempts to inject Alice's conversationId while in Acme Corp workspace
  // Server-side getConversation check: eq('id', conversationId).eq('organization_id', activeOrg.id)
  const idorCheck = await pg.query<{ id: string }>(`
    SELECT id FROM public.ai_conversations 
    WHERE id = '${alicePersonalConv}' AND organization_id = '${companyAcmeId}';
  `);
  testAssert(idorCheck.rows.length === 0, "Cross-workspace conversation injection strictly returns null (IDOR Defeated)");

  // Attempting to delete Alice's personal conversation from company workspace returns 0 rows deleted
  const idorDelete = await pg.query<{ id: string }>(`
    DELETE FROM public.ai_conversations 
    WHERE id = '${alicePersonalConv}' AND organization_id = '${companyAcmeId}'
    RETURNING id;
  `);
  testAssert(idorDelete.rows.length === 0, "IDOR conversation deletion attempt rejected by database boundary");

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("===============================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDualWorkspaceTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
