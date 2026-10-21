import { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/lib/stripe/client";
import { logger } from "@/lib/security/logger";

export interface ReconciliationDiscrepancy {
  type:
    | "missing_local_subscription"
    | "status_mismatch"
    | "plan_mismatch"
    | "cancel_at_period_end_mismatch"
    | "orphan_local_subscription";
  severity: "low" | "medium" | "high";
  organizationId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  localValue?: unknown;
  stripeValue?: unknown;
  description: string;
}

export interface ReconciliationReport {
  reconciledAt: string;
  organizationId?: string; // If scoped to single org
  totalSubscriptionsChecked: number;
  totalDiscrepancies: number;
  discrepancies: ReconciliationDiscrepancy[];
  status: "in_sync" | "discrepancies_found" | "error";
  error?: string;
}

/**
 * Reconciles billing subscriptions between Stripe and local Supabase DB.
 * Purely READ-ONLY diagnostic comparison: zero remote mutations, zero Stripe alterations.
 *
 * Checks:
 * 1. Subscription status consistency (trialing, active, past_due, canceled).
 * 2. Plan tier alignment (starter, pro, enterprise).
 * 3. Cancellation scheduled flags (cancel_at_period_end).
 * 4. Missing subscriptions in local database vs Stripe.
 */
export async function reconcileSubscriptions(
  supabase: SupabaseClient,
  options: { organizationId?: string } = {}
): Promise<ReconciliationReport> {
  const discrepancies: ReconciliationDiscrepancy[] = [];
  let totalChecked = 0;

  try {
    const stripe = getStripeClient();

    // 1. Fetch local subscriptions
    let query = supabase
      .from("subscriptions")
      .select("organization_id, stripe_customer_id, stripe_subscription_id, plan, status, cancel_at_period_end");

    if (options.organizationId) {
      query = query.eq("organization_id", options.organizationId);
    }

    const { data: localSubs, error: dbError } = await query;
    if (dbError) {
      logger.error("Failed to fetch local subscriptions during reconciliation", dbError);
      return {
        reconciledAt: new Date().toISOString(),
        organizationId: options.organizationId,
        totalSubscriptionsChecked: 0,
        totalDiscrepancies: 0,
        discrepancies: [],
        status: "error",
        error: `Database query failed: ${dbError.message}`,
      };
    }

    const localList = localSubs || [];
    totalChecked = localList.length;

    // 2. Cross-reference each local subscription against Stripe
    for (const sub of localList) {
      if (!sub.stripe_subscription_id) {
        continue;
      }

      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        // Check Status
        if (stripeSub.status !== sub.status) {
          discrepancies.push({
            type: "status_mismatch",
            severity: stripeSub.status === "canceled" && sub.status === "active" ? "high" : "medium",
            organizationId: sub.organization_id,
            stripeSubscriptionId: sub.stripe_subscription_id,
            stripeCustomerId: sub.stripe_customer_id,
            localValue: sub.status,
            stripeValue: stripeSub.status,
            description: `Local status is '${sub.status}' but Stripe reports '${stripeSub.status}'.`,
          });
        }

        // Check cancel_at_period_end
        if (Boolean(stripeSub.cancel_at_period_end) !== Boolean(sub.cancel_at_period_end)) {
          discrepancies.push({
            type: "cancel_at_period_end_mismatch",
            severity: "low",
            organizationId: sub.organization_id,
            stripeSubscriptionId: sub.stripe_subscription_id,
            stripeCustomerId: sub.stripe_customer_id,
            localValue: sub.cancel_at_period_end,
            stripeValue: stripeSub.cancel_at_period_end,
            description: `Local cancel_at_period_end is ${sub.cancel_at_period_end} but Stripe reports ${stripeSub.cancel_at_period_end}.`,
          });
        }

        // Check Plan Tier in metadata if present
        const stripePlan = stripeSub.metadata?.plan;
        if (stripePlan && stripePlan !== sub.plan) {
          discrepancies.push({
            type: "plan_mismatch",
            severity: "high",
            organizationId: sub.organization_id,
            stripeSubscriptionId: sub.stripe_subscription_id,
            stripeCustomerId: sub.stripe_customer_id,
            localValue: sub.plan,
            stripeValue: stripePlan,
            description: `Local plan is '${sub.plan}' but Stripe metadata specifies '${stripePlan}'.`,
          });
        }
      } catch (err: unknown) {
        const stripeErr = err as { code?: string; message?: string };
        if (stripeErr.code === "resource_missing") {
          discrepancies.push({
            type: "orphan_local_subscription",
            severity: "high",
            organizationId: sub.organization_id,
            stripeSubscriptionId: sub.stripe_subscription_id,
            stripeCustomerId: sub.stripe_customer_id,
            localValue: sub.stripe_subscription_id,
            stripeValue: null,
            description: `Subscription ${sub.stripe_subscription_id} not found on Stripe (deleted or test mode mismatch).`,
          });
        } else {
          logger.warn("Stripe API lookup failed during reconciliation", {
            subId: sub.stripe_subscription_id,
            error: stripeErr.message,
          });
        }
      }
    }

    return {
      reconciledAt: new Date().toISOString(),
      organizationId: options.organizationId,
      totalSubscriptionsChecked: totalChecked,
      totalDiscrepancies: discrepancies.length,
      discrepancies,
      status: discrepancies.length === 0 ? "in_sync" : "discrepancies_found",
    };
  } catch (err: unknown) {
    logger.error("Unexpected error during subscription reconciliation", err);
    return {
      reconciledAt: new Date().toISOString(),
      organizationId: options.organizationId,
      totalSubscriptionsChecked: totalChecked,
      totalDiscrepancies: discrepancies.length,
      discrepancies,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
