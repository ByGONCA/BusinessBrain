"use client";

// ==============================================================================
// KogSync: AI Providers and BYOK Credentials Management Tab
// Clearly distinguishes:
// 1. "AI Incluída no KogSync" (Included Platform AI for all eligible plans)
// 2. "As minhas API Keys (BYOK)" (Reserved for Pro and Enterprise plans)
// ==============================================================================

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import {
  listPersonalAICredentialsAction,
  savePersonalAICredentialAction,
  deletePersonalAICredentialAction,
  listOrganizationAICredentialsAction,
  saveOrganizationAICredentialAction,
  deleteOrganizationAICredentialAction,
  testProviderConnectionAction,
  AICredentialDTO,
} from "@/lib/ai/credentials/actions";
import { SupportedProviderId } from "@/lib/ai/types";
import type { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import type { OrganizationWithRole } from "@/lib/organizations/types";
import { SUBSCRIPTION_PLANS, canPlanUseBYOK } from "@/lib/stripe/config";
import { ProviderLogo } from "@/components/dashboard/chat/model-selector-dropdown";

interface ProviderDefinition {
  id: SupportedProviderId;
  displayName: string;
  family: string;
  description: string;
  models: string[];
  docUrl: string;
}

const SUPPORTED_PROVIDERS: ProviderDefinition[] = [
  {
    id: "gemini",
    displayName: "Google Gemini",
    family: "Gemini 2.5",
    description: "Modelos multimodais de alta velocidade e contexto longo (Gemini 2.5 Flash & Pro).",
    models: ["Gemini 2.5 Flash", "Gemini 2.5 Pro", "Gemini 2.0 Flash"],
    docUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai",
    displayName: "OpenAI",
    family: "GPT-4o & o1 / o3",
    description: "Síntese executiva, raciocínio avançado com o3-mini e o1, e análise com GPT-4o.",
    models: ["GPT-4o Mini", "GPT-4o", "o3-mini", "o1"],
    docUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    displayName: "Anthropic Claude",
    family: "Claude 3.5 & 3.7",
    description: "Excelente profundidade analítica, redação e análise estratégica de documentos.",
    models: ["Claude 3.5 Haiku", "Claude 3.5 Sonnet", "Claude 3.7 Sonnet"],
    docUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "deepseek",
    displayName: "DeepSeek",
    family: "DeepSeek V3 & R1",
    description: "Modelos abertos de alto desempenho com raciocínio analítico (DeepSeek R1 e V3).",
    models: ["DeepSeek V3", "DeepSeek R1"],
    docUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    displayName: "Mistral AI",
    family: "Mistral",
    description: "Fornecedor europeu de topo com modelos equilibrados e privacidade estrita.",
    models: ["Mistral Small", "Mistral Large"],
    docUrl: "https://console.mistral.ai/api-keys",
  },
];

interface AIProvidersTabProps {
  entitlement?: OrganizationEntitlement | null;
  activeOrg?: OrganizationWithRole | null;
}

export function AIProvidersTab({ entitlement, activeOrg }: AIProvidersTabProps) {
  const [credentials, setCredentials] = useState<AICredentialDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<SupportedProviderId | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, { valid: boolean; latencyMs?: number; error?: string }>>({});
  const [activeScope, setActiveScope] = useState<"personal" | "org">("personal");
  const [hasOrgPermission, setHasOrgPermission] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const planTier = entitlement?.plan || "starter";
  const isEligibleForBYOK = canPlanUseBYOK(planTier) && !entitlement?.isTrial;
  const currentPlanConfig = SUBSCRIPTION_PLANS[planTier as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.starter;

  useEffect(() => {
    if (isEligibleForBYOK) {
      loadCredentials(activeScope);
    } else {
      setLoading(false);
    }
  }, [activeScope, isEligibleForBYOK]);

  async function loadCredentials(scope: "personal" | "org" = activeScope) {
    setLoading(true);
    setErrorBanner(null);
    try {
      if (scope === "personal") {
        const res = await listPersonalAICredentialsAction();
        if (res.success && res.credentials) {
          setCredentials(res.credentials);
        } else {
          setErrorBanner(res.error || "Falha ao carregar credenciais pessoais.");
        }
      } else {
        const res = await listOrganizationAICredentialsAction();
        if (res.success && res.credentials) {
          setCredentials(res.credentials);
          setHasOrgPermission(true);
        } else if (res.error?.includes("Sem permissão")) {
          setHasOrgPermission(false);
          setCredentials([]);
        } else {
          setErrorBanner(res.error || "Falha ao carregar credenciais do workspace.");
        }
      }
    } catch {
      setErrorBanner(`Falha ao carregar credenciais de IA (${scope === "personal" ? "pessoais" : "do workspace"}).`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveKey(provider: SupportedProviderId) {
    if (!inputKey.trim()) return;
    setSaving(true);
    setErrorBanner(null);

    try {
      const res =
        activeScope === "personal"
          ? await savePersonalAICredentialAction({
              provider,
              label: inputLabel.trim() || `${provider.toUpperCase()} Key`,
              apiKey: inputKey.trim(),
            })
          : await saveOrganizationAICredentialAction({
              provider,
              label: inputLabel.trim() || `${provider.toUpperCase()} Workspace Key`,
              apiKey: inputKey.trim(),
            });

      if (!res.success) {
        setErrorBanner(res.error || "Erro ao guardar chave.");
      } else {
        setEditingProvider(null);
        setInputKey("");
        setInputLabel("");
        await loadCredentials(activeScope);
      }
    } catch {
      setErrorBanner("Erro ao comunicar com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(id: string) {
    const scopeLabel = activeScope === "personal" ? "esta chave pessoal" : "esta chave partilhada do workspace";
    if (!confirm(`Tem a certeza que deseja remover ${scopeLabel} de IA?`)) return;
    try {
      if (activeScope === "personal") {
        await deletePersonalAICredentialAction(id);
      } else {
        await deleteOrganizationAICredentialAction(id);
      }
      await loadCredentials(activeScope);
    } catch {
      setErrorBanner("Erro ao remover credencial.");
    }
  }

  async function handleTestConnection(provider: SupportedProviderId, credId: string) {
    setTestingId(credId);
    try {
      const res = await testProviderConnectionAction({
        provider,
        apiKey: "mock_test_key_validation",
      });
      setTestStatus((prev) => ({
        ...prev,
        [credId]: { valid: res.valid, latencyMs: res.latencyMs, error: res.error },
      }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* SECTION 1: AI INCLUÍDA NO KOGSYNC                                      */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 border-b border-white/[0.08] pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>IA Incluída no KogSync</span>
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium capitalize">
              Plano {currentPlanConfig.name}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            O KogSync disponibiliza os modelos suportados utilizando as credenciais centralizadas da própria plataforma.
            Não precisa de criar contas externas na OpenAI, Anthropic ou Google para utilizar estes modelos.
          </p>
        </div>

        {/* Quota Overview Card */}
        <div className="rounded-xl border border-white/[0.08] bg-card p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium">Quota Mensal de Créditos de IA:</span>
            <span className="font-mono text-white font-semibold">
              {currentPlanConfig.limits.monthlyAICredits.toLocaleString()} créditos / mês
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            O consumo de tokens é contabilizado em créditos ponderados pelo custo do modelo. Modelos rápidos e económicos (como Gemini Flash e GPT-4o Mini) consomem 1x a 2x créditos, enquanto modelos avançados de raciocínio consomem proporcionalmente mais créditos da sua quota.
          </p>
        </div>

        {/* Providers Included Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_PROVIDERS.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/[0.08] bg-card/60 p-3.5 space-y-2 hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProviderLogo provider={p.id} className="h-4 w-4 object-contain" />
                  <span className="text-xs font-semibold text-white">{p.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Incluído no Plano</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">{p.description}</p>
              <div className="text-[10px] text-zinc-500">
                Modelos: <span className="text-zinc-300">{p.models.join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: AS MINHAS API KEYS (BYOK)                                      */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col gap-1 border-b border-white/[0.08] pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-zinc-300" />
              <span>As Minhas API Keys (BYOK)</span>
            </h3>
            {isEligibleForBYOK ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Desbloqueado no {currentPlanConfig.name}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/[0.08] font-medium flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <span>Exclusivo Pro / Enterprise</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Ligue as suas próprias chaves de API para utilizar quota externa dos provedores. O consumo BYOK é faturado diretamente pelo provedor externo e não desconta dos créditos da sua subscrição KogSync.
          </p>
        </div>

        {/* Upgrade Callout for Starter / Trial Plans */}
        {!isEligibleForBYOK ? (
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card to-card/50 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Desbloqueie Chaves Próprias (BYOK) com o Plano Pro
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  O seu plano <strong className="text-white">{currentPlanConfig.name}</strong> inclui acesso aos modelos da plataforma com {currentPlanConfig.limits.monthlyAICredits.toLocaleString()} créditos mensais.
                  Para adicionar as suas próprias chaves de API da OpenAI, Anthropic, Google, DeepSeek ou Mistral e utilizar quota externa sem limites da plataforma, atualize para o plano <strong className="text-white">Pro</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Link
                href="/dashboard?settings=billing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
              >
                <span>Fazer Upgrade para o Plano Pro ($79/mês)</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* BYOK Management UI for Pro and Enterprise Plans */
          <div className="space-y-4">
            {/* Scope Selector: Personal vs Workspace */}
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <button
                type="button"
                onClick={() => {
                  setActiveScope("personal");
                  setEditingProvider(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeScope === "personal"
                    ? "bg-white/[0.1] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                Chaves Pessoais (Individual)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScope("org");
                  setEditingProvider(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeScope === "org"
                    ? "bg-white/[0.1] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                Chaves do Workspace (Equipa)
              </button>
            </div>

            {/* Transparency Disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-1">
                  <span className="font-medium text-amber-200">Faturação Externa das Chaves BYOK:</span>
                  <p className="text-zinc-300">
                    Ao utilizar as suas chaves próprias, as chamadas são debitadas na sua conta externa com o provedor (OpenAI, Anthropic, Google, etc.). O KogSync não debita créditos da plataforma em chamadas BYOK e nunca faz fallback silencioso para a chave da plataforma se a sua chave falhar.
                  </p>
                </div>
              </div>
            </div>

            {errorBanner && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorBanner}
              </div>
            )}

            {activeScope === "org" && !hasOrgPermission ? (
              <div className="rounded-xl border border-white/[0.08] bg-card p-6 text-center">
                <p className="text-sm font-medium text-white">Acesso Restrito a Administradores</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Apenas proprietários e administradores do workspace podem configurar credenciais de IA partilhadas da organização.
                </p>
              </div>
            ) : (
              /* Providers BYOK List */
              <div className="space-y-3">
                {SUPPORTED_PROVIDERS.map((provider) => {
                  const cred = credentials.find((c) => c.provider === provider.id);
                  const isEditing = editingProvider === provider.id;
                  const status = cred ? testStatus[cred.id] : null;

                  return (
                    <div
                      key={provider.id}
                      className="rounded-xl border border-white/[0.08] bg-card p-4 transition-colors hover:border-white/[0.12]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ProviderLogo provider={provider.id} className="h-4 w-4 object-contain" />
                            <span className="font-medium text-white">{provider.displayName}</span>
                            <span className="text-[11px] text-zinc-400">({provider.family})</span>
                            {cred ? (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[11px]">Chave Própria Ativa</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                                <span className="text-[11px]">Sem Chave BYOK</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">{provider.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={provider.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                          >
                            <span>Obter Chave</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>

                          {cred ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTestConnection(provider.id, cred.id)}
                                disabled={testingId === cred.id}
                                className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-surface-secondary px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/[0.04] cursor-pointer"
                              >
                                <RefreshCw className={`h-3 w-3 ${testingId === cred.id ? "animate-spin" : ""}`} />
                                <span>{testingId === cred.id ? "A testar..." : "Testar"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteKey(cred.id)}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                                title="Remover Chave"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProvider(provider.id);
                                setInputKey("");
                                setInputLabel(`${provider.displayName} Pessoal`);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white hover:bg-white/[0.10] cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Adicionar Chave</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status and Key Details */}
                      {cred && (
                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
                          <div className="flex items-center gap-2">
                            <Key className="h-3 w-3 text-zinc-400" />
                            <span>Prefixo Seguro: <code className="text-zinc-300 font-mono">{cred.keyPrefix}</code></span>
                            <span>• {cred.label}</span>
                          </div>
                          {status && (
                            <div className="flex items-center gap-1">
                              {status.valid ? (
                                <span className="text-emerald-400">Ligação bem sucedida ({status.latencyMs}ms)</span>
                              ) : (
                                <span className="text-rose-400">Erro na ligação: {status.error}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Add Key Form Inline */}
                      {isEditing && (
                        <div className="mt-4 space-y-3 rounded-lg border border-white/[0.06] bg-background p-3.5 animate-in fade-in-0 duration-150">
                          <div className="text-xs font-medium text-zinc-200">
                            Adicionar Chave de API para {provider.displayName}
                          </div>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <input
                              type="text"
                              placeholder="Identificador (ex: Minha Chave Pro)"
                              value={inputLabel}
                              onChange={(e) => setInputLabel(e.target.value)}
                              className="rounded-lg border border-white/[0.08] bg-card px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                            <input
                              type="password"
                              placeholder={`Chave API (${provider.id === "gemini" ? "AIzaSy..." : "sk-..."})`}
                              value={inputKey}
                              onChange={(e) => setInputKey(e.target.value)}
                              autoComplete="off"
                              spellCheck={false}
                              className="rounded-lg border border-white/[0.08] bg-card px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingProvider(null)}
                              className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:text-white cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveKey(provider.id)}
                              disabled={saving || !inputKey.trim()}
                              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                            >
                              {saving ? "A validar e guardar..." : "Gravar Chave"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
