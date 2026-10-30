// ==============================================================================
// Company Brain: Centralized Model Catalog Types
// ==============================================================================

import { SupportedProviderId, AITaskType } from "../types";

export type ModelOperationalStatus =
  | "available"      // Fully operational in production
  | "experimental"   // Preview / beta release
  | "unavailable"    // Temporarily disabled / outage
  | "deprecated";    // Scheduled for removal by vendor

export type ModelCredentialStatus =
  | "verified_tested"        // Key present and active ping succeeded
  | "configured_untested"    // Key stored, pending recent check
  | "no_valid_credentials";  // Key missing

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  deepReasoning: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  streaming: boolean;
  promptCaching: boolean;
}

export interface ModelLimits {
  contextWindowTokens: number;
  maxOutputTokens: number;
  rateLimitRpmDefault: number;
  rateLimitTpmDefault: number;
}

export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
  pricingUpdatedAt: string; // ISO 8601 Date
}

export interface ModelTaskSuitability {
  score: number; // 1 to 10
  recommendedTier: "trial" | "starter" | "pro" | "enterprise";
  notes?: string;
}

export interface ModelMetadata {
  id: string;                                   // Canonical internal ID (e.g. "gemini-2.5-flash")
  provider: SupportedProviderId;
  realModelId: string;                          // Actual model string passed to vendor API
  displayName: string;                          // Human-readable name
  family: string;                               // e.g. "Gemini 2.5", "GPT-4o", "Claude 3.5"
  status: ModelOperationalStatus;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  pricing: ModelPricing;
  taskSuitability: Record<AITaskType, ModelTaskSuitability>;
  latencyProfile: "ultra_low" | "balanced" | "thorough";
  isSystemProvided: boolean;
  supportsByok: boolean;
}
