"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getStripeClient } from "./client";
import { resolveStripePriceId, getTrialDays } from "./config";
import { SubscriptionTier } from "./types";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";

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

  // Resolve Stripe Price ID server-side
  const stripePriceId = resolveStripePriceId(planId);

  // Check if Stripe is configured in environment
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return {
      error:
        "Stripe is not yet configured in this environment. Please configure STRIPE_SECRET_KEY in .env.local.",
    };
  }

  if (!stripePriceId) {
    return {
      error: `Missing Stripe Price ID for plan "${planId}". Please configure STRIPE_${planId.toUpperCase()}_PRICE_ID in .env.local.`,
    };
  }

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
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
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
