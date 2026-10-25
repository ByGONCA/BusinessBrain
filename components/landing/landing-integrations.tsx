"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { MARKETING_INTEGRATIONS } from "@/lib/marketing/config";
import { CheckCircle2, Clock, ArrowRight } from "lucide-react";

export function LandingIntegrations() {
  const { t } = useLanguage();
  const [selectedFilter, setSelectedFilter] = React.useState<string>("all");
  const { ref: headerRef, isVisible: isHeaderVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: gridRef, isVisible: isGridVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: ctaRef, isVisible: isCtaVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  const filteredIntegrations = MARKETING_INTEGRATIONS.filter((item) => {
    if (selectedFilter === "all") return true;
    return item.category === selectedFilter;
  });

  return (
    <section
      id="integrations"
      className="py-20 md:py-28 bg-white dark:bg-[#0C0C0E] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header — Animates when Header enters viewport */}
        <div ref={headerRef} className="mx-auto max-w-3xl text-center">
          <div
            className={`text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA] transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            {t.landing.integrations.eyebrow}
          </div>
          <h2
            style={{ transitionDelay: "120ms" }}
            className={`mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.integrations.title}
          </h2>
          <p
            style={{ transitionDelay: "240ms" }}
            className={`mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {t.landing.integrations.subtitle}
          </p>

          {/* Category Filter Tabs */}
          <div
            style={{ transitionDelay: "340ms" }}
            className={`mt-8 flex flex-wrap items-center justify-center gap-2 transition-all duration-800 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isHeaderVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {[
              { id: "all", label: t.landing.integrations.filterAll },
              { id: "engineering", label: t.landing.integrations.filterEngineering },
              { id: "commerce", label: t.landing.integrations.filterCommerce },
              { id: "communication", label: t.landing.integrations.filterCommunication },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selectedFilter === tab.id
                    ? "bg-[#18181B] dark:bg-[#F4F4F5] text-white dark:text-[#18181B] shadow-xs font-semibold"
                    : "bg-[#F4F4F5] dark:bg-[#16161A] text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#E4E4E7] dark:hover:bg-[#202026] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Integration Grid with Staggered Scroll Reveal — Cascades as user scrolls down to cards */}
        <div
          ref={gridRef}
          className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {filteredIntegrations.map((item, idx) => {
            const isLive = item.status === "active";

            return (
              <div
                key={item.id}
                style={{
                  transitionDelay: `${(idx % 4) * 110}ms`,
                }}
                className={`group rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-6 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between ${
                  isGridVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#1B1B20] border border-[#E5E5E0] dark:border-[#27272A] p-2 transition-transform duration-200 group-hover:scale-105">
                      <img
                        src={item.logoUrl}
                        alt={`${item.name} logo`}
                        className="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                    </div>

                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{t.landing.integrations.activeLabel}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#71717A] dark:text-[#A1A1AA]">
                        <Clock className="h-3 w-3" />
                        <span>{t.landing.integrations.roadmapLabel}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-semibold text-base text-[#18181B] dark:text-[#F4F4F5]">
                    {item.name}
                  </h3>

                  <p className="mt-1.5 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-[#E5E5E0] dark:border-[#1E1E22] flex items-center justify-between text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                  <span className="capitalize">{item.category}</span>
                  <span className="font-mono text-[10px] uppercase">
                    {isLive ? "Bi-directional" : "Planned"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated Ecosystem Page Jump Button */}
        <div
          ref={ctaRef}
          className={`mt-12 text-center transition-all duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCtaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <Link
            href="/integrations"
            className="group inline-flex items-center gap-2 rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-5 py-2.5 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200 shadow-xs"
          >
            <span>Explore Complete Ecosystem Directory & API Connectors</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
