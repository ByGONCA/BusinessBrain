"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { PlanConfig, SubscriptionTier } from "@/lib/stripe/types";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { createCheckoutSessionAction } from "@/lib/stripe/actions";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";

interface PricingCardsProps {
  plans: PlanConfig[];
  isAuthenticated: boolean;
  activeOrg: OrganizationWithRole | null;
  currentPlan: SubscriptionTier | null;
  isTrial: boolean;
  isTrialExpired?: boolean;
  hasUsedTrial?: boolean;
  isEntitled?: boolean;
}

export function PricingCards({
  plans,
  isAuthenticated,
  activeOrg,
  currentPlan,
  isTrial,
  isTrialExpired = false,
  hasUsedTrial = false,
  isEntitled = false,
}: PricingCardsProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("annual");
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { ref: containerRef, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.01 });

  const isAnnual = billingCycle === "annual";

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    setErrorMessage(null);

    if (!isAuthenticated) {
      router.push(`/signup?plan=${planId}&billing=${billingCycle}`);
      return;
    }

    if (!activeOrg) {
      router.push("/onboarding");
      return;
    }

    setLoadingPlan(planId);
    try {
      const result = await createCheckoutSessionAction(planId);
      if (result?.error) {
        setErrorMessage(result.error);
        setLoadingPlan(null);
        return;
      }

      if (result?.url) {
        window.location.href = result.url;
        return;
      }

      setErrorMessage("Could not initialize Stripe Checkout session. Please try again.");
      setLoadingPlan(null);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(errObj?.message || "An unexpected error occurred starting checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Instant, responsive billing switcher positioned cleanly at top */}
      <div className="flex justify-center mb-8 sm:mb-12 relative z-20">
        <div className="inline-flex items-center rounded-xl border border-[#E5E5E0] dark:border-[#222228] bg-white/80 dark:bg-[#121215]/90 p-1.5 shadow-xs backdrop-blur-md">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-4 sm:px-5 py-2 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              !isAnnual
                ? "bg-[#18181B] dark:bg-white text-white dark:text-[#18181B] shadow-xs"
                : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
            }`}
          >
            {t.landing.pricing.monthly}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={`flex items-center gap-1.5 rounded-lg px-4 sm:px-5 py-2 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              isAnnual
                ? "bg-[#18181B] dark:bg-white text-white dark:text-[#18181B] shadow-xs"
                : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
            }`}
          >
            <span>{t.landing.pricing.annual}</span>
            <span className="rounded bg-emerald-500/10 dark:bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-auto max-w-lg mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 relative z-20">
          <p className="font-semibold">Checkout Notice</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      )}

      {/* Cards section with architectural "Pricing" watermark dipping behind cards */}
      <div className="relative pt-6 sm:pt-10">
        {/* Giant "Pricing" Display Wordmark — Higher opacity on top, fading to transparent on bottom behind cards */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 -top-14 sm:-top-20 md:-top-28 lg:-top-32 w-full text-center z-0 overflow-hidden"
        >
          <span className="inline-block text-[22vw] sm:text-[19vw] lg:text-[17vw] font-black tracking-[-0.05em] uppercase leading-none select-none pointer-events-none bg-gradient-to-b from-zinc-950/40 via-zinc-950/15 to-transparent dark:from-white/45 dark:via-white/12 dark:to-transparent bg-clip-text text-transparent [mask-image:linear-gradient(to_bottom,black_45%,transparent_98%)]">
            Pricing
          </span>
        </div>

        {/* Pricing Cards Grid — Instant load, zero entrance delay, no layout shift */}
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-3 lg:items-stretch relative z-10">
        {plans.map((plan, idx) => {
          const isCurrentActive = isEntitled && currentPlan === plan.id;
          const isFeatured = plan.id === "pro";

          // Calculate display monthly price based on annual discount
          const displayMonthlyPrice = isAnnual
            ? Math.round((plan.monthlyPriceUsd * 10) / 12)
            : plan.monthlyPriceUsd;

          const annualTotal = displayMonthlyPrice * 12;

          const visibleFeatures = plan.features.filter(
            (f) => !f.toLowerCase().includes("trial")
          );

          return (
            <div
              key={plan.id}
              style={{ transitionDelay: `${idx * 40}ms` }}
              className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-colors duration-150 ${
                isFeatured
                  ? "bg-white dark:bg-[#14151B] border-2 border-blue-600 dark:border-blue-500 shadow-xl shadow-blue-500/5 dark:shadow-blue-500/10"
                  : "bg-white dark:bg-[#111115] border border-[#E5E5E0] dark:border-[#222228] hover:border-zinc-400 dark:hover:border-zinc-600 shadow-sm"
              }`}
            >
              {/* Recommended Badge */}
              {isFeatured && (
                <div className="absolute -top-3 left-6">
                  <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase text-white shadow-xs">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                    {plan.name}
                  </h2>
                </div>

                {/* Price Display */}
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                    ${displayMonthlyPrice}
                  </span>
                  <span className="text-xs font-mono uppercase text-[#71717A] dark:text-[#A1A1AA]">
                    / month
                  </span>
                </div>

                <div className="mt-1 h-5">
                  {isAnnual ? (
                    <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      billed annually (${annualTotal}/year)
                    </p>
                  ) : (
                    <p className="text-[11px] font-mono text-[#71717A] dark:text-[#A1A1AA]">
                      billed monthly, cancel anytime
                    </p>
                  )}
                </div>

                <p className="mt-4 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed min-h-[36px]">
                  {plan.description}
                </p>

                {/* Subtle Divider */}
                <div className="my-6 border-t border-[#E5E5E0] dark:border-[#222228]" />

                {/* Feature List */}
                <div className="space-y-3 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#71717A]">
                    Workspace Capabilities
                  </p>
                  {visibleFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span className="leading-snug text-[#18181B] dark:text-[#F4F4F5]">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer / Call to Action */}
              <div className="mt-8 pt-5 border-t border-[#E5E5E0] dark:border-[#222228]">
                <button
                  type="button"
                  disabled={loadingPlan !== null || isCurrentActive}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
                    isFeatured
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                      : "bg-[#18181B] dark:bg-white text-white dark:text-[#18181B] hover:bg-black dark:hover:bg-zinc-100 shadow-xs"
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Preparing Checkout...</span>
                    </>
                  ) : isCurrentActive ? (
                    <span>{isTrial ? t.landing.pricing.currentPlanTrialing : t.landing.pricing.currentPlanActive}</span>
                  ) : hasUsedTrial ? (
                    <>
                      <span>{t.landing.pricing.selectPlan} {plan.name}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <span>{t.landing.pricing.ctaTrial || "Start 3-Day Free Trial"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
                {/* Transparent 3-Day Free Trial & 1-Click Cancellation disclosure */}
                <p className="mt-2 text-center text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                  {hasUsedTrial ? t.landing.pricing.cancelAnytimeSubtitle : (t.landing.pricing.trialAvailableHelper || "3 days free trial • 1-Click Cancellation")}
                </p>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
