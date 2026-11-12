"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { PROVISIONAL_PRICING } from "@/lib/marketing/config";
import { Check, ArrowRight, Sparkles, ShieldCheck, CreditCard, Clock } from "lucide-react";

export function LandingPricing() {
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("annual");
  const { ref: pricingRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  const isAnnual = billingCycle === "annual";

  const features = [
    t.landing.pricing.feature1,
    t.landing.pricing.feature2,
    t.landing.pricing.feature3,
    t.landing.pricing.feature4,
    t.landing.pricing.feature5,
    t.landing.pricing.feature6,
  ];

  return (
    <section
      id="pricing"
      ref={pricingRef}
      className={`relative py-16 md:py-24 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
            {t.landing.pricing.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl">
            {t.landing.pricing.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            {t.landing.pricing.subtitle}
          </p>

          {/* Billing Cycle Switcher Toggle */}
          <div className="mt-8 inline-flex items-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-1 shadow-xs">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                !isAnnual
                  ? "bg-white dark:bg-[#1B1B20] text-[#18181B] dark:text-[#F4F4F5] shadow-xs font-semibold"
                  : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
              }`}
            >
              {t.landing.pricing.monthly}
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                isAnnual
                  ? "bg-white dark:bg-[#1B1B20] text-[#18181B] dark:text-[#F4F4F5] shadow-xs font-semibold"
                  : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
              }`}
            >
              <span>{t.landing.pricing.annual}</span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                {t.landing.pricing.saveTwoMonths}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="mt-12 mx-auto max-w-lg rounded-2xl border-2 border-blue-600 dark:border-blue-500 bg-[#FAF9F5] dark:bg-[#121215] p-8 shadow-xl relative">
          {/* Price Header */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                €{isAnnual ? "15.80" : PROVISIONAL_PRICING.monthlyPriceEur}
              </span>
              <span className="text-sm font-medium text-[#71717A] dark:text-[#A1A1AA]">
                {t.landing.pricing.perMonth}
              </span>
            </div>

            {isAnnual && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                {t.landing.pricing.billedAnnually}
              </p>
            )}

            <h3 className="mt-6 text-xl font-semibold text-[#18181B] dark:text-[#F4F4F5]">
              {t.landing.pricing.planTitle}
            </h3>
            <p className="mt-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              {t.landing.pricing.planDesc}
            </p>
          </div>

          {/* Features List */}
          <div className="mt-8 pt-6 border-t border-[#E5E5E0] dark:border-[#1E1E22]">
            <span className="text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] uppercase tracking-wider block mb-4">
              {t.landing.pricing.featuresTitle}
            </span>

            <div className="space-y-3 text-xs text-[#52525B] dark:text-[#A1A1AA]">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[#18181B] dark:text-[#F4F4F5]">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace Terms Disclosure */}
          <div className="mt-6 rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#1B1B20] p-3.5 space-y-2 text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Full workspace access to all capabilities and integrations</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>1-click self-serve cancellation anytime in workspace settings</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/signup"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span>{t.landing.pricing.ctaTrial}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/pricing"
              className="flex w-full items-center justify-center rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#1B1B20] px-5 py-2.5 text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#25252C] active:scale-[0.98] transition-colors"
            >
              {t.landing.pricing.ctaViewTiers}
            </Link>
          </div>

          <p className="mt-5 text-[11px] text-[#71717A] dark:text-[#A1A1AA] text-center leading-relaxed">
            {t.landing.pricing.provisionalNotice}
          </p>
        </div>
      </div>
    </section>
  );
}
