import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getUserOrganizations, getActiveOrganization } from "./queries";
import { OrganizationWithRole } from "./types";
import { SubscriptionStatus, SubscriptionTier } from "@/lib/stripe/types";
import type { User } from "@supabase/supabase-js";

export interface OrganizationEntitlement {
  isEntitled: boolean;
  status: SubscriptionStatus | "no_subscription";
  plan: SubscriptionTier | null;
  isTrial: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionId: string | null;
}

/**
 * Evaluates whether an organization has active product access (trialing or active paid subscription).
 * Memoized per request to eliminate duplicate database queries.
 */
export const getOrganizationEntitlement = cache(async (
  organizationId: string
): Promise<OrganizationEntitlement> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(`
      id,
      plan,
      status,
      trial_start,
      trial_end,
      current_period_start,
      current_period_end,
      cancel_at_period_end
    `)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      isEntitled: false,
      status: "no_subscription",
      plan: null,
      isTrial: false,
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      subscriptionId: null,
    };
  }

  const isEntitled = data.status === "trialing" || data.status === "active";

  return {
    isEntitled,
    status: data.status as SubscriptionStatus,
    plan: data.plan as SubscriptionTier,
    isTrial: data.status === "trialing",
    trialEnd: data.trial_end,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    subscriptionId: data.id,
  };
});

/**
 * Central server-side access guard.
 *
 * Sequence:
 * 1. hasAuthenticatedUser() -> if not, redirect /login
 * 2. hasOrganization() -> if not, redirect /onboarding
 * 3. hasActiveEntitlement() -> if not, redirect /pricing?reason=subscription_required
 */
export async function verifyAccessOrRedirect(): Promise<{
  user: User;
  organizations: OrganizationWithRole[];
  activeOrg: OrganizationWithRole;
  entitlement: OrganizationEntitlement;
}> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const organizations = await getUserOrganizations();
  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    redirect("/onboarding");
  }

  const entitlement = await getOrganizationEntitlement(activeOrg.id);

  if (!entitlement.isEntitled) {
    redirect("/pricing?reason=subscription_required");
  }

  return {
    user,
    organizations,
    activeOrg,
    entitlement,
  };
}
