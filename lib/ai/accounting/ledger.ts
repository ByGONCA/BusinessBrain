// ==============================================================================
// Company Brain: AI Cost Accounting and Ledger Service
// Manages precise token accounting, distinction between estimated vs reported vs billed,
// and audit trails for both personal and organization BYOK scopes.
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { calculateTokenCostUsd } from "../config";
import { AITaskType, SupportedProviderId } from "../types";

export interface RecordUsageTransactionParams {
  organizationId?: string;
  userId: string | null;
  conversationId?: string;
  provider: SupportedProviderId | string;
  model: string;
  isByok: boolean;
  taskType?: AITaskType;
  scope?: "personal" | "org";
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number;
  reportedCostUsd?: number;
  currency?: "USD" | "EUR";
  executionDurationMs?: number;
  retryCount?: number;
  status: "success" | "failed" | "canceled" | "rate_limited" | "aborted";
  errorDetails?: Record<string, unknown>;
  injectedClient?: any;
}

export class AICostLedgerService {
  /**
   * Calculates deterministic estimated cost in USD based on official pricing tables.
   * Supports both argument list and parameter object forms.
   */
  public static calculateCost(
    modelOrParams: string | { modelId: string; promptTokens: number; completionTokens: number; cachedPromptTokens?: number },
    promptTokens?: number,
    completionTokens?: number,
    cachedPromptTokens = 0
  ): { totalCostUsd: number } & number {
    let model: string;
    let pTokens: number;
    let cTokens: number;
    let cachedTokens = 0;

    if (typeof modelOrParams === "object") {
      model = modelOrParams.modelId;
      pTokens = modelOrParams.promptTokens;
      cTokens = modelOrParams.completionTokens;
      cachedTokens = modelOrParams.cachedPromptTokens || 0;
    } else {
      model = modelOrParams;
      pTokens = promptTokens || 0;
      cTokens = completionTokens || 0;
      cachedTokens = cachedPromptTokens;
    }

    const cost = calculateTokenCostUsd(model, pTokens, cTokens, cachedTokens);
    // Return hybrid number with totalCostUsd property for flexible consumption
    const result = Object.assign(cost as any, {
      totalCostUsd: cost,
      valueOf: () => cost,
      toString: () => cost.toString(),
    });
    return result;
  }

  /**
   * Calculates dual-ledger billing breakdown (BYOK accounts are billed $0).
   */
  public static calculateBilling(params: { totalCostUsd: number; isByok: boolean }): {
    reportedCostUsd: number;
    billedCostUsd: number;
  } {
    return {
      reportedCostUsd: Number(params.totalCostUsd.toFixed(6)),
      billedCostUsd: params.isByok ? 0.000000 : Number(params.totalCostUsd.toFixed(6)),
    };
  }

  /**
   * Records a granular transaction in ai_usage_ledger.
   */
  public static async recordUsage(params: RecordUsageTransactionParams): Promise<void> {
    let supabase = params.injectedClient;

    if (!supabase) {
      try {
        supabase = await createClient();
      } catch {
        // Fallback for offline / background test runners
        return;
      }
    }

    const estimatedCostUsd = this.calculateCost(
      params.model,
      params.promptTokens,
      params.completionTokens,
      params.cachedPromptTokens || 0
    );

    // BYOK usage is billed directly to the customer's own provider account ($0 debited by BusinessBrain)
    const billedCostUsd = params.isByok ? 0.000000 : estimatedCostUsd;

    const row = {
      organization_id: params.organizationId || null,
      user_id: params.userId,
      conversation_id: params.conversationId || null,
      provider: params.provider,
      model: params.model,
      is_byok: params.isByok,
      task_type: params.taskType || "general_chat",
      scope: params.scope || (params.organizationId ? "org" : "personal"),
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      cached_prompt_tokens: params.cachedPromptTokens || 0,
      estimated_cost_usd: estimatedCostUsd,
      reported_cost_usd: params.reportedCostUsd ?? null,
      billed_cost_usd: billedCostUsd,
      currency: params.currency || "USD",
      execution_duration_ms: params.executionDurationMs ?? null,
      retry_count: params.retryCount || 0,
      status: params.status,
      error_details: params.errorDetails ? JSON.stringify(params.errorDetails) : null,
    };

    try {
      await supabase.from("ai_usage_ledger").insert(row);
    } catch {
      // Non-blocking telemetry insert
    }
  }
}
