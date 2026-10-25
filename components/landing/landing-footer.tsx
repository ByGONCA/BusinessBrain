"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage, SUPPORTED_LOCALES } from "@/lib/i18n/context";
import { Locale } from "@/lib/i18n/types";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { Globe } from "lucide-react";

export function LandingFooter() {
  const { t, locale, setLocale } = useLanguage();
  const { ref: footerRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <footer
      ref={footerRef}
      className={`w-full bg-[#FAF9F5] dark:bg-[#09090B] text-[#52525B] dark:text-[#A1A1AA] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-all duration-950 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      {/* Editorial Diagonal Hatch Divider */}
      <div
        className="h-3 w-full border-b border-[#E5E5E0] dark:border-[#1E1E22] opacity-30 dark:opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 8px)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Information (Col 4) — Staged Entrance */}
          <div className="md:col-span-4 flex flex-col justify-between">
            <div>
              {/* Brand Wordmark & Icon (Stage 1: 0ms) */}
              <div
                className={`transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <Link
                  href="/"
                  className="inline-flex items-center gap-2.5 rounded-lg transition-transform duration-200 hover:scale-[1.02] active:scale-95"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181B] dark:bg-[#F4F4F5] text-[#FAF9F5] dark:text-[#18181B] transition-colors duration-200">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="12" cy="18" r="3" />
                      <line x1="8.5" y1="7.5" x2="10" y2="15.5" />
                      <line x1="15.5" y1="7.5" x2="14" y2="15.5" />
                    </svg>
                  </div>
                  <span className="font-semibold text-base tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                    BusinessBrain
                  </span>
                </Link>
              </div>

              {/* Brand Description (Stage 2: 80ms) */}
              <p
                style={{ transitionDelay: "80ms" }}
                className={`mt-3 text-xs leading-relaxed text-[#71717A] dark:text-[#A1A1AA] max-w-sm transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {t.landing.footer.brandDesc}
              </p>
            </div>

            {/* Theme & Locale Switcher (Stage 3: 160ms) */}
            <div
              style={{ transitionDelay: "160ms" }}
              className={`mt-8 flex flex-wrap items-center gap-4 transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <ThemeSelector />

              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-[#71717A]" />
                <div className="flex items-center gap-1">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <button
                      key={loc.code}
                      onClick={() => setLocale(loc.code as Locale)}
                      className={`rounded px-1.5 py-0.5 text-[11px] uppercase font-medium transition-all duration-150 active:scale-95 ${
                        locale === loc.code
                          ? "bg-[#18181B] dark:bg-[#F4F4F5] text-white dark:text-[#18181B] shadow-2xs"
                          : "text-[#71717A] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      {loc.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Columns (Col 8) — Sequential Stagger (120ms, 180ms, 240ms, 300ms) */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8 text-xs">
            {/* Column 1: Product (120ms) */}
            <div
              style={{ transitionDelay: "120ms" }}
              className={`transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <h4 className="font-semibold text-[#18181B] dark:text-[#F4F4F5] uppercase tracking-wider text-[11px]">
                {t.landing.footer.productColumn}
              </h4>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link href="/product" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    {t.landing.footer.workspace}
                  </Link>
                </li>
                <li>
                  <Link href="/company-graph" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    {t.landing.footer.companyGraph}
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    {t.landing.footer.integrations}
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    {t.landing.footer.pricing}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Architecture & Security (180ms) */}
            <div
              style={{ transitionDelay: "180ms" }}
              className={`transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <h4 className="font-semibold text-[#18181B] dark:text-[#F4F4F5] uppercase tracking-wider text-[11px]">
                {t.landing.footer.securityColumn}
              </h4>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <span className="text-[#71717A] dark:text-[#A1A1AA] transition-colors duration-150">
                    {t.landing.footer.dataIsolation}
                  </span>
                </li>
                <li>
                  <span className="text-[#71717A] dark:text-[#A1A1AA] transition-colors duration-150">
                    {t.landing.footer.securityModel}
                  </span>
                </li>
                <li>
                  <span className="text-[#71717A] dark:text-[#A1A1AA] transition-colors duration-150">
                    Monotonic OCC Engine
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 3: Resources & Footer Trial CTA (240ms) */}
            <div
              style={{ transitionDelay: "240ms" }}
              className={`transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <h4 className="font-semibold text-[#18181B] dark:text-[#F4F4F5] uppercase tracking-wider text-[11px]">
                {t.landing.footer.resourcesColumn}
              </h4>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link href="/pricing" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    Subscription Tiers
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    Frequently Asked Questions
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors duration-150 hover:translate-x-0.5 inline-block">
                    Workspace Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="group inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 hover:translate-x-0.5"
                  >
                    <span>{t.landing.nav.startTrial || "Start Free Trial"}</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal (300ms) */}
            <div
              style={{ transitionDelay: "300ms" }}
              className={`transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <h4 className="font-semibold text-[#18181B] dark:text-[#F4F4F5] uppercase tracking-wider text-[11px]">
                {t.landing.footer.legalColumn}
              </h4>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <span className="text-[#71717A] dark:text-[#A1A1AA] cursor-default transition-colors duration-150">
                    {t.landing.footer.terms}
                  </span>
                </li>
                <li>
                  <span className="text-[#71717A] dark:text-[#A1A1AA] cursor-default transition-colors duration-150">
                    {t.landing.footer.privacy}
                  </span>
                </li>
                <li>
                  <span className="text-[10px] text-[#A1A1AA] dark:text-[#71717A] block mt-2 leading-normal">
                    Policies presented during account registration.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar (Stage Final: 380ms) */}
        <div
          style={{ transitionDelay: "380ms" }}
          className={`mt-12 pt-6 border-t border-[#E5E5E0] dark:border-[#1E1E22] flex flex-col sm:flex-row items-center justify-between text-xs text-[#71717A] dark:text-[#A1A1AA] gap-4 transition-all duration-850 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p>© {new Date().getFullYear()} BusinessBrain. {t.landing.footer.rights}</p>
          <p className="text-[11px]">{t.landing.footer.builtForTeams}</p>
        </div>
      </div>
    </footer>
  );
}
