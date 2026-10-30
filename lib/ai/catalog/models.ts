// ==============================================================================
// Company Brain: Centralized Model Catalog Data
// Verified official pricing, limits, and capabilities as of 2026-10-29.
// ==============================================================================

import { ModelMetadata } from "./types";

export const MODEL_CATALOG: ModelMetadata[] = [
  // Google Gemini
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    realModelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    family: "Gemini 2.5",
    status: "available",
    latencyProfile: "ultra_low",
    isSystemProvided: true,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 15,
      rateLimitTpmDefault: 1_000_000,
    },
    pricing: {
      inputPerMillionUsd: 0.075,
      outputPerMillionUsd: 0.30,
      cachedInputPerMillionUsd: 0.01875,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 10, recommendedTier: "trial" },
      business_analysis: { score: 9, recommendedTier: "starter" },
      financial_analysis: { score: 8, recommendedTier: "starter" },
      document_analysis: { score: 9, recommendedTier: "starter" },
      page_generation: { score: 10, recommendedTier: "starter" },
      complex_reasoning: { score: 7, recommendedTier: "pro" },
    },
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    realModelId: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    family: "Gemini 2.5",
    status: "available",
    latencyProfile: "balanced",
    isSystemProvided: true,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: true,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 2_097_152,
      maxOutputTokens: 65_536,
      rateLimitRpmDefault: 10,
      rateLimitTpmDefault: 4_000_000,
    },
    pricing: {
      inputPerMillionUsd: 1.25,
      outputPerMillionUsd: 5.00,
      cachedInputPerMillionUsd: 0.3125,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "pro" },
      business_analysis: { score: 10, recommendedTier: "pro" },
      financial_analysis: { score: 10, recommendedTier: "pro" },
      document_analysis: { score: 10, recommendedTier: "pro" },
      page_generation: { score: 9, recommendedTier: "pro" },
      complex_reasoning: { score: 10, recommendedTier: "pro" },
    },
  },
  {
    id: "gemini-2.0-flash",
    provider: "gemini",
    realModelId: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    family: "Gemini 2.0",
    status: "available",
    latencyProfile: "ultra_low",
    isSystemProvided: true,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 1_048_576,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 15,
      rateLimitTpmDefault: 1_000_000,
    },
    pricing: {
      inputPerMillionUsd: 0.10,
      outputPerMillionUsd: 0.40,
      cachedInputPerMillionUsd: 0.025,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "trial" },
      business_analysis: { score: 8, recommendedTier: "starter" },
      financial_analysis: { score: 8, recommendedTier: "starter" },
      document_analysis: { score: 8, recommendedTier: "starter" },
      page_generation: { score: 9, recommendedTier: "starter" },
      complex_reasoning: { score: 7, recommendedTier: "starter" },
    },
  },

  // OpenAI
  {
    id: "gpt-4o-mini",
    provider: "openai",
    realModelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    family: "GPT-4o",
    status: "available",
    latencyProfile: "ultra_low",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 128_000,
      maxOutputTokens: 16_384,
      rateLimitRpmDefault: 500,
      rateLimitTpmDefault: 200_000,
    },
    pricing: {
      inputPerMillionUsd: 0.15,
      outputPerMillionUsd: 0.60,
      cachedInputPerMillionUsd: 0.075,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "trial" },
      business_analysis: { score: 8, recommendedTier: "starter" },
      financial_analysis: { score: 8, recommendedTier: "starter" },
      document_analysis: { score: 7, recommendedTier: "starter" },
      page_generation: { score: 9, recommendedTier: "starter" },
      complex_reasoning: { score: 7, recommendedTier: "starter" },
    },
  },
  {
    id: "gpt-4o",
    provider: "openai",
    realModelId: "gpt-4o",
    displayName: "GPT-4o (Omni)",
    family: "GPT-4o",
    status: "available",
    latencyProfile: "balanced",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 128_000,
      maxOutputTokens: 16_384,
      rateLimitRpmDefault: 500,
      rateLimitTpmDefault: 300_000,
    },
    pricing: {
      inputPerMillionUsd: 2.50,
      outputPerMillionUsd: 10.00,
      cachedInputPerMillionUsd: 1.25,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "pro" },
      business_analysis: { score: 9, recommendedTier: "pro" },
      financial_analysis: { score: 9, recommendedTier: "pro" },
      document_analysis: { score: 8, recommendedTier: "pro" },
      page_generation: { score: 9, recommendedTier: "pro" },
      complex_reasoning: { score: 9, recommendedTier: "pro" },
    },
  },
  {
    id: "o1-mini",
    provider: "openai",
    realModelId: "o1-mini",
    displayName: "OpenAI o1-mini",
    family: "OpenAI o1",
    status: "available",
    latencyProfile: "thorough",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: true,
      functionCalling: false,
      jsonMode: false,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 128_000,
      maxOutputTokens: 65_536,
      rateLimitRpmDefault: 100,
      rateLimitTpmDefault: 200_000,
    },
    pricing: {
      inputPerMillionUsd: 1.10,
      outputPerMillionUsd: 4.40,
      cachedInputPerMillionUsd: 0.55,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 7, recommendedTier: "pro" },
      business_analysis: { score: 9, recommendedTier: "pro" },
      financial_analysis: { score: 10, recommendedTier: "pro" },
      document_analysis: { score: 8, recommendedTier: "pro" },
      page_generation: { score: 6, recommendedTier: "pro" },
      complex_reasoning: { score: 10, recommendedTier: "pro" },
    },
  },

  // Anthropic Claude
  {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    realModelId: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    family: "Claude 3.5",
    status: "available",
    latencyProfile: "balanced",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: true,
      deepReasoning: true,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 200_000,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 50,
      rateLimitTpmDefault: 40_000,
    },
    pricing: {
      inputPerMillionUsd: 3.00,
      outputPerMillionUsd: 15.00,
      cachedInputPerMillionUsd: 0.30,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "pro" },
      business_analysis: { score: 10, recommendedTier: "pro" },
      financial_analysis: { score: 10, recommendedTier: "pro" },
      document_analysis: { score: 10, recommendedTier: "pro" },
      page_generation: { score: 10, recommendedTier: "pro" },
      complex_reasoning: { score: 10, recommendedTier: "pro" },
    },
  },
  {
    id: "claude-3-5-haiku",
    provider: "anthropic",
    realModelId: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    family: "Claude 3.5",
    status: "available",
    latencyProfile: "ultra_low",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 200_000,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 100,
      rateLimitTpmDefault: 100_000,
    },
    pricing: {
      inputPerMillionUsd: 0.80,
      outputPerMillionUsd: 4.00,
      cachedInputPerMillionUsd: 0.08,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "starter" },
      business_analysis: { score: 8, recommendedTier: "starter" },
      financial_analysis: { score: 8, recommendedTier: "starter" },
      document_analysis: { score: 8, recommendedTier: "starter" },
      page_generation: { score: 8, recommendedTier: "starter" },
      complex_reasoning: { score: 7, recommendedTier: "starter" },
    },
  },

  // DeepSeek
  {
    id: "deepseek-chat",
    provider: "deepseek",
    realModelId: "deepseek-chat",
    displayName: "DeepSeek V3",
    family: "DeepSeek V3",
    status: "available",
    latencyProfile: "balanced",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 64_000,
      maxOutputTokens: 8_000,
      rateLimitRpmDefault: 60,
      rateLimitTpmDefault: 100_000,
    },
    pricing: {
      inputPerMillionUsd: 0.14,
      outputPerMillionUsd: 0.28,
      cachedInputPerMillionUsd: 0.014,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 9, recommendedTier: "starter" },
      business_analysis: { score: 8, recommendedTier: "starter" },
      financial_analysis: { score: 8, recommendedTier: "starter" },
      document_analysis: { score: 7, recommendedTier: "starter" },
      page_generation: { score: 8, recommendedTier: "starter" },
      complex_reasoning: { score: 8, recommendedTier: "starter" },
    },
  },
  {
    id: "deepseek-reasoner",
    provider: "deepseek",
    realModelId: "deepseek-reasoner",
    displayName: "DeepSeek R1",
    family: "DeepSeek R1",
    status: "available",
    latencyProfile: "thorough",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: true,
      functionCalling: false,
      jsonMode: false,
      streaming: true,
      promptCaching: true,
    },
    limits: {
      contextWindowTokens: 64_000,
      maxOutputTokens: 8_000,
      rateLimitRpmDefault: 60,
      rateLimitTpmDefault: 100_000,
    },
    pricing: {
      inputPerMillionUsd: 0.55,
      outputPerMillionUsd: 2.19,
      cachedInputPerMillionUsd: 0.14,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 7, recommendedTier: "pro" },
      business_analysis: { score: 9, recommendedTier: "pro" },
      financial_analysis: { score: 10, recommendedTier: "pro" },
      document_analysis: { score: 8, recommendedTier: "pro" },
      page_generation: { score: 6, recommendedTier: "pro" },
      complex_reasoning: { score: 10, recommendedTier: "pro" },
    },
  },

  // Mistral AI
  {
    id: "mistral-large",
    provider: "mistral",
    realModelId: "mistral-large-latest",
    displayName: "Mistral Large",
    family: "Mistral",
    status: "available",
    latencyProfile: "balanced",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: false,
    },
    limits: {
      contextWindowTokens: 128_000,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 60,
      rateLimitTpmDefault: 100_000,
    },
    pricing: {
      inputPerMillionUsd: 2.00,
      outputPerMillionUsd: 6.00,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 8, recommendedTier: "pro" },
      business_analysis: { score: 9, recommendedTier: "pro" },
      financial_analysis: { score: 8, recommendedTier: "pro" },
      document_analysis: { score: 8, recommendedTier: "pro" },
      page_generation: { score: 8, recommendedTier: "pro" },
      complex_reasoning: { score: 8, recommendedTier: "pro" },
    },
  },
  {
    id: "mistral-small",
    provider: "mistral",
    realModelId: "mistral-small-latest",
    displayName: "Mistral Small",
    family: "Mistral",
    status: "available",
    latencyProfile: "ultra_low",
    isSystemProvided: false,
    supportsByok: true,
    capabilities: {
      text: true,
      vision: false,
      deepReasoning: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      promptCaching: false,
    },
    limits: {
      contextWindowTokens: 128_000,
      maxOutputTokens: 8_192,
      rateLimitRpmDefault: 60,
      rateLimitTpmDefault: 100_000,
    },
    pricing: {
      inputPerMillionUsd: 0.20,
      outputPerMillionUsd: 0.60,
      pricingUpdatedAt: "2026-10-29",
    },
    taskSuitability: {
      general_chat: { score: 8, recommendedTier: "starter" },
      business_analysis: { score: 7, recommendedTier: "starter" },
      financial_analysis: { score: 7, recommendedTier: "starter" },
      document_analysis: { score: 7, recommendedTier: "starter" },
      page_generation: { score: 7, recommendedTier: "starter" },
      complex_reasoning: { score: 6, recommendedTier: "pro" },
    },
  },
];

