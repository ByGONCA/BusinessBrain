"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { ThemeToggle } from "@/components/theme/theme-selector";
import { Menu, X, ArrowRight, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface LandingHeaderUser {
  id?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    [key: string]: unknown;
  };
}

export interface LandingHeaderProps {
  initialUser?: LandingHeaderUser | null;
}

export function LandingHeader({ initialUser }: LandingHeaderProps = {}) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);
  const lastScrollYRef = React.useRef(0);

  // Helper to extract clean user display fields
  const resolveInitialData = (raw?: LandingHeaderUser | null) => {
    if (!raw) return null;
    return {
      id: raw.id,
      email: raw.email,
      name:
        raw.name ||
        raw.user_metadata?.full_name ||
        raw.user_metadata?.name ||
        raw.email?.split("@")[0] ||
        "User",
      avatarUrl:
        raw.avatarUrl ??
        raw.user_metadata?.avatar_url ??
        raw.user_metadata?.picture ??
        null,
    };
  };

  const [user, setUser] = React.useState<{
    id?: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
  } | null>(() => resolveInitialData(initialUser));

  // Authentication status: "loading" | "authenticated" | "unauthenticated"
  const [authStatus, setAuthStatus] = React.useState<"loading" | "authenticated" | "unauthenticated">(() => {
    if (initialUser !== undefined) {
      return initialUser ? "authenticated" : "unauthenticated";
    }
    // Fast path on client: if document has no sb- cookie, user is unauthenticated
    if (typeof document !== "undefined") {
      const hasSbCookie = document.cookie.split(";").some((c) => c.trim().startsWith("sb-"));
      if (!hasSbCookie) return "unauthenticated";
    }
    return "loading";
  });

  const [avatarError, setAvatarError] = React.useState(false);

  // Sync session and listen for real-time auth changes across tabs
  React.useEffect(() => {
    let isMounted = true;

    if (typeof document !== "undefined" && initialUser === undefined) {
      const hasSbCookie = document.cookie.split(";").some((c) => c.trim().startsWith("sb-"));
      if (!hasSbCookie) {
        setAuthStatus("unauthenticated");
      }
    }

    try {
      const supabase = createClient();

      supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
        if (!isMounted) return;
        if (authUser && !error) {
          setUser({
            id: authUser.id,
            email: authUser.email,
            name:
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name ||
              authUser.email?.split("@")[0] ||
              "User",
            avatarUrl:
              authUser.user_metadata?.avatar_url ||
              authUser.user_metadata?.picture ||
              null,
          });
          setAuthStatus("authenticated");
        } else {
          setUser(null);
          setAuthStatus("unauthenticated");
        }
      }).catch(() => {
        if (isMounted) {
          setUser(null);
          setAuthStatus("unauthenticated");
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split("@")[0] ||
              "User",
            avatarUrl:
              session.user.user_metadata?.avatar_url ||
              session.user.user_metadata?.picture ||
              null,
          });
          setAuthStatus("authenticated");
        } else {
          setUser(null);
          setAuthStatus("unauthenticated");
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch {
      if (isMounted) {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    }
  }, [initialUser]);

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  // Smooth scroll treatment for header (hide on scroll down, reveal on scroll up)
  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 15);

      if (mobileMenuOpen) {
        setIsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (currentScrollY < 30) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 80) {
        // Scrolling down -> smoothly slide up / hide header
        setIsVisible(false);
      } else if (currentScrollY < lastScrollYRef.current) {
        // Scrolling up -> smoothly slide down / reveal header
        setIsVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = typeof window !== "undefined" ? window.scrollY : 0;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

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
    { href: "/product", label: t.landing.nav.windowsApp || t.landing.nav.product || "Windows App" },
    { href: "/company-graph", label: t.landing.nav.graph || "Company Graph" },
    { href: "/integrations", label: t.landing.nav.integrations || "Integrations" },
    { href: "/pricing", label: t.landing.nav.pricing || "Pricing" },
    { href: "/faq", label: t.landing.nav.faq || "FAQ" },
  ];

  const dashboardLabel = t.landing.nav.goToDashboard || "Go to dashboard";
  const accountTooltip = user?.email
    ? `${user.email} — ${dashboardLabel}`
    : dashboardLabel;

  return (
    <>
      {/* Floating Minimalist Night/Light Switch: Top-Right of the Screen, Almost Transparent, Pure Icon */}
      <aside
        aria-label="Theme switcher"
        className={`fixed top-3.5 right-4 sm:right-6 z-50 pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"
        }`}
      >
        <ThemeToggle className="h-9 w-9 rounded-xl bg-[#FAF9F5]/70 dark:bg-[#09090B]/70 border border-[#E5E5E0]/70 dark:border-[#1E1E22]/70 backdrop-blur-md shadow-2xs hover:bg-[#FAF9F5] dark:hover:bg-[#18181B] text-[#71717A] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-white" />
      </aside>

      <div
        className={`sticky top-3 z-40 mx-auto w-full max-w-7xl px-4 sm:px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-24 opacity-0 pointer-events-none"
        }`}
      >
        <header
          className={`flex h-14 items-center justify-between rounded-2xl border px-4 sm:px-6 backdrop-blur-md transition-all duration-500 ${
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

          {/* Right Action Stack: Dynamic Authenticated / Visitor Controls */}
          <div className="hidden md:flex items-center gap-3">
            {authStatus === "loading" ? (
              /* Discreet loading state: prevents wrong-button flash with matching height */
              <div
                aria-hidden="true"
                className="h-9 w-9 rounded-xl border border-[#E5E5E0]/60 dark:border-[#1E1E22]/60 bg-black/[0.03] dark:bg-white/[0.04] animate-pulse"
              />
            ) : authStatus === "authenticated" ? (
              /* Authenticated User: Account Avatar / Icon Button leading to /dashboard */
              <Link
                href="/dashboard"
                aria-label={dashboardLabel}
                title={accountTooltip}
                className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5]/90 dark:bg-[#121215]/90 text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#EFEFEA] dark:hover:bg-[#1B1B20] hover:border-[#D4D4D8] dark:hover:border-[#27272A] shadow-2xs transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {user?.avatarUrl && !avatarError ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "User avatar"}
                    onError={() => setAvatarError(true)}
                    className="h-7 w-7 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                  />
                ) : (
                  <User className="h-4 w-4 text-[#52525B] dark:text-[#A1A1AA] transition-colors group-hover:text-[#18181B] dark:group-hover:text-[#F4F4F5]" />
                )}
              </Link>
            ) : (
              /* Unauthenticated Visitor: Sign In & Start Free Trial CTA */
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {t.landing.nav.signIn}
                </Link>

                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-1.5 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-3.5 py-1.5 text-xs font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-xs hover:bg-black dark:hover:bg-white hover:shadow-sm transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span>{t.landing.nav.startTrial}</span>
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Action Controls */}
          <div className="flex md:hidden items-center gap-2">
            {authStatus === "authenticated" && (
              <Link
                href="/dashboard"
                aria-label={dashboardLabel}
                title={accountTooltip}
                className="group flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5]/90 dark:bg-[#121215]/90 text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#EFEFEA] dark:hover:bg-[#1B1B20] transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {user?.avatarUrl && !avatarError ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "User avatar"}
                    onError={() => setAvatarError(true)}
                    className="h-7 w-7 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                  />
                ) : (
                  <User className="h-4 w-4 text-[#52525B] dark:text-[#A1A1AA] transition-colors group-hover:text-[#18181B] dark:group-hover:text-[#F4F4F5]" />
                )}
              </Link>
            )}

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

            {/* Mobile Auth Actions */}
            <div className="mt-4 pt-3 border-t border-[#E5E5E0] dark:border-[#1E1E22]">
              {authStatus === "loading" ? (
                <div
                  aria-hidden="true"
                  className="h-10 w-full rounded-xl bg-black/[0.03] dark:bg-white/[0.04] animate-pulse"
                />
              ) : authStatus === "authenticated" ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-black/[0.02] dark:bg-white/[0.03] px-3.5 py-2.5 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#EFEFEA] dark:hover:bg-[#1E1E22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#141416]">
                      {user?.avatarUrl && !avatarError ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name || "User avatar"}
                          onError={() => setAvatarError(true)}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <User className="h-3.5 w-3.5 text-[#52525B] dark:text-[#A1A1AA]" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="font-semibold text-xs truncate">
                        {user?.name || t.landing.nav.account || "Account"}
                      </span>
                      {user?.email && (
                        <span className="text-[11px] font-normal text-[#71717A] truncate">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium text-xs shrink-0">
                    <span>{dashboardLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
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
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
