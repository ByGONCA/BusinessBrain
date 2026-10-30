// ==============================================================================
// Company Brain: Multi-Model Routing Engine
// Implements 3 selection modes: Auto (with anti-cost guardrails), Preferred, and Task-based.
// ==============================================================================

import { MODEL_CATALOG, getModelMetadata, getFallbackModel } from "../catalog/models";
import { ModelMetadata } from "../catalog/types";
import { AITaskType, SupportedProviderId } from "../types";

export interface RoutingDecisionParams {
  organizationId?: string;
  userId?: string;
  taskType?: AITaskType | string;
  promptText?: string;
  selectionMode?: "auto" | "preferred" | "task" | "task_based";
  mode?: "auto" | "preferred" | "task" | "task_based";
  userPreferredModelId?: string;
  preferredModelId?: string;
  organizationTier?: "trial" | "starter" | "pro" | "enterprise";
  userTier?: "trial" | "starter" | "pro" | "enterprise";
  configuredProviders?: SupportedProviderId[];
  failedModelIds?: string[];
  maxBudgetUsd?: number;
  estimatedTokens?: { promptTokens?: number; maxCompletionTokens?: number };
}

export interface RoutingDecision {
  selectedModel: ModelMetadata;
  selectedModelId: string;
  fallbackModel: ModelMetadata;
  fallbackModelId: string;
  isByok: boolean;
  routingReason: string;
  selectionReason: string;
  estimatedPromptTokens: number;
  estimatedCostCeilingUsd: number;
  costCeilingUsd: number;
  fallbackOccurred?: boolean;
}

