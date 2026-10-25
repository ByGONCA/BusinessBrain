"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { ChevronDown, ArrowRight } from "lucide-react";

export function LandingFAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);
  const { ref: headerRef, isVisible: isHeaderVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: accordionRef, isVisible: isAccordionVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: ctaRef, isVisible: isCtaVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  const faqs = [
    { q: t.landing.faq.q1, a: t.landing.faq.a1 },
    { q: t.landing.faq.q2, a: t.landing.faq.a2 },
    { q: t.landing.faq.q3, a: t.landing.faq.a3 },
    { q: t.landing.faq.q4, a: t.landing.faq.a4 },
    { q: t.landing.faq.q5, a: t.landing.faq.a5 },
    { q: t.landing.faq.q6, a: t.landing.faq.a6 },
  ];

  return (
    <section
      id="faq"
      className="py-20 md:py-28 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Section Header — Animates when Header enters viewport */}
        <div ref={headerRef} className="text-center">
          <div
            className={`text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.faq.eyebrow}
          </div>
          <h2
            style={{ transitionDelay: "120ms" }}
            className={`mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.faq.title}
          </h2>
          <p
            style={{ transitionDelay: "240ms" }}
            className={`mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.faq.subtitle}
          </p>
        </div>

        {/* FAQ Items Accordion — Cascades as user scrolls to list */}
        <div ref={accordionRef} className="mt-14 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                style={{
                  transitionDelay: `${idx * 80}ms`,
                }}
                className={`rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] shadow-xs overflow-hidden transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isAccordionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <button
                  type="button"
                  id={`faq-question-${idx}`}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  className="flex w-full items-center justify-between p-5 text-left text-sm sm:text-base font-semibold text-[#18181B] dark:text-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl cursor-pointer"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#71717A] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                    }`}
                  />
                </button>

                {/* CSS Grid Rows Trick for Butter-Smooth Expand/Collapse */}
                <div
                  id={`faq-answer-${idx}`}
                  role="region"
                  aria-labelledby={`faq-question-${idx}`}
                  className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed border-t border-[#E5E5E0]/60 dark:border-[#1E1E22]/60">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated FAQ Page Jump Button */}
        <div
          ref={ctaRef}
          className={`mt-12 text-center transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCtaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <Link
            href="/faq"
            className="group inline-flex items-center gap-2 rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-5 py-2.5 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200 shadow-xs"
          >
            <span>Have More Questions? Read Full Enterprise FAQ</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
