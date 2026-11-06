/**
 * AI Configuration, Model Registry & Quotas for BusinessBrain.
 *
 * Enforces server-side budget protection, model tiering, quota boundaries,
 * and deterministic token cost estimations for trials and paid subscription tiers.
 */

export type SubscriptionTier = "trial" | "starter" | "pro" | "enterprise";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface AITierConfig {
  model: string;
  monthlyQuota: number;
  maxTokensPerRequest: number;
  rateLimitPerMinute: number;
  supportsStreaming: boolean;
  supportsDeepReasoning: boolean;
}

export const AI_TIER_CONFIGS: Record<SubscriptionTier, AITierConfig> = {
  trial: {
    model: DEFAULT_GEMINI_MODEL,
    monthlyQuota: 100, // Safe exploration ceiling during free trial
    maxTokensPerRequest: 2048,
    rateLimitPerMinute: 5,
    supportsStreaming: true,
    supportsDeepReasoning: false,
  },
  starter: {
    model: DEFAULT_GEMINI_MODEL,
    monthlyQuota: 1000,
    maxTokensPerRequest: 4096,
    rateLimitPerMinute: 15,
    supportsStreaming: true,
    supportsDeepReasoning: false,
  },
  pro: {
    model: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
    monthlyQuota: 5000,
    maxTokensPerRequest: 8192,
    rateLimitPerMinute: 30,
    supportsStreaming: true,
    supportsDeepReasoning: true,
  },
  enterprise: {
    model: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
    monthlyQuota: 100000,
    maxTokensPerRequest: 16384,
    rateLimitPerMinute: 60,
    supportsStreaming: true,
    supportsDeepReasoning: true,
  },
};

/**
 * Model Cost Rates per 1,000,000 tokens (USD)
 */
export const MODEL_PRICING_RATES: Record<string, { inputPerMillion: number; outputPerMillion: number; cachedInputPerMillion?: number }> = {
  // Google Gemini
  "gemini-2.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30, cachedInputPerMillion: 0.01875 },
  "gemini-2.0-flash": { inputPerMillion: 0.10, outputPerMillion: 0.40, cachedInputPerMillion: 0.025 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30, cachedInputPerMillion: 0.01875 },
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5.00, cachedInputPerMillion: 0.3125 },
  "gemini-1.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5.00, cachedInputPerMillion: 0.3125 },

  // OpenAI
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60, cachedInputPerMillion: 0.075 },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00, cachedInputPerMillion: 1.25 },
  "o1-mini": { inputPerMillion: 1.10, outputPerMillion: 4.40, cachedInputPerMillion: 0.55 },
  "o3-mini": { inputPerMillion: 1.10, outputPerMillion: 4.40, cachedInputPerMillion: 0.55 },
  "o1": { inputPerMillion: 15.00, outputPerMillion: 60.00, cachedInputPerMillion: 7.50 },

  // Anthropic Claude
  "claude-3-7-sonnet": { inputPerMillion: 3.00, outputPerMillion: 15.00, cachedInputPerMillion: 0.30 },
  "claude-3-7-sonnet-20250219": { inputPerMillion: 3.00, outputPerMillion: 15.00, cachedInputPerMillion: 0.30 },
  "claude-3-5-sonnet": { inputPerMillion: 3.00, outputPerMillion: 15.00, cachedInputPerMillion: 0.30 },
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3.00, outputPerMillion: 15.00, cachedInputPerMillion: 0.30 },
  "claude-3-5-haiku": { inputPerMillion: 0.80, outputPerMillion: 4.00, cachedInputPerMillion: 0.08 },
  "claude-3-5-haiku-20241022": { inputPerMillion: 0.80, outputPerMillion: 4.00, cachedInputPerMillion: 0.08 },

  // DeepSeek
  "deepseek-chat": { inputPerMillion: 0.14, outputPerMillion: 0.28, cachedInputPerMillion: 0.014 },
  "deepseek-reasoner": { inputPerMillion: 0.55, outputPerMillion: 2.19, cachedInputPerMillion: 0.14 },

  // Mistral AI
  "mistral-large-latest": { inputPerMillion: 2.00, outputPerMillion: 6.00 },
  "mistral-small-latest": { inputPerMillion: 0.20, outputPerMillion: 0.60 },

  // Qwen
  "qwen-2.5-72b": { inputPerMillion: 0.10, outputPerMillion: 0.30 },
};

