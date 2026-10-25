"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowRight, ShieldCheck, CreditCard, Clock } from "lucide-react";
import { PlanConfig, SubscriptionTier } from "@/lib/stripe/types";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { createCheckoutSessionAction } from "@/lib/stripe/actions";
import { useLanguage } from "@/lib/i18n/context";

interface PricingCardsProps {
  plans: PlanConfig[];
  isAuthenticated: boolean;
  activeOrg: OrganizationWithRole | null;
  currentPlan: SubscriptionTier | null;
  isTrial: boolean;
}

export function PricingCards({
  plans,
  isAuthenticated,
  activeOrg,
  currentPlan,
  isTrial,
}: PricingCardsProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("annual");
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
    <div className="relative space-y-10">
      {/* Editorial Billing Cycle Switcher */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-xl border border-[#E5E5E0] dark:border-[#222228] bg-white/70 dark:bg-[#121215]/80 p-1.5 backdrop-blur-md shadow-xs">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-5 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
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
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              isAnnual
                ? "bg-[#18181B] dark:bg-white text-white dark:text-[#18181B] shadow-xs"
                : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
            }`}
          >
            <span>{t.landing.pricing.annual}</span>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              — {t.landing.pricing.saveTwoMonths}
            </span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 backdrop-blur-md">
          <p className="font-semibold">Checkout Notice</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      )}

      {/* Layered Pricing Cards Grid with Foreground Elevation and Z-Index Hierarchy */}
      <div className="grid grid-cols-1 gap-8 text-left lg:grid-cols-3 lg:items-stretch relative z-10 pt-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFeatured = plan.id === "pro";

          // Calculate display monthly price based on annual discount
          const displayMonthlyPrice = isAnnual
            ? Math.round((plan.monthlyPriceUsd * 10) / 12)
            : plan.monthlyPriceUsd;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-7 sm:p-9 transition-all duration-300 backdrop-blur-xl ${
                isFeatured
                  ? "bg-white dark:bg-[#141419] border-2 border-[#18181B] dark:border-blue-500/80 shadow-2xl shadow-blue-950/15 dark:shadow-blue-900/25 lg:-translate-y-2 z-20"
                  : "bg-white/80 dark:bg-[#121215]/80 border border-[#E5E5E0] dark:border-[#222228] hover:border-[#D4D4D8] dark:hover:border-[#33333F] shadow-lg shadow-black/[0.03] dark:shadow-black/30 z-10"
              }`}
            >
              {/* Refined Recommended Tag (No rounded bubble pill) */}
              {isFeatured && (
                <div className="absolute -top-3 left-8">
                  <span className="rounded-md bg-[#18181B] dark:bg-blue-600 px-3 py-1 text-[10px] font-mono font-bold tracking-widest uppercase text-white shadow-sm">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                    {plan.name}
                  </h3>
                </div>

                {/* Price Display */}
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                    ${displayMonthlyPrice}
                  </span>
                  <span className="text-xs font-mono uppercase text-[#71717A] dark:text-[#A1A1AA]">
                    / month
                  </span>
                </div>

                {isAnnual && (
                  <p className="mt-1 text-[11px] font-mono text-[#71717A] dark:text-[#A1A1AA]">
                    billed annually (${displayMonthlyPrice * 12}/year)
                  </p>
                )}

                <p className="mt-4 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed min-h-[40px]">
                  {plan.description}
                </p>

                {/* Subtle Divider */}
                <div className="my-7 border-t border-[#E5E5E0] dark:border-[#222228]" />

                {/* Feature List with Crisp Minimal Checkmarks */}
                <div className="space-y-3.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#71717A]">
                    Workspace Capabilities
                  </p>
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span className="leading-snug text-[#18181B] dark:text-[#F4F4F5]">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer / Call to Action */}
              <div className="mt-9 pt-5 border-t border-[#E5E5E0] dark:border-[#222228]">
                <button
                  type="button"
                  disabled={loadingPlan !== null || isCurrent}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
                    isFeatured
                      ? "bg-[#18181B] dark:bg-[#F4F4F5] text-white dark:text-[#18181B] hover:bg-black dark:hover:bg-white shadow-md"
                      : "border border-[#E5E5E0] dark:border-[#222228] bg-[#F4F3EE] dark:bg-[#1B1B20] text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#EAEAE5] dark:hover:bg-[#25252D]"
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Preparing Checkout...</span>
                    </>
                  ) : isCurrent ? (
                    <span>Current Plan {isTrial ? "(Trialing)" : "(Active)"}</span>
                  ) : (
                    <>
                      <span>Start 3-Day Free Trial</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
                <p className="mt-2.5 text-center text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                  Cancel anytime with 1 click in workspace settings
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer 2: Transparent Plan Conditions Disclosure Box (Refined Typography) */}
      <div className="mx-auto max-w-4xl rounded-3xl border border-[#E5E5E0] dark:border-[#222228] bg-white/80 dark:bg-[#121215]/80 p-7 sm:p-8 shadow-xs backdrop-blur-xl relative z-10 text-left">
        <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-[#18181B] dark:text-[#F4F4F5] mb-4">
          Transparent Billing &amp; Workspace Terms
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#52525B] dark:text-[#A1A1AA]">
          <div className="flex items-start gap-3">
            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#18181B] dark:text-[#F4F4F5]">Secure Processing</p>
              <p className="mt-1 leading-relaxed text-[11px]">
                Collected securely upfront via Stripe to prevent interrupted workspace operations.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#18181B] dark:text-[#F4F4F5]">Transparent Invoicing</p>
              <p className="mt-1 leading-relaxed text-[11px]">
                Full continuous access. Invoicing schedules and receipts are accessible anytime in Settings.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#18181B] dark:text-[#F4F4F5]">1-Click Cancellation</p>
              <p className="mt-1 leading-relaxed text-[11px]">
                Cancel anytime in Settings with 1 click. Zero complicated retention flows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
