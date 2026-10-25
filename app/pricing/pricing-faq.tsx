"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const PRICING_FAQS: FAQItem[] = [
  {
    question: "How does workspace onboarding work?",
    answer:
      "Get instant access to all features, integrations, and workspace capabilities upon signup. Your workspace is configured automatically and ready for team collaboration.",
  },
  {
    question: "Can I change or cancel my plan later?",
    answer:
      "Yes. You can upgrade, downgrade, or cancel your workspace subscription at any time with 1 click directly in Organization Settings. There are no lock-ins or retention loops.",
  },
  {
    question: "How does private data isolation work?",
    answer:
      "Every company workspace operates within a strictly isolated database partition. Your documentation, decisions, and system graphs are protected by PostgreSQL Row Level Security (RLS) and never shared across tenants.",
  },
  {
    question: "How does the 3-day free trial work?",
    answer:
      "All plans include a 3-day full access free trial. A payment method is securely authorized via Stripe to ensure continuous workspace operations. You will not be charged during the trial, and can cancel anytime before Day 3.",
  },
  {
    question: "What happens if our team grows during a billing cycle?",
    answer:
      "You can add new members at any time. When upgrading between tiers, billing is prorated to the exact day so you only pay for what you use.",
  },
];

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section className="mt-28 border-t border-[#E5E5E0] dark:border-[#1E1E22] pt-16">
      <div className="mx-auto max-w-3xl text-left">
        {/* Section Header */}
        <div className="mb-10 text-center sm:text-left">
          <span className="text-xs font-mono font-semibold tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
            Clear operational answers for modern teams
          </h2>
          <p className="mt-2 text-sm text-[#52525B] dark:text-[#A1A1AA]">
            Everything you need to know about plans, billing, and private workspace security.
          </p>
        </div>

        {/* Vertical Accordion List */}
        <div className="space-y-3">
          {PRICING_FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white/70 dark:bg-[#121215]/80 hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] shadow-xs overflow-hidden backdrop-blur-md transition-colors duration-200"
              >
                <button
                  type="button"
                  id={`pricing-faq-q-${idx}`}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`pricing-faq-a-${idx}`}
                  className="flex w-full items-center justify-between p-5 text-left text-sm sm:text-base font-semibold text-[#18181B] dark:text-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl cursor-pointer"
                >
                  <span className="pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#71717A] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                    }`}
                  />
                </button>

                {/* CSS Grid Rows Smooth Expansion */}
                <div
                  id={`pricing-faq-a-${idx}`}
                  role="region"
                  aria-labelledby={`pricing-faq-q-${idx}`}
                  className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed border-t border-[#E5E5E0]/60 dark:border-[#1E1E22]/60">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
