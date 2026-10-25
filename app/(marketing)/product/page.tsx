import { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RealDashboardShowcase } from "@/components/landing/real-dashboard-showcase";
import { WindowsVersionSelector } from "@/components/landing/windows-version-selector";
import { ScrollReveal, ScrollRevealGroup, ScrollRevealItem } from "@/components/landing/scroll-reveal";
import {
  Download,
  ArrowRight,
  Command,
  HardDrive,
  Zap,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "BusinessBrain for Windows — Native Enterprise Workstation",
  description:
    "BusinessBrain is coming natively to Windows. Ultra-low latency memory, global hotkey summons (Ctrl+Shift+Space), offline local cache, and seamless team synchronization.",
};

export default function ProductPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 flex flex-col">
        {/* Section 1: Windows Workstation Hero (Clean Typography, No Pill Bubbles) */}
        <section className="pt-14 pb-12 sm:pt-20 sm:pb-16 px-6 lg:px-8 border-b border-[#E5E5E0] dark:border-[#1E1E22]">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="font-mono text-xs uppercase tracking-widest text-[#71717A] dark:text-[#A1A1AA] font-semibold">
                  Windows Native Workstation &bull; Desktop Preview
                </span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={60}>
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.035em] text-[#18181B] dark:text-[#F4F4F5] max-w-3xl leading-[1.1]">
                Your company&apos;s memory, natively on Windows.
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <p className="mt-5 text-base sm:text-xl text-[#52525B] dark:text-[#A1A1AA] max-w-2xl leading-relaxed font-normal">
                Engineered for speed. Summon company decisions, pull request context, and pages from anywhere with a global shortcut. Built with an offline SQLite memory vault.
              </p>
            </ScrollReveal>

            {/* Direct Download & System Spec Line (Linear / Raycast Style) */}
            <ScrollReveal delay={180}>
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-6 py-3.5 text-sm font-semibold text-[#FAF9F5] dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Preview for Windows</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>

                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-5 py-3.5 text-sm font-medium text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200"
                >
                  View Cloud Plans
                </Link>
              </div>

              {/* Minimalist Spec Row: Pure Typography */}
              <div className="mt-5 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-mono text-[#71717A]">
                <span>Windows 11 / 10</span>
                <span>&bull;</span>
                <span>x64 &amp; ARM64 Native</span>
                <span>&bull;</span>
                <span>DirectComposition 120Hz</span>
                <span>&bull;</span>
                <span>DPAPI Encrypted Vault</span>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 2: Interactive Desktop Workstation Showcase */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal delay={0}>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs text-[#71717A] uppercase tracking-wider">
                    Interactive Live Workstation
                  </span>
                </div>
                <span className="font-mono text-xs text-[#71717A] hidden sm:inline">
                  Real Application UI &bull; Acme Systems Preview
                </span>
              </div>

              {/* Real Dashboard Showcase in Desktop Frame */}
              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] overflow-hidden shadow-xl bg-[#FAF9F5] dark:bg-[#09090B]">
                <RealDashboardShowcase />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Section 3: Dynamic Version Selector & Releases Stream (Raycast / Linear style) */}
        <section className="py-16 sm:py-20 border-t border-[#E5E5E0] dark:border-[#1E1E22] px-6 lg:px-8 bg-white dark:bg-[#0C0C0E]">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal delay={0}>
              <div className="mb-8">
                <span className="font-mono text-xs uppercase tracking-widest text-[#71717A] font-semibold">
                  Windows Changelog &amp; Architecture
                </span>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                  Release cadence and runtime builds.
                </h2>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <WindowsVersionSelector />
            </ScrollReveal>
          </div>
        </section>

        {/* Section 4: Architectural Strengths (Linear Horizontal Stream, NO generic cards) */}
        <section className="py-16 sm:py-20 border-t border-[#E5E5E0] dark:border-[#1E1E22] px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal delay={0}>
              <div className="mb-12">
                <span className="font-mono text-xs uppercase tracking-widest text-[#71717A] font-semibold">
                  Engineered for High-Velocity Teams
                </span>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                  Why a native Windows app changes how companies think.
                </h2>
              </div>
            </ScrollReveal>

            <ScrollRevealGroup baseDelay={50} staggerInterval={50} className="space-y-12">
              {/* Feature 1 */}
              <ScrollRevealItem index={0}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline pb-10 border-b border-[#E5E5E0] dark:border-[#1E1E22]">
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Command className="h-4 w-4 text-blue-500" />
                      <h3 className="text-lg font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                        Instant Global Summon
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-[#71717A]">Ctrl + Shift + Space</span>
                  </div>
                  <div className="md:col-span-8 text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                    Summon company context without leaving your IDE, spreadsheet, or terminal. Search ADRs, retrieve customer contracts, and link pull requests in under 50 milliseconds.
                  </div>
                </div>
              </ScrollRevealItem>

              {/* Feature 2 */}
              <ScrollRevealItem index={1}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline pb-10 border-b border-[#E5E5E0] dark:border-[#1E1E22]">
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-2 mb-1">
                      <HardDrive className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-lg font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                        Offline SQLite Vault
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-[#71717A]">Monotonic Revision IDs</span>
                  </div>
                  <div className="md:col-span-8 text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                    Write specifications, meeting minutes, and architectural notes without internet access. Local SQLite changes journal deterministically and sync conflict-free the moment you reconnect.
                  </div>
                </div>
              </ScrollRevealItem>

              {/* Feature 3 */}
              <ScrollRevealItem index={2}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline">
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-lg font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                        Hardware-Accelerated OLED
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-[#71717A]">Under 90MB RAM</span>
                  </div>
                  <div className="md:col-span-8 text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                    Render large 5,000-node company graphs at 120 FPS. Designed with strict memory budgets so BusinessBrain stays completely unnoticeable during heavy compiler and Docker runs.
                  </div>
                </div>
              </ScrollRevealItem>
            </ScrollRevealGroup>
          </div>
        </section>

        {/* Section 5: Minimalist Bottom Conversion Banner */}
        <section className="py-16 sm:py-20 border-t border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#09090B] text-center px-6">
          <div className="mx-auto max-w-3xl">
            <ScrollReveal delay={0}>
              <h2 className="text-2xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F4F5] tracking-tight">
                Try the web workstation today, get Windows early.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={60}>
              <p className="mt-3 text-sm text-[#52525B] dark:text-[#A1A1AA]">
                Start with our unrestricted 3-day free trial on the web, and your workspace will automatically sync to Windows.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={120}>
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
                  View Plans &amp; Pricing
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
