"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import {
  FileText,
  MessageSquare,
  GitPullRequest,
  CreditCard,
  ArrowRight,
  Check,
} from "lucide-react";

export function LandingProblem() {
  const { t } = useLanguage();
  const { ref: headerRef, isVisible: isHeaderVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: contentRef, isVisible: isContentVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

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
      id="problem"
      className="py-20 md:py-28 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Editorial Section Header — Animates when Header enters viewport */}
        <div ref={headerRef} className="mx-auto max-w-3xl text-center">
          <div
            className={`text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.problem.eyebrow}
          </div>
          <h2
            style={{ transitionDelay: "120ms" }}
            className={`mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.problem.title}
          </h2>
          <p
            style={{ transitionDelay: "240ms" }}
            className={`mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.problem.subtitle}
          </p>
        </div>

        {/* Silos Visual Composition vs Unified Operating System — Animates as user scrolls to this block */}
        <div
          ref={contentRef}
          className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Disconnected Silos (Left Side - Col 7) — Cascading Stagger */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {silos.map((silo, idx) => {
              const Icon = silo.icon;
              return (
                <div
                  key={idx}
                  style={{
                    transitionDelay: `${idx * 120}ms`,
                  }}
                  className={`rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-5 shadow-xs transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md ${
                    isContentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
                  }`}
                >
                  <div className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    <span className="font-mono text-[11px]">{silo.tool}</span>
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
            style={{ transitionDelay: "240ms" }}
            className={`lg:col-span-5 rounded-2xl border border-[#18181B] dark:border-[#27272A] bg-[#18181B] dark:bg-[#121215] p-7 text-[#FAF9F5] shadow-xl transition-all duration-950 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-2xl ${
              isContentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
            }`}
          >
            <h3 className="text-2xl font-semibold tracking-tight text-white">
              {t.landing.problem.unifiedTitle}
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-[#A1A1AA]">
              {t.landing.problem.unifiedDesc}
            </p>

            <div className="mt-6 space-y-3 pt-6 border-t border-[#27272A] text-xs">
              {[
                "Documents automatically link to architectural decisions and meetings.",
                "Pull requests from GitHub stay grounded in business requirements.",
                "Financial ARR and churn telemetry sync to company milestones.",
              ].map((text, i) => (
                <div
                  key={i}
                  style={{ transitionDelay: `${340 + i * 100}ms` }}
                  className={`flex items-start gap-2.5 transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isContentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  }`}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-[#D4D4D8]">{text}</span>
                </div>
              ))}
            </div>

            {/* Contextual CTA right after the solution explanation */}
            <div
              style={{ transitionDelay: "560ms" }}
              className={`mt-8 pt-6 border-t border-[#27272A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isContentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-[#18181B] shadow-sm hover:bg-[#F4F4F5] active:scale-[0.98] transition-all duration-200"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 text-[#18181B]" />
              </Link>
              <span className="text-[11px] text-[#A1A1AA]">
                Connect your company memory in 2 minutes
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
