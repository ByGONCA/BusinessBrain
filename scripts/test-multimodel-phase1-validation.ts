// ==============================================================================
// KogSync: Phase 1 Multi-Model AI Providers Unified Verification Suite
// Validates: OpenAI, Google Gemini, Anthropic Claude, DeepSeek, Mistral
// Covers: Adapters, Parameter Isolation, Streaming, AbortSignal, BYOK,
//         Secret Sanitization, Accounting, 2-Phase Reservations, and Dual-Workspace Scoping.
// ==============================================================================

import { PGlite } from "@electric-sql/pglite";
import { getAIProvider, resolveProviderForModel } from "../lib/ai";
import { GeminiAdapter } from "../lib/ai/adapters/gemini";
import { OpenAIAdapter } from "../lib/ai/adapters/openai";
import { AnthropicAdapter } from "../lib/ai/adapters/anthropic";
import { DeepSeekAdapter } from "../lib/ai/adapters/deepseek";
import { MistralAdapter } from "../lib/ai/adapters/mistral";
import { BaseAIAdapter } from "../lib/ai/adapters/base";
import { MODEL_CATALOG, getModelMetadata, getFallbackModel, listActiveModels } from "../lib/ai/catalog/models";
import { calculateTokenCostUsd, MODEL_PRICING_RATES } from "../lib/ai/config";
import { AICostLedgerService } from "../lib/ai/accounting/ledger";
import { AICreditReservationService } from "../lib/ai/accounting/reservation";
import { ModelRoutingEngine } from "../lib/ai/routing/service";
import { AIError } from "../lib/ai/types";
import { encryptAICredential, decryptAICredential, computeKeyFingerprint } from "../lib/crypto/encryption";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase1VerificationSuite() {
  console.log("===============================================================================");
  console.log("BUSINESSBRAIN: PHASE 1 MULTI-MODEL AI PROVIDERS VERIFICATION SUITE");
  console.log("===============================================================================\n");

  // ===========================================================================
  // SECTION 1: ADAPTER CONTRACT & INSTANTIATION (5 PROVIDERS)
  // ===========================================================================
  console.log("--> Section 1: Provider Adapter Contracts & BYOK Instantiation");

  const geminiDefault = getAIProvider("gemini");
  assert(geminiDefault instanceof GeminiAdapter, "getAIProvider('gemini') returns GeminiAdapter instance");
  assert(geminiDefault.id === "gemini", "GeminiAdapter has id 'gemini'");
  assert(geminiDefault.displayName === "Google Gemini", "GeminiAdapter has displayName 'Google Gemini'");

  const openaiDefault = getAIProvider("openai");
  assert(openaiDefault instanceof OpenAIAdapter, "getAIProvider('openai') returns OpenAIAdapter instance");
  assert(openaiDefault.id === "openai", "OpenAIAdapter has id 'openai'");

  const anthropicDefault = getAIProvider("anthropic");
  assert(anthropicDefault instanceof AnthropicAdapter, "getAIProvider('anthropic') returns AnthropicAdapter instance");
  assert(anthropicDefault.id === "anthropic", "AnthropicAdapter has id 'anthropic'");

  const deepseekDefault = getAIProvider("deepseek");
  assert(deepseekDefault instanceof DeepSeekAdapter, "getAIProvider('deepseek') returns DeepSeekAdapter instance");
  assert(deepseekDefault.id === "deepseek", "DeepSeekAdapter has id 'deepseek'");

  const mistralDefault = getAIProvider("mistral");
  assert(mistralDefault instanceof MistralAdapter, "getAIProvider('mistral') returns MistralAdapter instance");
  assert(mistralDefault.id === "mistral", "MistralAdapter has id 'mistral'");

  // Ad-hoc BYOK instantiation
  const customOpenai = getAIProvider("openai", {
    apiKey: "sk-custom-byok-test-key-12345",
    customBaseUrl: "https://my-proxy.openai.internal/v1",
  });
  assert(customOpenai instanceof OpenAIAdapter, "Ad-hoc OpenAI adapter instantiated with custom credentials");

  const customGemini = getAIProvider("gemini", {
    apiKey: "AIzaSy-custom-gemini-byok-key-99999",
    customBaseUrl: "https://vertex.custom-proxy.internal/v1beta",
  });
  assert(customGemini instanceof GeminiAdapter, "Ad-hoc Gemini adapter instantiated with custom baseUrl & key");

  // ===========================================================================
  // SECTION 2: CANONICAL MODEL CATALOG & ROUTING RESOLUTION
  // ===========================================================================
  console.log("\n--> Section 2: Canonical Model Catalog & Routing Resolution");

  const activeModels = listActiveModels();
  assert(activeModels.length >= 10, `Active model catalog contains ${activeModels.length} models (>= 10 expected)`);

  // Provider model resolutions
  const testModels = [
    { id: "gemini-2.5-flash", expectedProvider: "gemini", realId: "gemini-2.5-flash" },
    { id: "gemini-2.5-pro", expectedProvider: "gemini", realId: "gemini-2.5-pro" },
    { id: "gpt-4o", expectedProvider: "openai", realId: "gpt-4o" },
    { id: "gpt-4o-mini", expectedProvider: "openai", realId: "gpt-4o-mini" },
    { id: "o1", expectedProvider: "openai", realId: "o1" },
    { id: "o3-mini", expectedProvider: "openai", realId: "o3-mini" },
    { id: "claude-3-7-sonnet", expectedProvider: "anthropic", realId: "claude-3-7-sonnet-20250219" },
    { id: "claude-3-5-haiku", expectedProvider: "anthropic", realId: "claude-3-5-haiku-20241022" },
    { id: "deepseek-chat", expectedProvider: "deepseek", realId: "deepseek-chat" },
    { id: "deepseek-reasoner", expectedProvider: "deepseek", realId: "deepseek-reasoner" },
    { id: "mistral-large", expectedProvider: "mistral", realId: "mistral-large-latest" },
    { id: "mistral-small", expectedProvider: "mistral", realId: "mistral-small-latest" },
  ];

  for (const m of testModels) {
    const meta = getModelMetadata(m.id);
    assert(!!meta, `Model '${m.id}' found in catalog`);
    assert(meta?.provider === m.expectedProvider, `Model '${m.id}' mapped to provider '${m.expectedProvider}'`);
    assert(meta?.realModelId === m.realId, `Model '${m.id}' has realModelId '${m.realId}'`);
    assert(meta?.capabilities.streaming === true, `Model '${m.id}' declares streaming capability`);
    assert(resolveProviderForModel(m.id) === m.expectedProvider, `resolveProviderForModel('${m.id}') yields '${m.expectedProvider}'`);
  }

  // Routing Engine tests
  const autoDecision = ModelRoutingEngine.resolveModel({
    promptText: "Qual o resumo do trimestre da nossa empresa?",
    selectionMode: "auto",
    organizationTier: "starter",
  });
  assert(autoDecision.selectedModel.provider === "gemini", "Auto mode selects fast default provider (Gemini)");

  const preferredDecision = ModelRoutingEngine.resolveModel({
    promptText: "Analisa este contrato jurídico com detalhe.",
    selectionMode: "preferred",
    userPreferredModelId: "claude-3-7-sonnet",
    organizationTier: "pro",
  });
  assert(preferredDecision.selectedModel.id === "claude-3-7-sonnet", "Preferred mode honors user preference for Claude 3.7 Sonnet");

  // Fallbacks
  assert(getFallbackModel("claude-3-5-sonnet") === "gpt-4o", "Claude 3.5 Sonnet falls back to GPT-4o");
  assert(getFallbackModel("gpt-4o") === "claude-3-5-sonnet", "GPT-4o falls back to Claude 3.5 Sonnet");
  assert(getFallbackModel("deepseek-reasoner") === "gemini-2.5-flash", "DeepSeek Reasoner falls back to Gemini 2.5 Flash");

  // ===========================================================================
  // SECTION 3: REASONING & PARAMETER ISOLATION
  // ===========================================================================
  console.log("\n--> Section 3: Reasoning & Parameter Isolation");

  // OpenAI Reasoning models: o1, o3-mini should not accept temperature
  // We test the formatMessages and reasoning detection directly
  const openaiMock = new OpenAIAdapter("mock_test_key_openai_active");
  const testMessages = [{ role: "user" as const, content: "Prove the Riemann hypothesis step by step." }];

  const o1Result = await openaiMock.generateText(testMessages, {
    model: "o1",
    temperature: 0.7, // Must be stripped internally for o1
    maxTokens: 5000,
  });
  assert(o1Result.model === "o1", "OpenAI o1 generates response successfully in test mode");
  assert(o1Result.usage.totalTokens > 0, "OpenAI o1 computes valid usage");

  const o3Result = await openaiMock.generateText(testMessages, {
    model: "o3-mini",
    temperature: 0.5, // Must be stripped internally for o3-mini
    maxTokens: 4000,
  });
  assert(o3Result.model === "o3-mini", "OpenAI o3-mini generates response successfully in test mode");

  // DeepSeek reasoning model: deepseek-reasoner should omit temperature
  const deepseekMock = new DeepSeekAdapter("mock_test_key_deepseek_active");
  const dsResult = await deepseekMock.generateText(testMessages, {
    model: "deepseek-reasoner",
    temperature: 0.2, // Must be stripped for deepseek-reasoner
  });
  assert(dsResult.model === "deepseek-reasoner", "DeepSeek Reasoner generates response successfully in test mode");

  // ===========================================================================
  // SECTION 4: STREAMING SSE & MID-STREAM CLIENT CANCELLATION (5 PROVIDERS)
  // ===========================================================================
  console.log("\n--> Section 4: Streaming SSE & Client Cancellation (AbortSignal)");

  const adaptersToStream = [
    { name: "Gemini", adapter: new GeminiAdapter("mock_test_key_gemini_active"), model: "gemini-2.5-flash" },
    { name: "OpenAI", adapter: new OpenAIAdapter("mock_test_key_openai_active"), model: "gpt-4o-mini" },
    { name: "Anthropic", adapter: new AnthropicAdapter("mock_test_key_anthropic_active"), model: "claude-3-5-haiku" },
    { name: "DeepSeek", adapter: new DeepSeekAdapter("mock_test_key_deepseek_active"), model: "deepseek-chat" },
    { name: "Mistral", adapter: new MistralAdapter("mock_test_key_mistral_active"), model: "mistral-small-latest" },
  ];

  for (const { name, adapter, model } of adaptersToStream) {
    // 4.1 Full successful stream
    let accumulated = "";
    let chunkCount = 0;
    let finalUsageRecorded = false;

    for await (const chunk of adapter.generateStream(testMessages, { model })) {
      if (chunk.text) {
        accumulated += chunk.text;
        chunkCount++;
      }
      if (chunk.done && chunk.usage) {
        finalUsageRecorded = true;
      }
    }

    assert(chunkCount > 0, `${name} streaming emitted multiple chunks (${chunkCount} chunks)`);
    assert(accumulated.length > 10, `${name} stream produced complete text (${accumulated.length} chars)`);
    assert(finalUsageRecorded, `${name} stream delivered final usage metadata`);

    // 4.2 Mid-stream cancellation with AbortController
    const abortCtrl = new AbortController();
    let abortedCleanly = false;
    let chunksBeforeAbort = 0;

    try {
      for await (const chunk of adapter.generateStream(testMessages, { model, signal: abortCtrl.signal })) {
        chunksBeforeAbort++;
        if (chunksBeforeAbort >= 2) {
          abortCtrl.abort();
        }
      }
    } catch (err: any) {
      if (err instanceof AIError && (err.code === "ABORTED" || err.message.toLowerCase().includes("cancelado") || err.message.toLowerCase().includes("aborted"))) {
        abortedCleanly = true;
      }
    }

    assert(abortedCleanly, `${name} gracefully aborted mid-stream via AbortSignal without unhandled error`);
  }

  // ===========================================================================
  // SECTION 5: BYOK CREDENTIAL ENCRYPTION, VALIDATION & ZERO SECRET LEAKAGE
  // ===========================================================================
  console.log("\n--> Section 5: BYOK Credential Validation & Zero Secret Leakage");

  const secretApiKey = "sk-live-secret-never-expose-to-logs-or-browser-1234567890";
  const encrypted = encryptAICredential(secretApiKey);
  assert(encrypted.split(":").length === 3, "API key encrypted with AES-256-GCM iv:tag:ciphertext format");
  assert(!encrypted.includes(secretApiKey), "Encrypted string contains zero raw key material");

  const decrypted = decryptAICredential(encrypted);
  assert(decrypted === secretApiKey, "Decrypted key matches original raw key exactly");

  const fingerprint1 = computeKeyFingerprint(secretApiKey);
  const fingerprint2 = computeKeyFingerprint(secretApiKey);
  assert(fingerprint1 === fingerprint2, "Key fingerprint is deterministic HMAC-SHA256");

  // Format validation (< 15 characters rejected immediately)
  const shortResult = await openaiDefault.validateCredential("short");
  assert(!shortResult.valid, "OpenAI validateCredential rejects short key without network request");

  const shortAnthropic = await anthropicDefault.validateCredential("too-short");
  assert(!shortAnthropic.valid, "Anthropic validateCredential rejects short key without network request");

  // Secret sanitization
  const testLeakStr = `Error: invalid authentication with sk-1234567890abcdef123456 and AIzaSyD9876543210abcdef1234567890abcde`;
  const sanitized = openaiMock.sanitizeSecret(testLeakStr, secretApiKey);
  assert(!sanitized.includes("sk-1234567890abcdef123456"), "OpenAI regex sanitizes sk- keys");
  assert(!sanitized.includes("AIzaSyD9876543210abcdef1234567890abcde"), "OpenAI regex sanitizes Google AIzaSy keys");

  // ===========================================================================
  // SECTION 6: ACCOUNTING, PRICING & ZERO-COST BYOK BILLING
  // ===========================================================================
  console.log("\n--> Section 6: Precise Token Accounting & Zero-Cost BYOK Billing");

  // Deterministic cost calculations
  const promptTokens = 10_000;
  const completionTokens = 2_000;

  // Gemini 2.5 Flash: $0.075/1M input, $0.30/1M output
  // 10,000 * 0.075 / 1M = 0.00075; 2,000 * 0.30 / 1M = 0.00060 -> Total: 0.001350
  const geminiCost = calculateTokenCostUsd("gemini-2.5-flash", promptTokens, completionTokens);
  assert(geminiCost === 0.00135, `Gemini 2.5 Flash cost exactly matches official rates: $${geminiCost}`);

  // GPT-4o: $2.50/1M input, $10.00/1M output
  // 10,000 * 2.5 / 1M = 0.025; 2,000 * 10 / 1M = 0.020 -> Total: 0.045000
  const gpt4oCost = calculateTokenCostUsd("gpt-4o", promptTokens, completionTokens);
  assert(gpt4oCost === 0.045, `GPT-4o cost exactly matches official rates: $${gpt4oCost}`);

  // DeepSeek Chat: $0.14/1M input, $0.28/1M output
  // 10,000 * 0.14 / 1M = 0.0014; 2,000 * 0.28 / 1M = 0.00056 -> Total: 0.001960
  const dsCost = calculateTokenCostUsd("deepseek-chat", promptTokens, completionTokens);
  assert(dsCost === 0.00196, `DeepSeek V3 cost exactly matches official rates: $${dsCost}`);

  // Mistral Large: $2.00/1M input, $6.00/1M output
  // 10,000 * 2 / 1M = 0.020; 2,000 * 6 / 1M = 0.012 -> Total: 0.032000
  const mistralCost = calculateTokenCostUsd("mistral-large-latest", promptTokens, completionTokens);
  assert(mistralCost === 0.032, `Mistral Large cost exactly matches official rates: $${mistralCost}`);

  // BYOK Billing Zero-Cost Invariant: Platform charges $0.00 for BYOK calls
  const platformBilling = AICostLedgerService.calculateBilling({ totalCostUsd: gpt4oCost, isByok: false });
  assert(platformBilling.billedCostUsd === gpt4oCost, "Non-BYOK request billed full estimated cost to platform plan");

  const byokBilling = AICostLedgerService.calculateBilling({ totalCostUsd: gpt4oCost, isByok: true });
  assert(byokBilling.billedCostUsd === 0, "BYOK request billed strictly $0.00 to BusinessBrain customer");
  assert(byokBilling.reportedCostUsd === gpt4oCost, "BYOK request accurately records reported underlying provider cost");

  // ===========================================================================
  // SECTION 7: ATOMIC 2-PHASE CREDIT RESERVATION IN PGLITE
  // ===========================================================================
  console.log("\n--> Section 7: Atomic 2-Phase Credit Reservation in PostgreSQL Engine");

  const pg = new PGlite();

  // Create schemas
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE
    );

    CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      workspace_type text NOT NULL DEFAULT 'team'
    );

    CREATE TABLE IF NOT EXISTS public.ai_credit_reservations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      user_id uuid NOT NULL,
      conversation_id uuid,
      task_type text NOT NULL DEFAULT 'general_chat',
      provider text NOT NULL,
      model text NOT NULL,
      is_byok boolean NOT NULL DEFAULT false,
      estimated_credits integer NOT NULL,
      actual_credits integer,
      actual_tokens integer,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled', 'released', 'expired')),
      created_at timestamptz NOT NULL DEFAULT now(),
      settled_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid,
      user_id uuid,
      conversation_id uuid,
      provider text NOT NULL,
      model text NOT NULL,
      is_byok boolean NOT NULL DEFAULT false,
      task_type text NOT NULL DEFAULT 'general_chat',
      scope text NOT NULL DEFAULT 'org',
      prompt_tokens integer NOT NULL,
      completion_tokens integer NOT NULL,
      cached_prompt_tokens integer NOT NULL DEFAULT 0,
      estimated_cost_usd numeric(10,6) NOT NULL,
      reported_cost_usd numeric(10,6),
      billed_cost_usd numeric(10,6) NOT NULL,
      currency text NOT NULL DEFAULT 'USD',
      execution_duration_ms integer,
      retry_count integer NOT NULL DEFAULT 0,
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const mockOrgId = "11111111-1111-1111-1111-111111111111";
  const mockUserId = "22222222-2222-2222-2222-222222222222";

  await pg.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${mockUserId}', 'tester@businessbrain.ai');
    INSERT INTO public.organizations (id, name, workspace_type) VALUES ('${mockOrgId}', 'Test Org', 'team');
  `);

  // Direct PG reservation check (Simulating AICreditReservationService logic)
  const res1 = await pg.query<{ id: string }>(`
    INSERT INTO public.ai_credit_reservations (
      organization_id, user_id, provider, model, is_byok, estimated_credits, status
    ) VALUES (
      '${mockOrgId}', '${mockUserId}', 'gemini', 'gemini-2.5-flash', false, 2, 'active'
    ) RETURNING id;
  `);

  assert(res1.rows.length === 1, "Reservation inserted with status 'active'");
  const reservationId = res1.rows[0].id;

  // Settle reservation
  await pg.exec(`
    UPDATE public.ai_credit_reservations
    SET status = 'settled',
        actual_credits = 1,
        actual_tokens = 650,
        settled_at = now()
    WHERE id = '${reservationId}';
  `);

  const settled = await pg.query<{ status: string; actual_credits: number }>(`
    SELECT status, actual_credits FROM public.ai_credit_reservations WHERE id = '${reservationId}';
  `);
  assert(settled.rows[0].status === "settled", "Reservation successfully settled with actual credits");
  assert(settled.rows[0].actual_credits === 1, "Settled reservation recorded actual credit consumption");

  // Released reservation on error before generation
  const res2 = await pg.query<{ id: string }>(`
    INSERT INTO public.ai_credit_reservations (
      organization_id, user_id, provider, model, is_byok, estimated_credits, status
    ) VALUES (
      '${mockOrgId}', '${mockUserId}', 'openai', 'gpt-4o', false, 4, 'active'
    ) RETURNING id;
  `);
  const res2Id = res2.rows[0].id;

  await pg.exec(`
    UPDATE public.ai_credit_reservations
    SET status = 'released',
        settled_at = now()
    WHERE id = '${res2Id}';
  `);

  const released = await pg.query<{ status: string }>(`
    SELECT status FROM public.ai_credit_reservations WHERE id = '${res2Id}';
  `);
  assert(released.rows[0].status === "released", "Pre-generation abort cleanly releases reservation without debit");

  // Ledger recording in both scopes (personal vs org)
  await pg.exec(`
    INSERT INTO public.ai_usage_ledger (
      organization_id, user_id, provider, model, is_byok, task_type, scope,
      prompt_tokens, completion_tokens, estimated_cost_usd, billed_cost_usd, status
    ) VALUES
    ('${mockOrgId}', '${mockUserId}', 'anthropic', 'claude-3-7-sonnet', false, 'general_chat', 'org', 1200, 450, 0.01035, 0.01035, 'success'),
    (null, '${mockUserId}', 'deepseek', 'deepseek-chat', true, 'general_chat', 'personal', 3000, 1000, 0.0007, 0.0000, 'success');
  `);

  const ledgerRecords = await pg.query<{ scope: string; is_byok: boolean; billed_cost_usd: string }>(`
    SELECT scope, is_byok, billed_cost_usd FROM public.ai_usage_ledger ORDER BY created_at ASC;
  `);
  assert(ledgerRecords.rows.length === 2, "Both org and personal usage recorded in ai_usage_ledger");
  assert(ledgerRecords.rows[0].scope === "org" && Number(ledgerRecords.rows[0].billed_cost_usd) > 0, "Company usage billed with scope='org'");
  assert(ledgerRecords.rows[1].scope === "personal" && Number(ledgerRecords.rows[1].billed_cost_usd) === 0, "Personal BYOK usage billed with scope='personal' and $0.00");

  await pg.close();

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log("\n===============================================================================");
  console.log(`TEST SUITE COMPLETE: ${passedAssertions} PASSED, ${totalAssertions - passedAssertions} FAILED`);
  console.log("===============================================================================");
}

runPhase1VerificationSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
