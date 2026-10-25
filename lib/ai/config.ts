/**
 * AI Configuration and Model Tiering for BusinessBrain.
 *
 * ARCHITECTURAL RULE:
 * In accordance with AGENTS.md, live external Gemini LLM calls and vector databases
 * are strictly scoped to designated phases. This module defines budget protection,
 * model tiering, quota boundaries, and rate limits for trials and paid subscription tiers.
 */

export type SubscriptionTier = "trial" | "starter" | "pro" | "enterprise";

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
    model: "gemini-1.5-flash",
    monthlyQuota: 100, // Safe exploration ceiling during 3-day trial
    maxTokensPerRequest: 2048,
    rateLimitPerMinute: 5,
    supportsStreaming: true,
    supportsDeepReasoning: false,
  },
  starter: {
    model: "gemini-1.5-flash",
    monthlyQuota: 1000,
    maxTokensPerRequest: 4096,
    rateLimitPerMinute: 15,
    supportsStreaming: true,
    supportsDeepReasoning: false,
  },
  pro: {
    model: "gemini-1.5-pro",
    monthlyQuota: 5000,
    maxTokensPerRequest: 8192,
    rateLimitPerMinute: 30,
    supportsStreaming: true,
    supportsDeepReasoning: true,
  },
  enterprise: {
    model: "gemini-1.5-pro",
    monthlyQuota: 100000,
    maxTokensPerRequest: 16384,
    rateLimitPerMinute: 60,
    supportsStreaming: true,
    supportsDeepReasoning: true,
  },
};

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
 * Checks whether an organization has exceeded its quota.
 */
export function isAIQuotaExhausted(used: number, tier: string): boolean {
  const quota = getAICreditQuota(tier);
  return used >= quota;
}
