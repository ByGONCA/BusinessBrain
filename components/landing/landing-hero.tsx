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

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Top Centered Hero Content */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Main Headline */}
          <h1
            className={`text-4xl font-semibold tracking-[-0.035em] text-[#18181B] dark:text-[#F4F4F5] sm:text-6xl sm:leading-[1.12] transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeadlineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.hero.headline}
          </h1>

          {/* Supporting Paragraph */}
          <p
            className={`mt-6 text-lg leading-relaxed text-[#52525B] dark:text-[#A1A1AA] sm:text-xl font-normal max-w-2xl mx-auto transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isSubheadlineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.hero.subheadline}
          </p>

          {/* Action CTAs */}
          <div
            className={`mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCtaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Link
              href="/signup"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-7 py-3.5 text-base font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600"
            >
              <span>{t.landing.nav.startTrial || "Start Free Trial"}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/product"
              className="group flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white/90 dark:bg-[#121215]/90 px-6 py-3.5 text-base font-medium text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] hover:border-blue-500/40 dark:hover:border-blue-500/40 active:scale-[0.98] transition-all duration-200 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-2xs"
            >
              <svg
                className="h-4 w-4 text-[#52525B] dark:text-[#A1A1AA] transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.8" />
              </svg>
              <span>{t.landing.hero.windowsAppSoon || "Download for Windows (Soon)"}</span>
            </Link>
          </div>
        </div>

        {/* Live Navigable Desktop Workstation Demonstration (Real Application UI) */}
        <div
          id="demo"
          className={`mt-14 md:mt-20 max-w-[1360px] w-full mx-auto transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isShowcaseVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
          }`}
        >
          <RealDashboardShowcase />
        </div>

        {/* Contextual Conversion Follow-up after Product Demonstration */}
        <div
          className={`mt-8 text-center transition-all duration-900 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isShowcaseVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-3">
            <span className="text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Ready to see your team&apos;s real context in BusinessBrain?
            </span>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
