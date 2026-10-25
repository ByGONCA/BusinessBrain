"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { ArrowRight, Check } from "lucide-react";

export function LandingConversionBridge() {
  const { t } = useLanguage();
  const { ref: headerRef, isVisible: isHeaderVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: pillarsRef, isVisible: isPillarsVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: ctaRef, isVisible: isCtaVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  const pillars = [
    {
      title: "Connected Workspace",
      desc: "Collaborative pages, decision records, and revision histories with real-time sync and optimistic concurrency.",
    },
    {
      title: "Company Knowledge Graph",
      desc: "Topological graph traversal mapping relationships between teams, documents, code, and operational telemetry.",
    },
    {
      title: "Context-Grounded AI",
      desc: "Deterministic answers with direct source citations, fully isolated to your organization's memory.",
    },
  ];

  return (
    <section
      className="py-20 md:py-28 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="text-center">
          {/* Eyebrow & Header — Animates when in viewport */}
          <div ref={headerRef}>
            <div
              className={`text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              }`}
            >
              {t.landing.pricing.eyebrow}
            </div>

            <h2
              style={{ transitionDelay: "120ms" }}
              className={`mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              {t.landing.pricing.title}
            </h2>

            <p
              style={{ transitionDelay: "240ms" }}
              className={`mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed max-w-2xl mx-auto transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              {t.landing.pricing.planDesc}
            </p>
          </div>

          {/* Core Capabilities Included — Cascades as user scrolls to pillars */}
          <div
            ref={pillarsRef}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
          >
            {pillars.map((pillar, idx) => (
              <div
                key={idx}
                style={{ transitionDelay: `${idx * 110}ms` }}
                className={`rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-6 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 transition-all duration-950 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isPillarsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
                }`}
              >
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-3">
                  <Check className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">
                    All Plans
                  </span>
                </div>
                <h3 className="font-semibold text-base text-[#18181B] dark:text-[#F4F4F5]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Clear, intentional CTAs without promotional badges */}
          <div
            ref={ctaRef}
            className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCtaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            <Link
              href="/signup"
              className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-7 py-3.5 text-base font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/pricing"
              className="flex w-full sm:w-auto items-center justify-center rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-6 py-3.5 text-base font-medium text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200"
            >
              <span>View Pricing Plans</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
