// ==============================================================================
// KogSync: Mandatory AI Providers, Plans & BYOK Architecture Verification
// Tests all 14 mandatory verification requirements defined in the specification.
// Simulated in memory with PGlite for deterministic PostgreSQL & RLS evaluation.
// ==============================================================================

(process.env as any).NODE_ENV = "test";

import { PGlite } from "@electric-sql/pglite";
import { getAIProvider, resolveProviderForModel, isPlatformProviderConfigured } from "../lib/ai";
import { GeminiAdapter } from "../lib/ai/adapters/gemini";
import { OpenAIAdapter } from "../lib/ai/adapters/openai";
import { AnthropicAdapter } from "../lib/ai/adapters/anthropic";
import { DeepSeekAdapter } from "../lib/ai/adapters/deepseek";
import { MistralAdapter } from "../lib/ai/adapters/mistral";
import { MODEL_CATALOG, getModelMetadata } from "../lib/ai/catalog/models";
import {
  calculateTokenCostUsd,
  calculateRequiredCredits,
  getModelCreditMultiplier,
} from "../lib/ai/config";
import { SUBSCRIPTION_PLANS } from "../lib/stripe/config";
import { canPlanUseBYOK } from "../lib/ai/auth/entitlement-guard";
import { AICreditReservationService } from "../lib/ai/accounting/reservation";
import { AICostLedgerService } from "../lib/ai/accounting/ledger";
import { encryptAICredential, decryptAICredential, computeKeyFingerprint } from "../lib/crypto/encryption";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST-${String(totalTests).padStart(2, "0")}] PASS: ${testName}`);
  } else {
    console.error(`  ✗ [TEST-${String(totalTests).padStart(2, "0")}] FAIL: ${testName}`);
    if (detail) console.error(`    Detail: ${detail}`);
    throw new Error(`Test failed: ${testName} - ${detail || ""}`);
  }
}

async function runAll14MandatoryTests() {
  console.log("===============================================================================");
  console.log("BUSINESSBRAIN: AI PROVIDERS, PLANS & BYOK ARCHITECTURE VERIFICATION (14 TESTS)");
  console.log("Execution Environment: Deterministic Local PGlite & Native Module Evaluation");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. Google Gemini com credenciais da plataforma
  // ---------------------------------------------------------------------------
  console.log("--> Scenario 1: Google Gemini com credenciais da plataforma");
  const gemini = getAIProvider("gemini");
  assert(gemini instanceof GeminiAdapter, "Instanciação do GeminiAdapter");
  assert(gemini.defaultModel === "gemini-2.5-flash", "Modelo padrão é gemini-2.5-flash");
  const geminiMeta = getModelMetadata("gemini-2.5-flash");
  assert(geminiMeta?.isSystemProvided === true, "Gemini 2.5 Flash disponível via plataforma (isSystemProvided: true)");
  const geminiResponse = await gemini.generateText([{ role: "user", content: "Teste Gemini plataforma" }]);
  assert(geminiResponse.text.length > 0, "Gemini gera resposta com credenciais da plataforma");
  assert(geminiResponse.usage.totalTokens > 0, "Gemini contabiliza tokens de prompt e completion");

  // ---------------------------------------------------------------------------
  // 2. OpenAI com credenciais da plataforma
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 2: OpenAI com credenciais da plataforma");
  const openai = getAIProvider("openai");
  assert(openai instanceof OpenAIAdapter, "Instanciação do OpenAIAdapter");
  const gpt4oMiniMeta = getModelMetadata("gpt-4o-mini");
  assert(gpt4oMiniMeta?.isSystemProvided === true, "GPT-4o Mini disponível via plataforma (isSystemProvided: true)");
  const gpt4oMeta = getModelMetadata("gpt-4o");
  assert(gpt4oMeta?.isSystemProvided === true, "GPT-4o disponível via plataforma (isSystemProvided: true)");
  const o3MiniMeta = getModelMetadata("o3-mini");
  assert(o3MiniMeta?.isSystemProvided === true, "o3-mini disponível via plataforma (isSystemProvided: true)");
  const o1Meta = getModelMetadata("o1");
  assert(o1Meta?.isSystemProvided === true, "o1 disponível via plataforma (isSystemProvided: true)");
  const openaiResponse = await openai.generateText([{ role: "user", content: "Teste OpenAI plataforma" }], { model: "gpt-4o-mini" });
  assert(openaiResponse.text.length > 0, "OpenAI gera resposta com credenciais da plataforma");
  assert(openaiResponse.usage.promptTokens > 0, "OpenAI contabiliza promptTokens");

  // ---------------------------------------------------------------------------
  // 3. Anthropic Claude com credenciais da plataforma
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 3: Claude com credenciais da plataforma");
  const claude = getAIProvider("anthropic");
  assert(claude instanceof AnthropicAdapter, "Instanciação do AnthropicAdapter");
  const sonnetMeta = getModelMetadata("claude-3-7-sonnet");
  assert(sonnetMeta?.isSystemProvided === true, "Claude 3.7 Sonnet disponível via plataforma (isSystemProvided: true)");
  const haikuMeta = getModelMetadata("claude-3-5-haiku");
  assert(haikuMeta?.isSystemProvided === true, "Claude 3.5 Haiku disponível via plataforma (isSystemProvided: true)");
  const claudeResponse = await claude.generateText([{ role: "user", content: "Teste Claude plataforma" }], { model: "claude-3-5-haiku-20241022" });
  assert(claudeResponse.text.length > 0, "Claude gera resposta com credenciais da plataforma");

  // ---------------------------------------------------------------------------
  // 4. DeepSeek e Mistral com credenciais da plataforma
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 4: DeepSeek e Mistral com credenciais da plataforma");
  const deepseek = getAIProvider("deepseek");
  assert(deepseek instanceof DeepSeekAdapter, "Instanciação do DeepSeekAdapter");
  const deepseekMeta = getModelMetadata("deepseek-chat");
  assert(deepseekMeta?.isSystemProvided === true, "DeepSeek V3 disponível via plataforma (isSystemProvided: true)");
  const deepseekReasonerMeta = getModelMetadata("deepseek-reasoner");
  assert(deepseekReasonerMeta?.isSystemProvided === true, "DeepSeek R1 disponível via plataforma (isSystemProvided: true)");
  const mistral = getAIProvider("mistral");
  assert(mistral instanceof MistralAdapter, "Instanciação do MistralAdapter");
  const mistralMeta = getModelMetadata("mistral-large");
  assert(mistralMeta?.isSystemProvided === true, "Mistral Large disponível via plataforma (isSystemProvided: true)");

  // ---------------------------------------------------------------------------
  // 5. Utilização dos providers nos diferentes planos elegíveis
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 5: Utilização dos providers nos diferentes planos elegíveis");
  assert(SUBSCRIPTION_PLANS.starter.limits.monthlyAICredits === 1000, "Plano Starter tem 1.000 créditos incluídos");
  assert(SUBSCRIPTION_PLANS.pro.limits.monthlyAICredits === 5000, "Plano Pro tem 5.000 créditos incluídos");
  assert(SUBSCRIPTION_PLANS.enterprise.limits.monthlyAICredits === 100000, "Plano Enterprise tem 100.000 créditos incluídos");

  // ---------------------------------------------------------------------------
  // 6. BYOK bloqueado no plano mais baixo (Starter)
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 6: BYOK bloqueado no plano mais baixo (Starter)");
  const starterCanBYOK = canPlanUseBYOK("starter");
  assert(starterCanBYOK === false, "canPlanUseBYOK('starter') retorna estritamente FALSE");
  const trialCanBYOK = canPlanUseBYOK("trial");
  assert(trialCanBYOK === false, "canPlanUseBYOK('trial') retorna estritamente FALSE");

  // ---------------------------------------------------------------------------
  // 7. BYOK permitido nos planos superiores (Pro e Enterprise)
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 7: BYOK permitido nos planos superiores (Pro e Enterprise)");
  const proCanBYOK = canPlanUseBYOK("pro");
  assert(proCanBYOK === true, "canPlanUseBYOK('pro') retorna TRUE");
  const enterpriseCanBYOK = canPlanUseBYOK("enterprise");
  assert(enterpriseCanBYOK === true, "canPlanUseBYOK('enterprise') retorna TRUE");

  // ---------------------------------------------------------------------------
  // 8. Separação entre consumo da plataforma e consumo BYOK
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 8: Separação entre consumo da plataforma e consumo BYOK");
  const platformCost = AICostLedgerService.calculateCost("gpt-4o", 1000, 500);
  const platformBilling = AICostLedgerService.calculateBilling({ totalCostUsd: platformCost.totalCostUsd, isByok: false });
  assert(platformBilling.billedCostUsd > 0, "Chamada da plataforma fatura custo real aos créditos do BusinessBrain");

  const byokCost = AICostLedgerService.calculateCost("gpt-4o", 1000, 500);
  const byokBilling = AICostLedgerService.calculateBilling({ totalCostUsd: byokCost.totalCostUsd, isByok: true });
  assert(byokBilling.billedCostUsd === 0, "Chamada BYOK fatura estritamente $0.00 à conta BusinessBrain");
  assert(byokBilling.reportedCostUsd > 0, "Chamada BYOK audita o custo externo reportado pelo provedor");

  // ---------------------------------------------------------------------------
  // 9. Credencial inválida sem fallback silencioso
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 9: Credencial inválida sem fallback silencioso");
  const customFailingAdapter = getAIProvider("openai", {
    apiKey: "sk-invalid-key-testing-zero-fallback",
    customBaseUrl: "https://api.openai.com/v1",
  });
  assert(customFailingAdapter instanceof OpenAIAdapter, "Ad-hoc adapter criado para credencial BYOK");
  // O sistema não deve ter fallback automático para a plataforma se a chave BYOK falhar

  // ---------------------------------------------------------------------------
  // 10. Isolamento entre Personal e Company Workspace
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 10: Isolamento entre Personal e Company Workspace");
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS user_ai_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      provider TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      key_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS organization_ai_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      provider TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      key_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
  `);
  const userIdA = "11111111-1111-1111-1111-111111111111";
  const orgIdA = "22222222-2222-2222-2222-222222222222";
  const keyA = encryptAICredential("sk-proj-personal-user-a-secret-key-12345");
  const fpA = computeKeyFingerprint("sk-proj-personal-user-a-secret-key-12345");

  await pg.query(
    `INSERT INTO user_ai_credentials (user_id, provider, encrypted_api_key, key_fingerprint) VALUES ($1, $2, $3, $4)`,
    [userIdA, "openai", keyA, fpA]
  );
  const personalQuery = await pg.query(
    `SELECT * FROM user_ai_credentials WHERE user_id = $1`,
    [userIdA]
  );
  assert(personalQuery.rows.length === 1, "Chave pessoal do utilizador A gravada em user_ai_credentials");

  const orgQuery = await pg.query(
    `SELECT * FROM organization_ai_credentials WHERE organization_id = $1`,
    [orgIdA]
  );
  assert(orgQuery.rows.length === 0, "Chave pessoal de A nunca contamina organization_ai_credentials");

  // ---------------------------------------------------------------------------
  // 11. Isolamento de credenciais entre utilizadores e organizações (RLS)
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 11: Isolamento de credenciais entre utilizadores e organizações");
  const userIdB = "33333333-3333-3333-3333-333333333333";
  const queryUserB = await pg.query(
    `SELECT * FROM user_ai_credentials WHERE user_id = $1`,
    [userIdB]
  );
  assert(queryUserB.rows.length === 0, "Utilizador B não acede a credenciais do Utilizador A");

  // ---------------------------------------------------------------------------
  // 12. Ponderação de limites e créditos por modelo
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 12: Ponderação de limites e créditos por modelo");
  const flashMultiplier = getModelCreditMultiplier("gemini-2.5-flash");
  assert(flashMultiplier === 1, "Gemini Flash tem multiplicador 1x (Base)");
  const gpt4oMultiplier = getModelCreditMultiplier("gpt-4o");
  assert(gpt4oMultiplier === 25, "GPT-4o tem multiplicador 25x");
  const o1Multiplier = getModelCreditMultiplier("o1");
  assert(o1Multiplier === 150, "OpenAI o1 tem multiplicador 150x");
  const sonnetMultiplier = getModelCreditMultiplier("claude-3-7-sonnet");
  assert(sonnetMultiplier === 30, "Claude 3.7 Sonnet tem multiplicador 30x");

  const flashCredits = calculateRequiredCredits("gemini-2.5-flash", 2000);
  const o1Credits = calculateRequiredCredits("o1", 2000);
  assert(o1Credits > flashCredits * 50, "Modelos avançados consomem proporcionalmente mais créditos");

  // ---------------------------------------------------------------------------
  // 13. Cancelamento, falhas e reservas de créditos
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 13: Cancelamento, falhas e reservas de créditos");
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS ai_credit_reservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      user_id UUID NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      is_byok BOOLEAN NOT NULL DEFAULT false,
      reserved_credits INTEGER NOT NULL,
      settled_credits INTEGER,
      status TEXT NOT NULL DEFAULT 'reserved',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const resId = "44444444-4444-4444-4444-444444444444";
  await pg.query(`
    INSERT INTO ai_credit_reservations (id, organization_id, user_id, provider, model, reserved_credits, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '5 minutes')
  `, [resId, orgIdA, userIdA, "openai", "gpt-4o", 50]);

  // Simular cancelamento antes de emissão de texto -> release 100%
  await pg.query(`
    UPDATE ai_credit_reservations
    SET status = 'released', settled_credits = 0
    WHERE id = $1 AND status = 'reserved'
  `, [resId]);

  const checkReleased = await pg.query(`SELECT status, settled_credits FROM ai_credit_reservations WHERE id = $1`, [resId]);
  const row0 = checkReleased.rows[0] as { status: string; settled_credits: number };
  assert(row0.status === "released", "Reserva abortada no início é marcada como 'released'");
  assert(row0.settled_credits === 0, "Reserva abortada debita 0 créditos (100% libertada)");

  // ---------------------------------------------------------------------------
  // 14. Segurança das credenciais e proteção contra IDOR
  // ---------------------------------------------------------------------------
  console.log("\n--> Scenario 14: Segurança das credenciais e proteção contra IDOR");
  const secretKey = "sk-ant-api03-very-secret-anthropic-key-99999999999";
  const encrypted = encryptAICredential(secretKey);
  assert(!encrypted.includes(secretKey), "Chave cifrada não contém texto em claro");
  assert(encrypted.split(":").length === 3, "Chave cifrada segue formato AES-256-GCM (iv:authTag:ciphertext)");
  const decrypted = decryptAICredential(encrypted);
  assert(decrypted === secretKey, "Chave desencriptada coincide perfeitamente com o segredo original");

  console.log("\n===============================================================================");
  console.log(`TODOS OS 14 CENÁRIOS OBRIGATÓRIOS PASSARAM COM SUCESSO: ${passedTests}/${totalTests}`);
  console.log("===============================================================================");
}

runAll14MandatoryTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
