"use client";

import * as React from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import {
  FileText,
  MessageSquare,
  GitPullRequest,
  CreditCard,
  ArrowRight,
  Share2,
  Check,
} from "lucide-react";

export function LandingProblem() {
  const { t } = useLanguage();
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.15 });

  const silos = [
    {
      title: t.landing.problem.siloDocs,
      desc: t.landing.problem.siloDocsDesc,
      icon: FileText,
      tool: "Wikis & Google Docs",
    },
    {
      title: t.landing.problem.siloDecisions,
      desc: t.landing.problem.siloDecisionsDesc,
      icon: MessageSquare,
      tool: "Slack & Email Threads",
    },
    {
      title: t.landing.problem.siloCode,
      desc: t.landing.problem.siloCodeDesc,
      icon: GitPullRequest,
      tool: "GitHub & GitLab Repos",
    },
    {
      title: t.landing.problem.siloFinance,
      desc: t.landing.problem.siloFinanceDesc,
      icon: CreditCard,
      tool: "Stripe & Billing Portals",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Editorial Section Header */}
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-550 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
            {t.landing.problem.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl">
            {t.landing.problem.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            {t.landing.problem.subtitle}
          </p>
        </div>

        {/* Silos Visual Composition vs Unified Operating System */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Disconnected Silos (Left Side - Col 7) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {silos.map((silo, idx) => {
              const Icon = silo.icon;
              return (
                <div
                  key={idx}
                  style={{
                    transitionDelay: `${idx * 80}ms`,
                  }}
                  className={`rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-5 shadow-xs transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    <span className="font-mono text-[10px] uppercase">{silo.tool}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-[#1B1B20] border border-[#E5E5E0] dark:border-[#27272A] text-[#18181B] dark:text-[#F4F4F5] transition-transform duration-200 group-hover:scale-105">
                      <Icon className="h-4 w-4 text-[#71717A] dark:text-[#A1A1AA]" />
                    </div>
                    <h3 className="font-semibold text-sm text-[#18181B] dark:text-[#F4F4F5]">{silo.title}</h3>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                    {silo.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Unified System Transformation (Right Side - Col 5) */}
          <div
            className={`lg:col-span-5 rounded-2xl border border-[#18181B] dark:border-[#27272A] bg-[#18181B] dark:bg-[#121215] p-7 text-[#FAF9F5] shadow-xl transition-all duration-600 delay-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-2xl ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>THE UNIFIED SOLUTION</span>
            </div>

            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              {t.landing.problem.unifiedTitle}
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-[#A1A1AA]">
              {t.landing.problem.unifiedDesc}
            </p>

            <div className="mt-6 space-y-3 pt-6 border-t border-[#27272A] text-xs">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-[#D4D4D8]">
                  Documents automatically link to architectural decisions and meetings.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-[#D4D4D8]">
                  Pull requests from GitHub stay grounded in business requirements.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-[#D4D4D8]">
                  Financial ARR and churn telemetry sync to company milestones.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
