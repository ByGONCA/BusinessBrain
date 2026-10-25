"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { ThemeToggle } from "@/components/theme/theme-selector";
import { Menu, X, ArrowRight } from "lucide-react";

export function LandingHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Smooth scroll treatment for header
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle escape key to close mobile drawer
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: "/product", label: t.landing.nav.product || "Product" },
    { href: "/company-graph", label: t.landing.nav.graph || "Company Graph" },
    { href: "/integrations", label: t.landing.nav.integrations || "Integrations" },
    { href: "/pricing", label: t.landing.nav.pricing || "Pricing" },
    { href: "/faq", label: t.landing.nav.faq || "FAQ" },
  ];

  return (
    <>
      {/* Floating Minimalist Night/Light Switch: Top-Right of the Screen, Almost Transparent, Pure Icon */}
      <aside
        aria-label="Theme switcher"
        className="fixed top-3.5 right-4 sm:right-6 z-50 pointer-events-auto"
      >
        <ThemeToggle className="h-9 w-9 rounded-xl bg-[#FAF9F5]/70 dark:bg-[#09090B]/70 border border-[#E5E5E0]/70 dark:border-[#1E1E22]/70 backdrop-blur-md shadow-2xs hover:bg-[#FAF9F5] dark:hover:bg-[#18181B] text-[#71717A] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-white" />
      </aside>

      <div className="sticky top-3 z-40 mx-auto w-full max-w-7xl px-4 sm:px-6 transition-all duration-300">
        <header
          className={`flex h-14 items-center justify-between rounded-2xl border px-4 sm:px-6 backdrop-blur-md transition-all duration-300 ${
            isScrolled
              ? "border-[#D4D4D8] dark:border-[#27272A] bg-[#FAF9F5]/95 dark:bg-[#09090B]/95 shadow-md"
              : "border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5]/80 dark:bg-[#09090B]/80 shadow-xs"
          }`}
        >
          {/* Brand Wordmark & Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-lg p-1 transition-transform duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="BusinessBrain Homepage"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181B] dark:bg-[#F4F4F5] text-[#FAF9F5] dark:text-[#18181B] transition-transform duration-200 group-hover:scale-105">
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
            <span className="font-semibold text-sm tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
              BusinessBrain
            </span>
          </Link>

          {/* Desktop Plain Text Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]"
            aria-label="Main Navigation"
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group relative rounded-md px-2.5 py-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#18181B] dark:text-[#F4F4F5] font-semibold"
                      : "hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Stack: Sign In & Primary CTA */}
          <div className="hidden md:flex items-center gap-3">
            {/* Sign In Link */}
            <Link
              href="/login"
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {t.landing.nav.signIn}
            </Link>

            {/* Start Free Trial CTA */}
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-3.5 py-1.5 text-xs font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-xs hover:bg-black dark:hover:bg-white hover:shadow-sm transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span>{t.landing.nav.startTrial}</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Mobile Action Controls */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-lg p-1.5 text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#EFEFEA] dark:hover:bg-[#1E1E22] hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Accessible Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#09090B] p-4 shadow-xl animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col gap-1" aria-label="Mobile Navigation">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-black/[0.05] dark:bg-white/[0.08] text-[#18181B] dark:text-[#F4F4F5] font-semibold"
                        : "text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 pt-3 border-t border-[#E5E5E0] dark:border-[#1E1E22] grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] py-2 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#EFEFEA] dark:hover:bg-[#1E1E22] transition-colors"
              >
                {t.landing.nav.signIn}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] py-2 text-xs font-semibold text-[#FAF9F5] dark:text-[#18181B] transition-colors"
              >
                <span>{t.landing.nav.startTrial}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
