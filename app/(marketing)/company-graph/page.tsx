import { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingGraphSection } from "@/components/landing/landing-graph-section";
import { ScrollReveal, ScrollRevealGroup, ScrollRevealItem } from "@/components/landing/scroll-reveal";
import { Network, Sparkles, GitBranch, ArrowRight, Share2, Compass, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Company Connections Graph — BusinessBrain",
  description:
    "Explore how BusinessBrain links decisions, documentation, code repositories, and teams into a living, queryable knowledge graph.",
};

export default function CompanyGraphPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 flex flex-col">
        {/* Page Hero */}
        <section className="pt-12 pb-8 sm:pt-20 sm:pb-12 text-center px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <ScrollReveal delay={0}>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE] dark:bg-[#121215] px-3 py-1 text-xs font-mono font-medium text-[#71717A] dark:text-[#A1A1AA]">
                <Network className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>DETERMINISTIC RELATIONSHIP ENGINE</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5]">
                The Company Graph connects every part of your business.
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <p className="mt-5 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
                When documents, architectural decisions, repositories, and meetings exist in silos, context dies. The Company Graph turns disparate company data into a living, navigable graph.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Embedded Interactive Graph Showcase */}
        <div className="px-4 sm:px-6 lg:px-8 pb-12">
          <LandingGraphSection />
        </div>

        {/* How the Graph Works: 3 Practical Scenarios */}
        <section className="py-16 sm:py-24 border-t border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#0C0C0E]">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <ScrollReveal delay={0}>
              <div className="text-center max-w-3xl mx-auto">
                <span className="text-xs font-mono tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
                  PRACTICAL UTILITY
                </span>
                <h2 className="mt-2 text-2xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F4F5] tracking-tight">
                  How modern companies query their institutional memory.
                </h2>
              </div>
            </ScrollReveal>

            <ScrollRevealGroup baseDelay={160} staggerInterval={90} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <ScrollRevealItem index={0} className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-5">
                  <Compass className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Instant Engineer Onboarding
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Instead of reading stale READMEs, new team members inspect a repository node and instantly see its controlling ADRs, specification documents, and owning team members.
                </p>
              </ScrollRevealItem>

              <ScrollRevealItem index={1} className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                  <Share2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Audit & Compliance Tracing
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  During security audits or vendor certifications, trace any architectural change back to its original approval meeting, stakeholder sign-offs, and verification pull requests.
                </p>
              </ScrollRevealItem>

              <ScrollRevealItem index={2} className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#121215] p-7 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:bg-white dark:hover:bg-[#16161A] hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  Blast-Radius Impact Analysis
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                  Before deprecating an API or altering a billing flow, follow outgoing edges to see which documentation pages, teams, and integrations depend on that component.
                </p>
              </ScrollRevealItem>
            </ScrollRevealGroup>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] text-center px-6">
          <div className="mx-auto max-w-3xl">
            <ScrollReveal delay={0}>
              <h2 className="text-2xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F4F5] tracking-tight">
                Connect your company&apos;s scattered information today.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <p className="mt-3 text-sm text-[#52525B] dark:text-[#A1A1AA]">
                Explore the graph with your real workspace data during our unrestricted 3-day free trial.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={160}>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181B] dark:bg-[#F4F4F5] px-6 py-3.5 text-xs sm:text-sm font-semibold text-white dark:text-[#18181B] shadow-sm hover:bg-black dark:hover:bg-white active:scale-[0.98] transition-all duration-200"
                >
                  <span>Start 3-Day Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/product"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F3EE] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200"
                >
                  Explore Product Features
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
