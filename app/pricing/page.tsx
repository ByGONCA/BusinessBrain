import { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, HelpCircle, ArrowRight, Zap } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PricingCards } from "./pricing-cards";
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
      <main className="relative flex-1 px-6 pt-12 pb-24 sm:px-12 lg:px-16 overflow-hidden">
        {/* Layer 0: Oversized Architectural Background Typography (Low Contrast & Viewport Cropped) */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 overflow-hidden flex flex-col justify-between z-0"
        >
          {/* Top Architectural Wordmark */}
          <div className="absolute -top-12 sm:-top-20 left-1/2 -translate-x-1/2 text-[18vw] font-black tracking-[-0.07em] text-black/[0.025] dark:text-white/[0.015] whitespace-nowrap leading-none">
            INTELLIGENCE
          </div>

          {/* Central Depth Layer sitting behind the pricing cards */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[26vw] font-black tracking-[-0.08em] text-black/[0.022] dark:text-white/[0.012] whitespace-nowrap leading-none">
            PRICING
          </div>

          {/* Lower Horizon Layer */}
          <div className="absolute -bottom-16 sm:-bottom-24 left-1/2 -translate-x-1/2 text-[19vw] font-black tracking-[-0.07em] text-black/[0.025] dark:text-white/[0.012] whitespace-nowrap leading-none">
            MEMORY
          </div>

          {/* Subtle Radial Ambient Lighting */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-blue-500/[0.03] dark:bg-blue-600/[0.04] blur-[140px] rounded-full pointer-events-none" />
        </div>

        {/* Layer 1: Foreground Content */}
        <div className="relative z-10 mx-auto max-w-6xl text-center">
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

          {/* Editorial Eyebrow & Strong Typographic Hierarchy (No rounded bubble capsules) */}
          <div className="space-y-3">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
              TRANSPARENT &amp; PREDICTABLE INVESTMENT
            </p>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] max-w-4xl mx-auto leading-[1.08]">
              Predictable pricing for your company&apos;s memory
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
              The unified memory and intelligence layer for modern companies. Choose the tier that matches your team&apos;s scale.
            </p>
          </div>

          {/* Layered Pricing Cards Component with Monthly/Annual Switcher */}
          <div className="mt-14 sm:mt-16">
            <PricingCards
              plans={Object.values(SUBSCRIPTION_PLANS)}
              isAuthenticated={!!user}
              activeOrg={activeOrg}
              currentPlan={entitlement?.plan || null}
              isTrial={entitlement?.isTrial || false}
            />
          </div>

          {/* Value Assurance / Buyer Trust Architecture */}
          <div className="mt-24 border-t border-[#E5E5E0] dark:border-[#1E1E22] pt-14">
            <div className="text-left mb-6">
              <span className="text-xs font-mono font-semibold tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
                WORKSPACE ASSURANCES
              </span>
              <h3 className="mt-1 text-xl font-bold text-[#18181B] dark:text-[#F4F4F5]">
                Clear operational policies for modern teams
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white/80 dark:bg-[#121215]/80 p-6 shadow-xs backdrop-blur-md">
                <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-3" />
                <h4 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5]">Private Workspace Isolation</h4>
                <p className="mt-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Every company workspace operates within a strictly isolated database partition. Your documentation, decisions, and system graphs are never shared across tenants.
                </p>
              </div>

              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white/80 dark:bg-[#121215]/80 p-6 shadow-xs backdrop-blur-md">
                <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-3" />
                <h4 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5]">How does workspace onboarding work?</h4>
                <p className="mt-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Get instant access to all features, integrations, and workspace capabilities. You can manage or modify your plan anytime in workspace settings.
                </p>
              </div>

              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white/80 dark:bg-[#121215]/80 p-6 shadow-xs backdrop-blur-md">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-3" />
                <h4 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5]">Can I change plans later?</h4>
                <p className="mt-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Yes, you can upgrade, downgrade, or cancel your workspace subscription at any time with 1 click directly in workspace settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Shared Footer */}
      <LandingFooter />
    </div>
  );
}
