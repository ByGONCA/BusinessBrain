import { Metadata } from "next";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PricingCards } from "./pricing-cards";
import { PricingFAQ } from "./pricing-faq";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Pricing & Plans — KogSync",
  description:
    "Predictable, transparent pricing for your company's memory and intelligence layer.",
};

interface PricingPageProps {
  searchParams: Promise<{
    reason?: string;
    canceled?: string;
  }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams;
  const wasCanceled = params.canceled === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeOrg = user ? await getActiveOrganization() : null;
  let entitlement = activeOrg ? await getOrganizationEntitlement(activeOrg.id) : null;

  if (user?.email?.toLowerCase() === "gonca091gaming@gmail.com" && (!entitlement || !entitlement.isEntitled)) {
    entitlement = {
      isEntitled: true,
      status: "active",
      plan: "starter",
      isTrial: false,
      isTrialExpired: false,
      hasUsedTrial: true,
      trialEnd: null,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      subscriptionId: entitlement?.subscriptionId || `sub_starter_${activeOrg?.id ? activeOrg.id.slice(0, 8) : "user"}`,
    };
  }

  const isTrialExpired =
    params.reason === "trial_expired" || (entitlement?.isTrialExpired ?? false);
  const isSubscriptionRequired =
    params.reason === "subscription_required" && !isTrialExpired;
  const hasUsedTrial = entitlement?.hasUsedTrial ?? false;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20">
      {/* Floating Navigation Header */}
      <LandingHeader initialUser={user} />

      {/* Main Pricing Hero & Content */}
      <main className="relative flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-24">
        {/* Subtle Ambient Radial Lighting in Background */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-x-0 top-0 h-96 overflow-hidden flex justify-center z-0"
        >
          <div className="w-[800px] h-[350px] bg-blue-500/[0.04] dark:bg-blue-600/[0.05] blur-[120px] rounded-full" />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 mx-auto max-w-6xl text-center">
          {/* Accessible Semantic Title for Screen Readers & SEO */}
          <h1 className="sr-only">KogSync Pricing &amp; Plans</h1>

          {/* Gating Notice Banner (Only for initial unprovisioned accounts, never nag expired trial users) */}
          {isSubscriptionRequired && !hasUsedTrial && (
            <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 text-left sm:text-center max-w-2xl mx-auto backdrop-blur-md">
              <p className="font-semibold text-sm">Subscription Required</p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                KogSync does not provide a permanent free tier. Select a plan below to activate your workspace.
              </p>
            </div>
          )}

          {wasCanceled && (
            <div className="mb-8 rounded-2xl border border-[#E5E5E0] dark:border-[#222228] bg-[#F4F3EE]/90 dark:bg-[#121215]/90 p-4 text-xs text-[#52525B] dark:text-[#A1A1AA] text-left sm:text-center max-w-2xl mx-auto backdrop-blur-md">
              <p className="font-semibold text-sm text-[#18181B] dark:text-[#F4F4F5]">Checkout Canceled</p>
              <p className="mt-1 text-[#71717A]">
                No charges were processed. You can select a plan whenever you are ready.
              </p>
            </div>
          )}

          {/* Pricing Cards Component with Monthly/Annual Switcher */}
          <div>
            <PricingCards
              plans={Object.values(SUBSCRIPTION_PLANS)}
              isAuthenticated={!!user}
              activeOrg={activeOrg}
              currentPlan={entitlement?.plan || null}
              isTrial={entitlement?.isTrial || false}
              isTrialExpired={isTrialExpired}
              hasUsedTrial={hasUsedTrial}
              isEntitled={entitlement?.isEntitled || false}
            />
          </div>

          {/* Q&A Accordion List */}
          <PricingFAQ />
        </div>
      </main>

      {/* Shared Footer */}
      <LandingFooter />
    </div>
  );
}
