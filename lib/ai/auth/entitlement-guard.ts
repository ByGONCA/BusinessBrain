import { createClient } from "@/lib/supabase/server";
import { SubscriptionTier, SubscriptionStatus } from "@/lib/stripe/types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface AIAccessEntitlementResult {
  allowed: boolean;
  status: 200 | 401 | 402 | 403;
  error?: string;
  message?: string;
  plan?: SubscriptionTier;
  isTrial?: boolean;
  subscriptionId?: string;
}

/**
 * Authoritative Server-Side AI Entitlement Guard
 *
 * COMMERCIAL INVARIANT:
 * AI features (Chat, Streaming, Page Generation, Financial Analysis, Model Selection, BYOK execution)
 * are strictly reserved for accounts with an active paid subscription (starter, pro, enterprise)
 * or a valid unexpired trial.
 *
 * Free accounts, accounts without subscriptions, expired trials, or suspended/canceled subscriptions
 * (outside grace period) are strictly denied AI access with HTTP 402 Payment Required.
 *
 * CRITICAL RULE: Supplying a valid personal or workspace BYOK key DOES NOT bypass this check.
 */
export async function verifyAIAccessEntitlement(
  organizationId: string,
  clientOverride?: SupabaseClient
): Promise<AIAccessEntitlementResult> {
  const supabase = clientOverride || (await createClient());

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, status, plan, trial_end, current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !sub) {
    return {
      allowed: false,
      status: 402,
      error: "NO_ACTIVE_SUBSCRIPTION",
      message:
        "O acesso à inteligência artificial do BusinessBrain requer um plano pago ativo (Starter, Pro ou Enterprise) ou um período de avaliação válido. Contas sem subscrição não podem executar IA, mesmo configurando chaves próprias (BYOK).",
    };
  }

  const now = Date.now();
  const status = sub.status as SubscriptionStatus;

  // 1. Trialing accounts
  if (status === "trialing") {
    if (sub.trial_end && new Date(sub.trial_end).getTime() < now) {
      return {
        allowed: false,
        status: 402,
        error: "TRIAL_EXPIRED",
        message:
          "O período experimental deste workspace expirou. Para continuar a utilizar as funcionalidades de IA, ative um plano pago.",
      };
    }
    return {
      allowed: true,
      status: 200,
      plan: (sub.plan as SubscriptionTier) || "starter",
      isTrial: true,
      subscriptionId: sub.id,
    };
  }

  // 2. Active paid subscriptions
  if (status === "active") {
    return {
      allowed: true,
      status: 200,
      plan: (sub.plan as SubscriptionTier) || "starter",
      isTrial: false,
      subscriptionId: sub.id,
    };
  }

  // 3. Canceled or past-due subscriptions with remaining prepaid period (grace period)
  if (status === "canceled" || status === "past_due") {
    if (sub.current_period_end && new Date(sub.current_period_end).getTime() > now) {
      return {
        allowed: true,
        status: 200,
        plan: (sub.plan as SubscriptionTier) || "starter",
        isTrial: false,
        subscriptionId: sub.id,
      };
    }
    return {
      allowed: false,
      status: 402,
      error: "SUBSCRIPTION_EXPIRED",
      message:
        "A subscrição deste workspace foi cancelada e o período de faturação terminou. Reative o plano para aceder à IA.",
    };
  }

  // 4. Any other non-entitled state (unpaid, paused, incomplete, incomplete_expired)
  return {
    allowed: false,
    status: 402,
    error: "SUBSCRIPTION_INACTIVE",
    message:
      "A subscrição deste workspace não se encontra ativa. Regularize o estado da conta para aceder aos modelos de inteligência artificial.",
  };
}