/**
 * Calculates deterministic token cost in USD based on official provider rates.
 */
export function calculateTokenCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedPromptTokens = 0
): number {
  const normalized = model.toLowerCase();
  const rates = MODEL_PRICING_RATES[normalized] || MODEL_PRICING_RATES["gemini-2.5-flash"];
  const uncachedPrompt = Math.max(0, promptTokens - cachedPromptTokens);
  const cachedRate = rates.cachedInputPerMillion ?? rates.inputPerMillion;

  const uncachedCost = (uncachedPrompt / 1_000_000) * rates.inputPerMillion;
  const cachedCost = (cachedPromptTokens / 1_000_000) * cachedRate;
  const outputCost = (completionTokens / 1_000_000) * rates.outputPerMillion;

  return Number((uncachedCost + cachedCost + outputCost).toFixed(6));
}

/**
 * Resolves the appropriate AI model for the organization's subscription tier.
 */
export function getAIModelForTier(tier: string): string {
  const normalized = (tier.toLowerCase() as SubscriptionTier);
  return AI_TIER_CONFIGS[normalized]?.model ?? AI_TIER_CONFIGS.trial.model;
}

/**
 * Resolves the monthly AI quota for the given tier.
 */
export function getAICreditQuota(tier: string): number {
  const normalized = (tier.toLowerCase() as SubscriptionTier);
  return AI_TIER_CONFIGS[normalized]?.monthlyQuota ?? AI_TIER_CONFIGS.trial.monthlyQuota;
}

/**
 * Model Credit Consumption Multipliers based on real token costs.
 * Flash/Mini models consume 1x to 2x base credits.
 * Advanced reasoning & frontier models consume proportionally more credits.
 */
export const MODEL_CREDIT_MULTIPLIERS: Record<string, number> = {
  // Google Gemini
  "gemini-2.5-flash": 1,
  "gemini-2.0-flash": 1,
  "gemini-1.5-flash": 1,
  "gemini-2.5-pro": 10,
  "gemini-1.5-pro": 10,

  // OpenAI
  "gpt-4o-mini": 2,
  "gpt-4o": 25,
  "o1-mini": 12,
  "o3-mini": 12,
  "o1": 150,

  // Anthropic Claude
  "claude-3-5-haiku": 8,
  "claude-3-5-haiku-20241022": 8,
  "claude-3-7-sonnet": 30,
  "claude-3-7-sonnet-20250219": 30,
  "claude-3-5-sonnet": 30,
  "claude-3-5-sonnet-20241022": 30,

  // DeepSeek
  "deepseek-chat": 1.5,
  "deepseek-reasoner": 5,

  // Mistral AI
  "mistral-small": 2,
  "mistral-small-latest": 2,
  "mistral-large": 20,
  "mistral-large-latest": 20,
};

export function getModelCreditMultiplier(model: string): number {
  const normalized = model.toLowerCase().trim();
  return MODEL_CREDIT_MULTIPLIERS[normalized] ?? 1;
}

export function calculateRequiredCredits(
  model: string,
  totalTokens: number
): number {
  const multiplier = getModelCreditMultiplier(model);
  const baseCredits = Math.ceil(totalTokens / 1000);
  return Math.max(1, Math.ceil(baseCredits * multiplier));
}

/**
 * Checks whether an organization has exceeded its quota.
 */
export function isAIQuotaExhausted(used: number, tier: string): boolean {
  const quota = getAICreditQuota(tier);
  return used >= quota;
}
