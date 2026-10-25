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
  title: "Pricing & Plans — BusinessBrain",
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
  const isSubscriptionRequired = params.reason === "subscription_required";
  const wasCanceled = params.canceled === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeOrg = user ? await getActiveOrganization() : null;
  const entitlement = activeOrg ? await getOrganizationEntitlement(activeOrg.id) : null;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased transition-colors overflow-x-hidden selection:bg-blue-600/20">
      {/* Floating Navigation Header */}
      <LandingHeader />

      {/* Main Pricing Hero & Content with Layered Oversized Background Typography */}
      <main className="relative flex-1 px-6 pt-6 sm:pt-10 pb-24 sm:px-12 lg:px-16 overflow-hidden">
        {/* Layer 0: Oversized Architectural Background Typography (Low Contrast & Viewport Cropped) */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 overflow-hidden flex flex-col items-center z-0"
        >
          {/* Giant "Pricing" Display Wordmark Behind Top Content */}
          <div className="absolute -top-4 sm:-top-8 md:-top-12 left-1/2 -translate-x-1/2 text-[22vw] sm:text-[20vw] lg:text-[18vw] font-black tracking-[-0.06em] text-zinc-950/[0.045] dark:text-white/[0.065] whitespace-nowrap leading-none select-none pointer-events-none">
            Pricing
          </div>

          {/* Central & Lower Horizon Layers for Ambient Depth */}
          <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[26vw] font-black tracking-[-0.08em] text-black/[0.015] dark:text-white/[0.012] whitespace-nowrap leading-none">
            INTELLIGENCE
          </div>

          {/* Subtle Radial Ambient Lighting */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-blue-500/[0.03] dark:bg-blue-600/[0.04] blur-[140px] rounded-full pointer-events-none" />
        </div>

        {/* Layer 1: Foreground Content */}
        <div className="relative z-10 mx-auto max-w-6xl text-center">
          {/* Accessible Semantic Title for Screen Readers & SEO */}
          <h1 className="sr-only">Pricing &amp; Plans — BusinessBrain</h1>

          {/* Gating Notice Banner */}
          {isSubscriptionRequired && (
            <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 text-left sm:text-center max-w-2xl mx-auto backdrop-blur-md">
              <p className="font-semibold text-sm">Subscription Required</p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                BusinessBrain does not provide a permanent free tier. Select a plan below to activate your workspace.
              </p>
            </div>
          )}

          {wasCanceled && (
            <div className="mb-8 rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE]/90 dark:bg-[#121215]/90 p-4 text-xs text-[#52525B] dark:text-[#A1A1AA] text-left sm:text-center max-w-2xl mx-auto backdrop-blur-md">
              <p className="font-semibold text-sm text-[#18181B] dark:text-[#F4F4F5]">Checkout Canceled</p>
              <p className="mt-1 text-[#71717A]">
                No charges were processed. You can select a plan whenever you are ready.
              </p>
            </div>
          )}

          {/* Layered Pricing Cards Component with Monthly/Annual Switcher */}
          <div className="mt-6 sm:mt-10">
            <PricingCards
              plans={Object.values(SUBSCRIPTION_PLANS)}
              isAuthenticated={!!user}
              activeOrg={activeOrg}
              currentPlan={entitlement?.plan || null}
              isTrial={entitlement?.isTrial || false}
            />
          </div>

          {/* Q&A Accordion List (Matching Landing Page Style) */}
          <PricingFAQ />
        </div>
      </main>

      {/* Shared Footer */}
      <LandingFooter />
    </div>
  );
}
