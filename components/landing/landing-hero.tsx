"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useHeroSequence } from "@/lib/hooks/use-scroll-reveal";
import { RealDashboardShowcase } from "./real-dashboard-showcase";
import { ArrowRight } from "lucide-react";

export function LandingHero() {
  const { t } = useLanguage();
  const {
    isEyebrowVisible,
    isHeadlineVisible,
    isSubheadlineVisible,
    isCtaVisible,
    isShowcaseVisible,
  } = useHeroSequence();

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28">
      {/* Subtle Editorial Diagonal Background Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 24px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Top Centered Hero Content */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Step 1: Status Label (Clean typography, NO fake bubble pill buttons) */}
          <div
            className={`inline-flex items-center gap-2 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isEyebrowVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t.landing.hero.trialBadge}</span>
          </div>

          {/* Step 2: Main Headline (fast reveal, visible almost immediately) */}
          <h1
            className={`mt-5 text-4xl font-semibold tracking-[-0.035em] text-[#18181B] dark:text-[#F4F4F5] sm:text-6xl sm:leading-[1.12] transition-all duration-550 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isHeadlineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            {t.landing.hero.headline}
          </h1>

          {/* Step 3: Supporting Paragraph */}
          <p
            className={`mt-6 text-lg leading-relaxed text-[#52525B] dark:text-[#A1A1AA] sm:text-xl font-normal max-w-2xl mx-auto transition-all duration-550 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isSubheadlineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            {t.landing.hero.subheadline}
          </p>

          {/* Step 4: Action CTAs */}
          <div
            className={`mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isCtaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <Link
              href="/signup"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-6 py-3.5 text-base font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600"
            >
              <span>{t.landing.hero.primaryCta}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/product"
              className="flex w-full items-center justify-center rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-6 py-3.5 text-base font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] hover:border-[#A1A1AA] dark:hover:border-[#3F3F46] active:scale-[0.98] transition-all duration-200 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {t.landing.hero.secondaryCta}
            </Link>
          </div>
        </div>

        {/* Step 5: Live Navigable Desktop Workstation Demonstration (Real Application UI) */}
        <div
          id="demo"
          className={`mt-14 md:mt-20 max-w-6xl mx-auto transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isShowcaseVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <RealDashboardShowcase />
        </div>
      </div>
    </section>
  );
}
