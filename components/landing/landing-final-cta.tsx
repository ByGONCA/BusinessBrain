"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { ArrowRight } from "lucide-react";

export function LandingFinalCTA() {
  const { t } = useLanguage();
  const { ref: cardRef, isVisible: isCardVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  return (
    <section
      className="py-20 md:py-28 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div
          ref={cardRef}
          className={`relative rounded-3xl border border-[#18181B] dark:border-[#27272A] bg-[#18181B] dark:bg-[#121215] px-8 py-16 sm:px-14 sm:py-20 text-center text-[#FAF9F5] shadow-2xl overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCardVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-8"
          }`}
        >
          {/* Subtle Diagonal Pattern Overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 20px)",
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-2xl">
            {/* Title */}
            <h2
              style={{ transitionDelay: "120ms" }}
              className={`text-3xl sm:text-5xl font-semibold tracking-[-0.035em] text-white sm:leading-[1.15] transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              }`}
            >
              {t.landing.cta.title}
            </h2>

            {/* Subtitle */}
            <p
              style={{ transitionDelay: "240ms" }}
              className={`mt-5 text-base sm:text-lg text-[#A1A1AA] leading-relaxed transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              }`}
            >
              {t.landing.cta.subtitle}
            </p>

            {/* Action Buttons */}
            <div
              style={{ transitionDelay: "360ms" }}
              className={`mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Link
                href="/signup"
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-semibold text-[#18181B] shadow-lg hover:bg-[#F4F4F5] active:scale-[0.98] transition-all duration-200 sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{t.landing.cta.primaryButton}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 text-[#18181B]" />
              </Link>

              <Link
                href="/pricing"
                className="flex w-full items-center justify-center rounded-xl border border-[#3F3F46] bg-[#18181B] dark:bg-[#1B1B20] px-6 py-4 text-base font-semibold text-[#D4D4D8] hover:text-white hover:border-[#71717A] active:scale-[0.98] transition-all duration-200 sm:w-auto"
              >
                {t.landing.cta.secondaryButton}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