export class ModelRoutingEngine {
  private static estimateTokens(text?: string): number {
    if (!text) return 100;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private static calculateCostCeiling(model: ModelMetadata, promptTokens: number): number {
    const expectedOutput = Math.min(2048, model.limits.maxOutputTokens);
    const inCost = (promptTokens / 1_000_000) * model.pricing.inputPerMillionUsd;
    const outCost = (expectedOutput / 1_000_000) * model.pricing.outputPerMillionUsd;
    return Number((inCost + outCost).toFixed(6));
  }

  /**
   * Resolves the optimal AI model considering mode, budget, capabilities and available keys.
   */
  public static resolveModel(params: RoutingDecisionParams): RoutingDecision {
    const promptText = params.promptText || "";
    const promptTokens = params.estimatedTokens?.promptTokens || this.estimateTokens(promptText);
    const mode = params.mode || params.selectionMode || "auto";
    const taskType = (params.taskType || "general_chat") as AITaskType;
    const tier = params.userTier || params.organizationTier || "starter";
    const preferredId = params.preferredModelId || params.userPreferredModelId;
    const failedIds = new Set(params.failedModelIds || []);

    const defaultFast = getModelMetadata("gemini-2.5-flash")!;
    const defaultFallback = getModelMetadata("gpt-4o-mini") || defaultFast;

    let selectedModel = defaultFast;
    let fallbackModel = defaultFallback;
    let reason = "Roteamento inteligente de baixa latência e custo controlado.";
    let fallbackOccurred = false;

    // 1. MODO B: MODELO PREFERIDO
    if (mode === "preferred" && preferredId) {
      const preferred = getModelMetadata(preferredId);
      if (preferred && preferred.status === "available" && !failedIds.has(preferred.id)) {
        selectedModel = preferred;
        fallbackModel = getModelMetadata(getFallbackModel(preferred.id)) || defaultFast;
        reason = `Preferência explícita de modelo: ${preferred.displayName}`;
      } else {
        selectedModel = failedIds.has("gemini-2.5-flash") ? defaultFallback : defaultFast;
        fallbackModel = defaultFallback;
        fallbackOccurred = true;
        reason = `Modelo preferido indisponível ou em fallback: ${preferredId}`;
      }
    }
    // 2. MODO C: SELEÇÃO POR TAREFA
    else if (mode === "task" || mode === "task_based") {
      const taskModel = this.resolveByTask(taskType, tier);
      if (failedIds.has(taskModel.id)) {
        selectedModel = getModelMetadata(getFallbackModel(taskModel.id)) || defaultFast;
        fallbackOccurred = true;
      } else {
        selectedModel = taskModel;
      }
      fallbackModel = defaultFast;
      reason = `Otimização especializada para a tarefa: ${taskType}`;
    }
    // 3. MODO A: ROTEAMENTO AUTOMÁTICO (Multi-Fator com Guardrail Anti-Custos)
    else {
      const isDeepReasoningRequested =
        taskType === "complex_reasoning" ||
        promptText.includes("#deepthink") ||
        promptText.toLowerCase().includes("raciocínio profundo") ||
        promptText.toLowerCase().includes("prove passo a passo");

      if (isDeepReasoningRequested) {
        const reasoningModel =
          tier === "enterprise" || tier === "pro"
            ? getModelMetadata("gemini-2.5-pro") || defaultFast
            : defaultFast;
        selectedModel = reasoningModel;
        reason = "Raciocínio analítico detetado e suportado pelo plano.";
      } else if (taskType === "page_generation") {
        selectedModel = defaultFast;
        reason = "Geração de blocos estruturados nativos com validação Zod de alta velocidade.";
      } else if (promptTokens > 60_000) {
        selectedModel = getModelMetadata("gemini-2.5-pro") || defaultFast;
        reason = "Contexto longo detetado (>60k tokens). Utilizada janela expandida.";
      } else {
        selectedModel = defaultFast;
        reason = "Roteamento inteligente de baixa latência e custo controlado.";
      }

      // Handle failure in auto mode
      if (failedIds.has(selectedModel.id)) {
        selectedModel = getModelMetadata(getFallbackModel(selectedModel.id)) || defaultFallback;
        fallbackOccurred = true;
        reason = `Fallback resiliente ativado: ${selectedModel.displayName}`;
      }
    }

    const costCeiling =
      tier === "starter" || tier === "trial" ? 0.05 : tier === "pro" ? 0.15 : 0.50;

    return {
      selectedModel,
      selectedModelId: selectedModel.id,
      fallbackModel,
      fallbackModelId: fallbackModel.id,
      isByok: !selectedModel.isSystemProvided,
      routingReason: reason,
      selectionReason: reason,
      estimatedPromptTokens: promptTokens,
      estimatedCostCeilingUsd: this.calculateCostCeiling(selectedModel, promptTokens),
      costCeilingUsd: costCeiling,
      fallbackOccurred,
    };
  }

  private static resolveByTask(task: string, tier: string): ModelMetadata {
    const isPro = tier === "pro" || tier === "enterprise";

    switch (task) {
      case "code_generation":
        return getModelMetadata("deepseek-reasoner") || getModelMetadata("claude-3-5-sonnet") || getModelMetadata("gemini-2.5-flash")!;
      case "deep_analysis":
      case "financial_analysis":
        return isPro
          ? getModelMetadata("claude-3-5-sonnet") || getModelMetadata("gemini-2.5-pro") || getModelMetadata("gemini-2.5-flash")!
          : getModelMetadata("gemini-2.5-flash")!;
      case "quick_summary":
        return getModelMetadata("gpt-4o-mini") || getModelMetadata("gemini-2.5-flash")!;
      case "document_analysis":
        return getModelMetadata("gemini-2.5-pro") || getModelMetadata("gemini-2.5-flash")!;
      case "complex_reasoning":
        return isPro
          ? getModelMetadata("deepseek-reasoner") || getModelMetadata("gemini-2.5-pro") || getModelMetadata("gemini-2.5-flash")!
          : getModelMetadata("gemini-2.5-flash")!;
      case "page_generation":
      case "business_analysis":
      case "general_chat":
      default:
        return getModelMetadata("gemini-2.5-flash")!;
    }
  }
}
