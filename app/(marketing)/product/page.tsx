import { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RealDashboardShowcase } from "@/components/landing/real-dashboard-showcase";
import { Sparkles, Layers, ShieldCheck, GitBranch, ArrowRight, Zap, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Product Overview & Live Workstation — BusinessBrain",
  description:
    "Explore the BusinessBrain connected operating system. Interactive live demonstration of workspace pages, decision records, company graph, and financial telemetry.",
};

export default function ProductPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 flex flex-col">
        {/* Page Hero */}
        <section className="pt-12 pb-8 sm:pt-20 sm:pb-12 text-center px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE] dark:bg-[#121215] px-3 py-1 text-xs font-mono font-medium text-[#71717A] dark:text-[#A1A1AA]">
              <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>NAVIGABLE PRODUCT DEMONSTRATION</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5]">
              A connected operating system for your company&apos;s memory.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
              BusinessBrain brings company documents, strategic decision logs, relationship graphs, and telemetry into one living interface. Explore the fully interactive workstation below.
            </p>
          </div>
        </section>

        {/* Interactive Product Workstation Demo */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="mx-auto max-w-7xl">
            <RealDashboardShowcase />
          </div>
        </section>

        {/* Deep Dive Pillars */}
        <section className="py-16 sm:py-24 border-t border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#0C0C0E]">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="text-xs font-mono tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
                CORE ARCHITECTURAL PILLARS
              </span>
              <h2 className="mt-2 text-2xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F4F5] tracking-tight">
                Engineered for teams that cannot afford to lose context.
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Pillar 1 */}
              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Monotonic OCC Block Editor
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Write documents, wikis, and specifications with revision-locked concurrency control. Automatic conflict detection and snapshots prevent lost edits during multi-user collaboration.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5">
                  <GitBranch className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Institutional Decision Log (ADRs)
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Every technical choice, vendor selection, and pricing change is recorded with context, drivers, options considered, and trade-offs. New hires understand &quot;why&quot; instantly.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Cross-Entity Knowledge Graph
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Pages, decision logs, pull requests, and meetings connect in a deterministic BFS graph. Discover dependencies across departments with zero manual link maintenance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final Conversion Banner */}
        <section className="py-16 sm:py-20 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] text-center px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F4F5] tracking-tight">
              Ready to give your company a shared institutional memory?
            </h2>
            <p className="mt-3 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Start your unrestricted 3-day free trial today. Set up your workspace in less than two minutes.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-6 py-3.5 text-xs sm:text-sm font-semibold text-white dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white transition-all active:scale-95"
              >
                <span>Start 3-Day Free Trial</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F3EE] dark:hover:bg-[#1B1B20] transition-colors"
              >
                View Plans & Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
