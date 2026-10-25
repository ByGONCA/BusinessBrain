"use client";

import * as React from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScrollReveal, ScrollRevealGroup, ScrollRevealItem } from "@/components/landing/scroll-reveal";
import { useLanguage } from "@/lib/i18n/context";
import { ChevronDown, ArrowRight } from "lucide-react";

export default function FAQPage() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const faqItems = [
    {
      question: t.landing.faq.q1,
      answer: t.landing.faq.a1,
    },
    {
      question: t.landing.faq.q2,
      answer: t.landing.faq.a2,
    },
    {
      question: t.landing.faq.q3,
      answer: t.landing.faq.a3,
    },
    {
      question: t.landing.faq.q4,
      answer: t.landing.faq.a4,
    },
    {
      question: t.landing.faq.q5,
      answer: t.landing.faq.a5,
    },
    {
      question: t.landing.faq.q6,
      answer: t.landing.faq.a6,
    },
    {
      question: "Why is a payment method required upfront for the 3-day trial?",
      answer: "BusinessBrain is an enterprise operating system built for active teams. Collecting a payment method upfront ensures uninterrupted workspace access for your team at the end of the trial, prevents bot abuse, and guarantees continuous synchronization with external integrations. You are never charged during the 3-day trial and can cancel with 1 click in workspace settings before Day 3.",
    },
    {
      question: "Are our proprietary documents used to train public AI models?",
      answer: "No. Never. BusinessBrain enforces strict tenant data boundaries. Your documents, decisions, and integration metadata remain private to your organization and are never shared, sold, or used to fine-tune public foundation models.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 flex flex-col">
        {/* Page Hero */}
        <section className="pt-16 pb-10 sm:pt-24 sm:pb-14 text-center px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <ScrollReveal delay={0}>
              <span className="text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
                {t.landing.faq.eyebrow}
              </span>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <h1 className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5]">
                {t.landing.faq.title}
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <p className="mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
                {t.landing.faq.subtitle}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Clean Accordion List Section matching Landing Page with Staggered Scroll Reveals */}
        <section className="pb-24 px-6 lg:px-8">
          <ScrollRevealGroup baseDelay={100} staggerInterval={50} className="mx-auto max-w-3xl space-y-3">
            {faqItems.map((item, idx) => {
              const isOpen = openIndex === idx;

              return (
                <ScrollRevealItem key={idx} index={idx}>
                  <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] transition-colors overflow-hidden shadow-xs">
                    <button
                      type="button"
                      id={`faq-page-q-${idx}`}
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-page-a-${idx}`}
                      className="flex w-full items-center justify-between p-5 sm:p-6 text-left text-sm sm:text-base font-semibold text-[#18181B] dark:text-[#F4F4F5] transition-colors hover:bg-black/[0.01] dark:hover:bg-white/[0.02] cursor-pointer"
                    >
                      <span className="pr-4">{item.question}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#71717A] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                        }`}
                      />
                    </button>

                    {/* Smooth CSS Grid Row Expansion */}
                    <div
                      id={`faq-page-a-${idx}`}
                      role="region"
                      aria-labelledby={`faq-page-q-${idx}`}
                      className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-6 sm:px-6 pt-1 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed border-t border-[#E5E5E0]/60 dark:border-[#1E1E22]/60">
                          {item.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollRevealItem>
              );
            })}
          </ScrollRevealGroup>
        </section>

        {/* Still have questions CTA */}
        <section className="py-16 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] text-center px-6">
          <div className="mx-auto max-w-3xl">
            <ScrollReveal delay={0}>
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                Still have questions about BusinessBrain?
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <p className="mt-2 text-sm text-[#52525B] dark:text-[#A1A1AA]">
                Experience the platform first-hand. Unify your documents, decisions, and system graphs.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={160}>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-6 py-3.5 text-xs sm:text-sm font-semibold text-white dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200"
                >
                  <span>Start 3-Day Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F3EE] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200"
                >
                  Review Plans & Pricing
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
