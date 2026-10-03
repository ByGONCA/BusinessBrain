"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { PlanConfig, SubscriptionTier } from "@/lib/stripe/types";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { createCheckoutSessionAction } from "@/lib/stripe/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    setErrorMessage(null);

    if (!isAuthenticated) {
      router.push(`/signup?plan=${planId}`);
      return;
    }

    if (!activeOrg) {
      router.push("/onboarding");
      return;
    }

    setLoadingPlan(planId);
    try {
      const result = await createCheckoutSessionAction(planId);
      if (result.error) {
        setErrorMessage(result.error);
        setLoadingPlan(null);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="mx-auto max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
          <p className="font-semibold">Checkout Notice</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFeatured = plan.id === "pro";

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                isFeatured
                  ? "border-blue-500/60 bg-gradient-to-b from-blue-950/20 to-slate-900/80 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/30"
                  : "border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:border-slate-700"
              }`}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-blue-600 text-white font-semibold">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    7-Day Trial
                  </Badge>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    ${plan.monthlyPriceUsd}
                  </span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {plan.description}
                </p>

                <div className="my-6 border-t border-slate-800/80" />

                <div className="space-y-2.5 text-xs text-slate-300">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    What&apos;s Included
                  </p>
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800/60">
                <Button
                  variant={isFeatured ? "primary" : "secondary"}
                  size="md"
                  disabled={loadingPlan !== null || isCurrent}
                  onClick={() => handleSelectPlan(plan.id)}
                  className="w-full gap-2"
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
                      <span>Start 7-Day Free Trial</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-[10px] text-slate-500">
                  No charge today. Free for 7 days.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
