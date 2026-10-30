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
  organizationId: string,
  clientOverride?: any
): Promise<OrganizationEntitlement> => {
  const supabase = clientOverride || (await createClient());

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

  // Authoritative server-side MFA check: enforce AAL2 if account has active factors
  const supabase = await createClient();
  try {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
      redirect("/auth/mfa");
    }
  } catch (mfaErr) {
    if (mfaErr && typeof mfaErr === "object" && "digest" in mfaErr) {
      throw mfaErr; // Re-throw Next.js redirect exception
    }
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
    if (activeOrg.workspace_type === "personal") {
      // Personal workspaces can access the dashboard interface without paid entitlements,
      // but do NOT receive fictitious Starter entitlements for AI or paid modules.
      return {
        user,
        organizations,
        activeOrg,
        entitlement: {
          ...entitlement,
          isEntitled: false,
          status: "no_subscription",
          plan: null,
        },
      };
    }
    redirect("/pricing?reason=subscription_required");
  }

  return {
    user,
    organizations,
    activeOrg,
    entitlement,
  };
}
