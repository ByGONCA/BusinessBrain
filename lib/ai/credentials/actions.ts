"use server";

// ==============================================================================
// Company Brain: AI Provider & BYOK Credentials Server Actions
// Supports both personal (individual) and organization-level credentials
// with AES-256-GCM encryption, HMAC-SHA256 fingerprinting and zero secret leakage.
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encryptAICredential, computeKeyFingerprint } from "@/lib/crypto/encryption";
import { getAIProvider, resolveProviderForModel } from "../index";
import { SupportedProviderId } from "../types";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export interface AICredentialDTO {
  id: string;
  provider: SupportedProviderId;
  label: string;
  keyPrefix: string;
  status: "active" | "invalid" | "quota_exceeded" | "revoked";
  isDefault: boolean;
  customBaseUrl?: string | null;
  lastTestedAt?: string | null;
  lastErrorMessage?: string | null;
  createdAt: string;
  scope: "personal" | "org";
}

/**
 * Lists personal credentials of the authenticated user.
 */
export async function listPersonalAICredentialsAction(): Promise<{
  success: boolean;
  credentials?: AICredentialDTO[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autenticação necessária." };
  }

  const { data, error } = await supabase
    .from("user_ai_credentials")
    .select("id, provider, label, key_prefix, status, is_default, custom_base_url, last_tested_at, last_error_message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: "Erro ao consultar credenciais pessoais." };
  }

  const credentials: AICredentialDTO[] = (data || []).map((row: any) => ({
    id: row.id,
    provider: row.provider as SupportedProviderId,
    label: row.label,
    keyPrefix: row.key_prefix,
    status: row.status,
    isDefault: row.is_default,
    customBaseUrl: row.custom_base_url,
    lastTestedAt: row.last_tested_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    scope: "personal",
  }));

  return { success: true, credentials };
}

/**
 * Saves or rotates a personal AI credential.
 */
export async function savePersonalAICredentialAction(params: {
  provider: SupportedProviderId;
  label: string;
  apiKey: string;
  customBaseUrl?: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autenticação necessária." };
  }

  const rl = await rateLimit("save-ai-key", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    return { success: false, error: "Demasiadas tentativas de alteração de chaves. Aguarde um momento." };
  }

  const cleanKey = params.apiKey.trim();
  if (cleanKey.length < 15) {
    return { success: false, error: "Chave de API inválida ou demasiado curta." };
  }

  // 1. Safe connection test
  const adapter = getAIProvider(params.provider);
  const testResult = await adapter.validateCredential(cleanKey, params.customBaseUrl);
  if (!testResult.valid) {
    return {
      success: false,
      error: `A validação da chave falhou com o fornecedor ${adapter.displayName}: ${testResult.error || "Chave rejeitada."}`,
    };
  }

  // 2. Encrypt with AES-256-GCM JIT
  const encryptedKey = encryptAICredential(cleanKey);
  const keyFingerprint = computeKeyFingerprint(cleanKey);
  const keyPrefix = cleanKey.slice(0, 7) + "••••";

  // 3. Insert or update in user_ai_credentials
  const { data, error } = await supabase
    .from("user_ai_credentials")
    .upsert(
      {
        user_id: user.id,
        provider: params.provider,
        label: params.label.trim(),
        key_prefix: keyPrefix,
        encrypted_api_key: encryptedKey,
        key_fingerprint: keyFingerprint,
        status: "active",
        is_default: Boolean(params.isDefault),
        custom_base_url: params.customBaseUrl?.trim() || null,
        last_tested_at: new Date().toISOString(),
        last_error_message: null,
      },
      { onConflict: "user_id,provider,key_fingerprint" }
    )
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Erro ao gravar credencial pessoal na base de dados." };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, credentialId: data.id };
}

/**
 * Removes a personal AI credential.
 */
export async function deletePersonalAICredentialAction(
  credentialId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autenticação necessária." };
  }

  const { error } = await supabase
    .from("user_ai_credentials")
    .delete()
    .eq("id", credentialId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "Erro ao remover a credencial pessoal." };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

function sanitizeErrorMessage(msg: string | undefined, secret?: string): string | undefined {
  if (!msg) return msg;
  let clean = msg;
  if (secret && secret.trim()) {
    clean = clean.split(secret.trim()).join("[REDACTED_API_KEY]");
  }
  clean = clean.replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]");
  clean = clean.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
  clean = clean.replace(/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]");
  return clean;
}

/**
 * Tests connection with a specific provider using an ad-hoc key.
 */
export async function testProviderConnectionAction(params: {
  provider: SupportedProviderId;
  apiKey: string;
  customBaseUrl?: string;
}): Promise<{ valid: boolean; latencyMs?: number; error?: string }> {
  const startTime = Date.now();

  try {
    // 1. Strict parameter validation
    const supportedProviders: SupportedProviderId[] = [
      "gemini",
      "openai",
      "anthropic",
      "deepseek",
      "mistral",
      "qwen",
      "openrouter",
      "groq",
      "custom_openai_compatible",
    ];

    if (!params.provider || !supportedProviders.includes(params.provider)) {
      return { valid: false, error: "Fornecedor de IA não suportado." };
    }

    if (!params.apiKey || typeof params.apiKey !== "string" || params.apiKey.trim().length < 10) {
      return { valid: false, error: "Formato de chave de API inválido ou demasiado curto." };
    }

    // 2. Mandatory server-side authentication check
    let user: any = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      // In offline tests outside of Next.js request store
    }

    if (!user && process.env.NODE_ENV !== "test") {
      return {
        valid: false,
        error: "Autenticação necessária para testar chaves de fornecedores.",
      };
    }

    // 3. Rate limiting (max mutations preset)
    if (user) {
      const rl = await rateLimit("test-provider-key", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
      if (!rl.success) {
        return {
          valid: false,
          error: "Demasiados testes de ligação. Aguarde um momento antes de tentar novamente.",
        };
      }
    }

    const adapter = getAIProvider(params.provider);
    const result = await adapter.validateCredential(params.apiKey, params.customBaseUrl);
    const latencyMs = Date.now() - startTime;

    return {
      valid: result.valid,
      latencyMs,
      error: sanitizeErrorMessage(result.error, params.apiKey),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      latencyMs: Date.now() - startTime,
      error: sanitizeErrorMessage(msg, params.apiKey),
    };
  }
}
