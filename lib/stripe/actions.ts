"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement, OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { getStripeClient } from "./client";
import { resolveStripePriceId, getTrialDays, SUBSCRIPTION_PLANS } from "./config";
import { SubscriptionTier } from "./types";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";
import { getServerAuthToken } from "@/lib/security/authorization";

export interface CheckoutActionState {
  error?: string;
  url?: string;
}

/**
 * Creates a Stripe Checkout Session configured with a free trial.
 * Maps the internal plan ID to the server-side Stripe Price ID.
 * Protected with role verification and rate limiting.
 */
export async function createCheckoutSessionAction(
  planId: string
): Promise<CheckoutActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/pricing");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    redirect("/onboarding");
  }

  // Rate limit checkout session creation per user
  const rl = await rateLimit("create-checkout", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for checkout session creation", { userId: user.id });
    return { error: "Too many checkout requests. Please wait a moment and try again." };
  }

  // Verify permission: requires owner, admin, or billing.manage permission
  const canManageBilling =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "billing.manage"));

  if (!canManageBilling) {
    return {
      error: "Forbidden: You do not have permission to configure billing subscriptions.",
    };
  }

  // Validate internal plan ID against strict whitelist
  if (!["starter", "pro", "enterprise"].includes(planId)) {
    return { error: `Invalid plan selected: "${planId}".` };
  }

  const planConfig = SUBSCRIPTION_PLANS[planId as SubscriptionTier];
  if (!planConfig) {
    return { error: `Plan configuration not found for "${planId}".` };
  }

  // Check if Stripe is configured in environment
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return {
      error:
        "Stripe is not yet configured in this environment. Please configure STRIPE_SECRET_KEY in .env.local.",
    };
  }

  // Resolve Stripe Price ID server-side
  const stripePriceId = resolveStripePriceId(planId);

  // Determine line items: Use Stripe Price ID if valid, or fallback gracefully to inline price_data
  const hasValidPriceId =
    Boolean(stripePriceId) &&
    (stripePriceId!.startsWith("price_") || stripePriceId!.startsWith("plan_"));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = hasValidPriceId
    ? [
        {
          price: stripePriceId!,
          quantity: 1,
        },
      ]
    : [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${planConfig.name} Plan`,
              description: planConfig.description,
            },
            unit_amount: planConfig.monthlyPriceUsd * 100,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const trialDays = getTrialDays();

  try {
    const stripe = getStripeClient();

    // 1. Check if an existing Stripe customer ID exists in local subscriptions table
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    // 2. If not found in subscriptions, search Stripe API to guarantee zero duplicate customers
    if (!customerId) {
      try {
        const searchResults = await stripe.customers.search({
          query: `metadata['organization_id']:'${activeOrg.id}'`,
          limit: 1,
        });
        if (searchResults.data.length > 0) {
          customerId = searchResults.data[0].id;
        }
      } catch {
        // Fallback to customer list lookup if search indexing is delayed
        const listResults = await stripe.customers.list({
          email: user.email,
          limit: 5,
        });
        const matched = listResults.data.find(
          (c) => c.metadata?.organization_id === activeOrg.id
        );
        if (matched) {
          customerId = matched.id;
        }
      }
    }

    // 3. If no existing customer found anywhere, create one with org metadata
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: activeOrg.name,
        metadata: {
          organization_id: activeOrg.id,
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Create Checkout Session for subscription with free trial
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          organization_id: activeOrg.id,
          plan: planId as SubscriptionTier,
        },
      },
      metadata: {
        organization_id: activeOrg.id,
        user_id: user.id,
        plan: planId,
      },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { error: "Failed to create checkout session URL from Stripe." };
    }

    return { url: session.url };
  } catch (error: unknown) {
    logger.error("Stripe Checkout creation error", error, {
      orgId: activeOrg.id,
      planId,
    });
    return {
      error: "An unexpected error occurred while initiating checkout. Please try again.",
    };
  }
}

/**
 * Creates a Stripe Customer Billing Portal Session.
 * Allows workspace Owners and Admins to manage payment methods, upgrade/downgrade plans,
 * and view billing receipts self-serve.
 */
export async function createCustomerPortalSessionAction(): Promise<{
  url?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { error: "No active workspace selected." };
  }

  // Permission verification: Only Owner or Admin can manage billing
  const canManageBilling =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "billing.manage"));

  if (!canManageBilling) {
    return { error: "Forbidden: Only workspace owners and admins can manage billing." };
  }

  // Rate limit portal session generation
  const rl = await rateLimit(`stripe-portal:${activeOrg.id}`, user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    return { error: "Too many portal requests. Please wait a moment." };
  }

  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (!sub || !sub.stripe_customer_id) {
      return {
        error: "No active billing customer found for this workspace. Please start a subscription first.",
      };
    }

    const stripe = getStripeClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings?tab=billing`,
    });

    if (!portalSession.url) {
      return { error: "Failed to generate billing portal URL." };
    }

    return { url: portalSession.url };
  } catch (err: unknown) {
    logger.error("Failed to create Stripe billing portal session", err, {
      orgId: activeOrg.id,
      userId: user.id,
    });
    return {
      error: "Unable to connect to Stripe Billing Portal at this time. Please try again later.",
    };
  }
}