/**
 * Returns metadata for a model canonical ID or realModelId.
 */
export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  const normalized = modelId.toLowerCase().trim();
  return (
    MODEL_CATALOG.find((m) => m.id.toLowerCase() === normalized) ||
    MODEL_CATALOG.find((m) => m.realModelId.toLowerCase() === normalized)
  );
}

/**
 * Lists models available for a specific task.
 */
export function listModelsForTask(task: string): ModelMetadata[] {
  return MODEL_CATALOG.filter((m) => m.status === "available").sort((a, b) => {
    const scoreA = a.taskSuitability[task as keyof typeof a.taskSuitability]?.score || 0;
    const scoreB = b.taskSuitability[task as keyof typeof b.taskSuitability]?.score || 0;
    return scoreB - scoreA;
  });
}

/**
 * Returns active and preview models currently supported by the platform.
 */
export function listActiveModels(): ModelMetadata[] {
  return MODEL_CATALOG.filter((m) => m.status === "available" || m.status === "experimental");
}

/**
 * Resolves safe fallback model within comparable cost tier.
 */
export function getFallbackModel(modelId: string): string {
  const normalized = modelId.toLowerCase().trim();
  if (normalized.includes("claude-3-5-sonnet")) return "gpt-4o";
  if (normalized.includes("gpt-4o") && !normalized.includes("mini")) return "claude-3-5-sonnet";
  if (normalized.includes("o1-mini")) return "deepseek-reasoner";
  if (normalized.includes("deepseek-reasoner")) return "gemini-2.5-flash";
  if (normalized.includes("gemini-2.5-flash")) return "gpt-4o-mini";
  if (normalized.includes("gpt-4o-mini")) return "gemini-2.5-flash";
  return "gemini-2.5-flash";
}
