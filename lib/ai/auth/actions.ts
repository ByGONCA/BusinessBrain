"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { AIAuthorizationService } from "./service";
import { AI_TIER_CONFIGS, getAICreditQuota } from "@/lib/ai/config";
import { SubscriptionTier } from "@/lib/stripe/types";
import {
  AIAccessAuthorization,
  AIScopeType,
  AIResourceType,
  AIActionType,
  ContextSourceItem,
} from "./types";

export async function getAvailableContextSourcesAction(): Promise<{
  success: boolean;
  sources?: ContextSourceItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    const sources = await AIAuthorizationService.getAvailableContextSources(
      user.id,
      activeOrg.id
    );

    return { success: true, sources };
  } catch (err: any) {
    logger.error("Failed in getAvailableContextSourcesAction", err);
    return { success: false, error: err.message || "Falha ao obter fontes de contexto." };
  }
}

export async function grantAIAuthorizationAction(params: {
  scopeType: AIScopeType;
  conversationId?: string | null;
  resourceType: AIResourceType;
  resourceId: string;
  actionType?: AIActionType;
  purpose?: string;
}): Promise<{
  success: boolean;
  authorization?: AIAccessAuthorization;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    const rl = await rateLimit("ai-grant", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
    if (!rl.success) {
      return { success: false, error: "Rate limit exceeded" };
    }

    const auth = await AIAuthorizationService.grantAuthorization({
      organizationId: activeOrg.id,
      userId: user.id,
      scopeType: params.scopeType,
      conversationId: params.conversationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      actionType: params.actionType || "read",
      purpose: params.purpose,
    });

    return { success: true, authorization: auth };
  } catch (err: any) {
    logger.error("Failed in grantAIAuthorizationAction", err);
    return { success: false, error: err.message || "Falha ao conceder autorização." };
  }
}

export async function revokeAIAuthorizationAction(authId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    const revoked = await AIAuthorizationService.revokeAuthorization(
      authId,
      user.id,
      activeOrg.id
    );

    return { success: revoked };
  } catch (err: any) {
    logger.error("Failed in revokeAIAuthorizationAction", err);
    return { success: false, error: err.message || "Falha ao revogar autorização." };
  }
}

export async function getActiveAIAuthorizationsAction(): Promise<{
  success: boolean;
  authorizations?: AIAccessAuthorization[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    const list = await AIAuthorizationService.listActiveAuthorizations(
      user.id,
      activeOrg.id
    );

    return { success: true, authorizations: list };
  } catch (err: any) {
    logger.error("Failed in getActiveAIAuthorizationsAction", err);
    return { success: false, error: err.message || "Falha ao listar autorizações." };
  }
}

export async function saveConversationSourcesAction(
  conversationId: string,
  selectedSourceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    const { error } = await supabase
      .from("ai_conversations")
      .update({ selected_source_ids: selectedSourceIds })
      .eq("id", conversationId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: "Falha ao guardar fontes na conversa." };
    }

    return { success: true };
  } catch (err: any) {
    logger.error("Failed in saveConversationSourcesAction", err);
    return { success: false, error: err.message };
  }
}

export interface AccountAILimitsData {
  tier: string;
  status: string;
  monthlyQuota: number;
  usedCredits: number;
  remainingCredits: number;
  maxTokensPerRequest: number;
  rateLimitPerMinute: number;
  supportsDeepReasoning: boolean;
  supportsStreaming: boolean;
  isTrial: boolean;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
}

export async function getAccountAILimitsAction(): Promise<{
  success: boolean;
  limits?: AccountAILimitsData;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    // Retrieve active subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_end, current_period_start, current_period_end")
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    const rawPlan = sub?.plan?.toLowerCase() || (sub?.status === "trialing" ? "trial" : "starter");
    const tier = (["trial", "starter", "pro", "enterprise"].includes(rawPlan)
      ? rawPlan
      : "starter") as SubscriptionTier;

    const tierConfig = AI_TIER_CONFIGS[tier] || AI_TIER_CONFIGS.starter;
    const monthlyQuota = getAICreditQuota(tier);

    // Compute consumed credits in current cycle from ledger
    const periodStart = sub?.current_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    let usedCredits = 0;

    try {
      const { data: ledgerEntries } = await supabase
        .from("ai_cost_ledger")
        .select("prompt_tokens, completion_tokens")
        .eq("organization_id", activeOrg.id)
        .gte("created_at", periodStart);

      if (ledgerEntries && ledgerEntries.length > 0) {
        const totalTokens = ledgerEntries.reduce(
          (sum, r) => sum + (r.prompt_tokens || 0) + (r.completion_tokens || 0),
          0
        );
        usedCredits = Math.ceil(totalTokens / 1000);
      }
    } catch {
      usedCredits = 0;
    }

    const remainingCredits = Math.max(0, monthlyQuota - usedCredits);

    return {
      success: true,
      limits: {
        tier,
        status: sub?.status || "active",
        monthlyQuota,
        usedCredits,
        remainingCredits,
        maxTokensPerRequest: tierConfig.maxTokensPerRequest,
        rateLimitPerMinute: tierConfig.rateLimitPerMinute,
        supportsDeepReasoning: tierConfig.supportsDeepReasoning,
        supportsStreaming: tierConfig.supportsStreaming,
        isTrial: sub?.status === "trialing",
        trialEnd: sub?.trial_end || null,
        currentPeriodEnd: sub?.current_period_end || null,
      },
    };
  } catch (err: any) {
    logger.error("Failed in getAccountAILimitsAction", err);
    return { success: false, error: err.message || "Falha ao obter limites da conta." };
  }
}