// Short-term in-memory cache to debounce redundant rapid Stripe API requests for the same session ID
const sessionVerificationCache = new Map<string, { timestamp: number; result: any }>();
const VERIFICATION_CACHE_TTL_MS = 3000; // 3 seconds debounce

/**
 * Server-side verification and fallback synchronization for completed Stripe Checkout sessions.
 * 
 * Invoked when returning from Stripe Checkout (/checkout/success) to ensure the workspace
 * receives immediate access even if the asynchronous webhook has not finalized on the server yet.
 * 
 * Strict Security Invariants:
 * - Session ID must be valid format (starts with "cs_").
 * - User must be authenticated and activeOrg resolved.
 * - Caller must possess billing management authority for the organization.
 * - Session must belong strictly to activeOrg.id and user.id.
 * - Livemode environment must match configured STRIPE_SECRET_KEY.
 * - Session status must be "complete" and subscription status must be "active" or "trialing".
 * - Customer ID and Subscription ID must never belong to a foreign organization.
 * - Persists verified subscription to public.subscriptions using the service_role boundary.
 */
export async function verifyAndSyncCheckoutSession(sessionId: string): Promise<{
  success: boolean;
  isEntitled: boolean;
  entitlement?: OrganizationEntitlement;
  error?: string;
  code?: string;
}> {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_") || sessionId.length > 255) {
    return {
      success: false,
      isEntitled: false,
      error: "Invalid checkout session format.",
      code: "INVALID_SESSION_ID",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      isEntitled: false,
      error: "Authentication required.",
      code: "UNAUTHORIZED",
    };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return {
      success: false,
      isEntitled: false,
      error: "No active workspace selected.",
      code: "NO_ACTIVE_ORG",
    };
  }

  // Permission verification: Only Owner, Admin or billing manager can perform verification sync
  const canManageBilling =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "billing.manage"));

  if (!canManageBilling) {
    return {
      success: false,
      isEntitled: false,
      error: "Forbidden: Only workspace owners and admins can manage billing.",
      code: "FORBIDDEN_PERMISSIONS",
    };
  }

  // 1. Check if the workspace is already entitled in the local database (webhook delivered fast)
  const existingEntitlement = await getOrganizationEntitlement(activeOrg.id);
  if (existingEntitlement.isEntitled) {
    return {
      success: true,
      isEntitled: true,
      entitlement: existingEntitlement,
    };
  }

  // Check short-term cache to avoid duplicate upstream Stripe API calls within TTL
  const cacheKey = `${activeOrg.id}:${sessionId}`;
  const cached = sessionVerificationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_TTL_MS) {
    return cached.result;
  }

  // 2. Retrieve the session directly from Stripe with server secret
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Verify session environment alignment (live vs test mode)
    const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
    if (isLiveKey !== undefined && session.livemode !== isLiveKey) {
      logger.warn("Security Alert: Checkout session livemode mismatch", {
        sessionLivemode: session.livemode,
        isLiveKey,
        sessionId,
      });
      return {
        success: false,
        isEntitled: false,
        error: "Forbidden: Checkout session environment mismatch.",
        code: "FORBIDDEN_ENV_MISMATCH",
      };
    }

    // Verify session completion
    if (session.status !== "complete") {
      const pendingResult = {
        success: false,
        isEntitled: false,
        error: "Stripe checkout session has not completed yet.",
        code: "SESSION_INCOMPLETE",
      };
      sessionVerificationCache.set(cacheKey, { timestamp: Date.now(), result: pendingResult });
      return pendingResult;
    }

    // Verify tenant isolation & authorization: must belong to activeOrg
    if (!session.metadata?.organization_id || session.metadata.organization_id !== activeOrg.id) {
      logger.warn("Security Alert: Checkout session organization mismatch", {
        sessionOrgId: session.metadata?.organization_id,
        activeOrgId: activeOrg.id,
        userId: user.id,
      });
      return {
        success: false,
        isEntitled: false,
        error: "Forbidden: Checkout session belongs to a different organization.",
        code: "FORBIDDEN_ORG_MISMATCH",
      };
    }

    // Verify user ownership strictly
    if (!session.metadata?.user_id || session.metadata.user_id !== user.id) {
      logger.warn("Security Alert: Checkout session user mismatch", {
        sessionUserId: session.metadata?.user_id,
        authUserId: user.id,
      });
      return {
        success: false,
        isEntitled: false,
        error: "Forbidden: Checkout session belongs to a different user.",
        code: "FORBIDDEN_USER_MISMATCH",
      };
    }

    const rawSub = session.subscription;
    if (!rawSub) {
      return {
        success: false,
        isEntitled: false,
        error: "No subscription associated with checkout session.",
        code: "NO_SUBSCRIPTION",
      };
    }

    const sub = typeof rawSub === "string" ? await stripe.subscriptions.retrieve(rawSub) : rawSub;
    const subscriptionId = sub.id;
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || "";
    const plan = session.metadata?.plan || "starter";

    // Subscription status validation: Only active or trialing are entitled
    if (sub.status !== "active" && sub.status !== "trialing") {
      logger.warn("Checkout session subscription is not in an entitled state", {
        subscriptionId: sub.id,
        status: sub.status,
        orgId: activeOrg.id,
      });
      const invalidStatusResult = {
        success: false,
        isEntitled: false,
        error: `Subscription status is '${sub.status}'. Access is only granted for active or trialing subscriptions.`,
        code: "SUBSCRIPTION_STATUS_INVALID",
      };
      sessionVerificationCache.set(cacheKey, { timestamp: Date.now(), result: invalidStatusResult });
      return invalidStatusResult;
    }

    const trialStart = sub.trial_start
      ? new Date(sub.trial_start * 1000).toISOString()
      : null;
    const trialEnd = sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null;

    const currentPeriodStart = (sub as { current_period_start?: number }).current_period_start
      ? new Date((sub as { current_period_start: number }).current_period_start * 1000).toISOString()
      : new Date().toISOString();
    const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end
      ? new Date((sub as { current_period_end: number }).current_period_end * 1000).toISOString()
      : null;

    const serviceClient = createServiceClient();

    // Multi-tenant Collision Defense: verify customer_id and subscription_id do not belong to another organization
    if (customerId) {
      const { data: customerCollision } = await serviceClient
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_customer_id", customerId)
        .neq("organization_id", activeOrg.id)
        .maybeSingle();

      if (customerCollision) {
        logger.error("Security Alert: Stripe customer ID is already bound to another organization", {
          customerId,
          collidingOrgId: customerCollision.organization_id,
          attemptedOrgId: activeOrg.id,
        });
        return {
          success: false,
          isEntitled: false,
          error: "Security violation: Stripe customer belongs to another workspace.",
          code: "FORBIDDEN_CUSTOMER_COLLISION",
        };
      }
    }

    if (subscriptionId) {
      const { data: subCollision } = await serviceClient
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_subscription_id", subscriptionId)
        .neq("organization_id", activeOrg.id)
        .maybeSingle();

      if (subCollision) {
        logger.error("Security Alert: Stripe subscription ID is already bound to another organization", {
          subscriptionId,
          collidingOrgId: subCollision.organization_id,
          attemptedOrgId: activeOrg.id,
        });
        return {
          success: false,
          isEntitled: false,
          error: "Security violation: Stripe subscription belongs to another workspace.",
          code: "FORBIDDEN_SUBSCRIPTION_COLLISION",
        };
      }
    }

    // Synchronize to database using privileged service_role boundary
    const serverToken = getServerAuthToken("stripe-webhook");

    const { error: rpcError } = await serviceClient.rpc("sync_stripe_subscription", {
      p_organization_id: activeOrg.id,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_plan: plan,
      p_status: sub.status,
      p_trial_start: trialStart,
      p_trial_end: trialEnd,
      p_current_period_start: currentPeriodStart,
      p_current_period_end: currentPeriodEnd,
      p_cancel_at_period_end: sub.cancel_at_period_end,
      p_server_token: serverToken,
    });

    if (rpcError) {
      if (rpcError.code === "23505" || rpcError.message?.includes("Cross-tenant collision")) {
        logger.error("Security Alert: RPC rejected sync due to cross-tenant collision", {
          error: rpcError.message,
          orgId: activeOrg.id,
          customerId,
          subscriptionId,
        });
        return {
          success: false,
          isEntitled: false,
          error: "Security violation: Stripe customer or subscription belongs to another workspace.",
          code: "FORBIDDEN_COLLISION",
        };
      }

      logger.warn("RPC sync_stripe_subscription failed during session verify, falling back to direct upsert", {
        error: rpcError.message,
        orgId: activeOrg.id,
      });

      const { error: upsertError } = await serviceClient.from("subscriptions").upsert(
        {
          organization_id: activeOrg.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          trial_start: trialStart,
          trial_end: trialEnd,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

      if (upsertError) {
        logger.error("Direct upsert fallback failed during checkout verification", upsertError, {
          orgId: activeOrg.id,
          subscriptionId,
          hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        });
        const isPermissionError =
          upsertError.message?.includes("permission denied") ||
          rpcError?.message?.includes("permission denied");

        return {
          success: false,
          isEntitled: false,
          error:
            isPermissionError && !process.env.SUPABASE_SERVICE_ROLE_KEY
              ? "Configuração de servidor incompleta: SUPABASE_SERVICE_ROLE_KEY em falta no .env.local para sincronizar subscrições."
              : "Database persistence failed during subscription synchronization.",
          code: isPermissionError ? "PERMISSION_DENIED_SERVICE_KEY_MISSING" : "PERSISTENCE_ERROR",
        };
      }
    }

    logger.info(`[Session Fallback Sync] Verified and synchronized subscription ${subscriptionId} for org ${activeOrg.id}`);

    // Re-query fresh entitlement from database to ensure persistence
    const freshEntitlement = await getOrganizationEntitlement(activeOrg.id);
    const finalResult = {
      success: true,
      isEntitled: freshEntitlement.isEntitled,
      entitlement: freshEntitlement,
    };
    sessionVerificationCache.set(cacheKey, { timestamp: Date.now(), result: finalResult });
    return finalResult;
  } catch (err: unknown) {
    logger.error("Error verifying Stripe checkout session", err, {
      sessionId,
      orgId: activeOrg.id,
    });
    return {
      success: false,
      isEntitled: false,
      error: "Unable to verify checkout session with Stripe. Please try again or wait for webhook confirmation.",
      code: "STRIPE_VERIFICATION_ERROR",
    };
  }
}
