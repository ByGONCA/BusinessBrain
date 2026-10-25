"use client";

import * as React from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { Sparkles, FileText, Scale } from "lucide-react";

export function LandingAISection() {
  const { t } = useLanguage();
  const { ref: headerRef, isVisible: isHeaderVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: cardRef, isVisible: isCardVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  return (
    <section
      className="py-20 md:py-28 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header — Animates when Header enters viewport */}
        <div ref={headerRef} className="mx-auto max-w-3xl text-center">
          <div
            className={`text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.ai.eyebrow}
          </div>
          <h2
            style={{ transitionDelay: "120ms" }}
            className={`mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.ai.title}
          </h2>
          <p
            style={{ transitionDelay: "240ms" }}
            className={`mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.ai.subtitle}
          </p>
        </div>

        {/* AI Interaction Simulation Card — Animates when scrolled into view */}
        <div
          ref={cardRef}
          className={`mt-14 mx-auto max-w-4xl rounded-2xl border border-[#27272A] bg-[#09090B] p-6 sm:p-9 shadow-2xl text-[#F4F4F5] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
          }`}
        >
          {/* Top Status */}
          <div
            style={{ transitionDelay: "120ms" }}
            className={`flex items-center justify-between border-b border-[#1E1E22] pb-4 text-xs text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="font-semibold text-white">Grounded Memory Retrieval</span>
            </div>
            <span className="text-[11px] font-mono text-indigo-400">
              Active Knowledge Engine
            </span>
          </div>

          {/* User Query Box */}
          <div
            style={{ transitionDelay: "220ms" }}
            className={`mt-6 rounded-xl border border-[#1E1E22] bg-[#121215] p-4 text-sm transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <span className="text-[10px] font-mono text-[#71717A] uppercase font-semibold block mb-1">
              Founder / Executive Query
            </span>
            <p className="font-medium text-[#FAF9F5] sm:text-base">
              &quot;{t.landing.ai.sampleQuestion}&quot;
            </p>
          </div>

          {/* Grounded Response */}
          <div
            style={{ transitionDelay: "340ms" }}
            className={`mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-xs sm:text-sm text-indigo-100 transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <div className="text-indigo-400 font-mono text-xs font-semibold uppercase mb-2">
              <span>{t.landing.ai.answeringLabel}</span>
            </div>

            <p className="leading-relaxed text-indigo-100/95 font-normal">
              {t.landing.ai.sampleAnswer}
            </p>

            {/* Clickable Source Citations */}
            <div className="mt-6 pt-4 border-t border-indigo-500/20">
              <span className="text-xs font-semibold text-indigo-300 block mb-2">
                {t.landing.ai.citationsLabel}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  style={{ transitionDelay: "460ms" }}
                  className={`rounded-lg border border-indigo-500/30 bg-[#09090B]/60 p-2.5 flex items-center justify-between text-xs hover:border-indigo-400 hover:bg-[#09090B]/80 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer ${
                    isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="font-medium text-white">{t.landing.ai.citation1Title}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{t.landing.ai.citation1Type}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400">View Record</span>
                </div>

                <div
                  style={{ transitionDelay: "540ms" }}
                  className={`rounded-lg border border-indigo-500/30 bg-[#09090B]/60 p-2.5 flex items-center justify-between text-xs hover:border-indigo-400 hover:bg-[#09090B]/80 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer ${
                    isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="font-medium text-white">{t.landing.ai.citation2Title}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{t.landing.ai.citation2Type}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400">Open Page</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Quality Verification Note */}
          <div
            style={{ transitionDelay: "620ms" }}
            className={`mt-6 pt-4 border-t border-[#1E1E22] flex flex-col sm:flex-row items-center justify-between text-xs text-[#71717A] gap-2 transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <span>Deterministic Context Ingestion • Never trained on public foundation datasets</span>
            <span className="font-mono text-white text-[11px]">100% Verifiable Citations</span>
          </div>
        </div>
      </div>
    </section>
  );
}
