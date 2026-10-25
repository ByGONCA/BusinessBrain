"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import {
  FileText,
  Share2,
  GitBranch,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";

type ShowcaseTab = "workspace" | "graph" | "integrations" | "ai";

export function LandingShowcase() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = React.useState<ShowcaseTab>("workspace");
  const { ref: showcaseRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  const tabs = [
    {
      id: "workspace" as ShowcaseTab,
      label: t.landing.showcase.tabWorkspace,
      desc: t.landing.showcase.tabWorkspaceDesc,
      icon: FileText,
      badge: "OCC v14",
    },
    {
      id: "graph" as ShowcaseTab,
      label: t.landing.showcase.tabGraph,
      desc: t.landing.showcase.tabGraphDesc,
      icon: Share2,
      badge: "O(V + E)",
    },
    {
      id: "integrations" as ShowcaseTab,
      label: t.landing.showcase.tabIntegrations,
      desc: t.landing.showcase.tabIntegrationsDesc,
      icon: GitBranch,
      badge: "Live Telemetry",
    },
    {
      id: "ai" as ShowcaseTab,
      label: t.landing.showcase.tabAI,
      desc: t.landing.showcase.tabAIDesc,
      icon: Sparkles,
      badge: "Context Grounded",
    },
  ];

  const scrollToDemo = () => {
    const demoEl = document.getElementById("demo");
    if (demoEl) {
      demoEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="showcase"
      ref={showcaseRef}
      className={`py-20 md:py-28 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-mono font-medium tracking-widest uppercase text-[#71717A]">
            {t.landing.showcase.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl">
            {t.landing.showcase.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            {t.landing.showcase.subtitle}
          </p>
        </div>

        {/* Interactive Showcase Container (Sidebar on left, Canvas on right) */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Tab Navigation */}
          <div className="lg:col-span-4 flex flex-col gap-2.5">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    transitionDelay: `${idx * 60}ms`,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      const idx = tabs.findIndex((t) => t.id === tab.id);
                      if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].id);
                    } else if (e.key === "ArrowUp") {
                      const idx = tabs.findIndex((t) => t.id === tab.id);
                      if (idx > 0) setActiveTab(tabs[idx - 1].id);
                    }
                  }}
                  className={`group flex flex-col text-left p-4 rounded-xl border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  } ${
                    isActive
                      ? "border-[#18181B] dark:border-[#3F3F46] bg-white dark:bg-[#121215] shadow-md shadow-black/5"
                      : "border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#09090B] hover:bg-white dark:hover:bg-[#121215] hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5 font-medium text-sm text-[#18181B] dark:text-[#F4F4F5]">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${
                          isActive
                            ? "bg-[#18181B] dark:bg-[#F4F4F5] text-white dark:text-[#18181B]"
                            : "bg-[#F4F4F5] dark:bg-[#1B1B20] text-[#52525B] dark:text-[#A1A1AA] group-hover:text-[#18181B] dark:group-hover:text-[#F4F4F5]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold">{tab.label}</span>
                    </div>

                    <span className="text-[11px] font-mono font-medium text-[#71717A] dark:text-[#A1A1AA]">
                      {tab.badge}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                    {tab.desc}
                  </p>
                </button>
              );
            })}

            <button
              onClick={scrollToDemo}
              className="mt-3 group flex items-center justify-center gap-1.5 rounded-lg border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] py-2.5 text-xs font-medium text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200 shadow-2xs"
            >
              <span>Explore Full Navigable Workspace ↑</span>
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          {/* Right Column: High-Fidelity Interactive Demonstration Canvas */}
          <div
            key={activeTab}
            className="lg:col-span-8 rounded-2xl border border-[#27272A] bg-[#09090B] p-5 sm:p-7 shadow-xl min-h-[460px] flex flex-col justify-between text-[#F4F4F5] transition-all duration-500 animate-in fade-in-50"
          >
            {/* Tab 1: Connected Workspace Demonstration */}
            {activeTab === "workspace" && (
              <div className="flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs text-[#A1A1AA]">
                    <span className="font-mono text-blue-400">
                      Pages / Core Engineering / Specification
                    </span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Auto-saved OCC v14
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl sm:text-2xl font-semibold text-white">
                    {t.landing.showcase.previewWorkspaceTitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#71717A]">
                    {t.landing.showcase.previewWorkspaceBody}
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-lg border border-[#1E1E22] bg-[#121215] p-3 text-xs">
                      <span className="font-mono text-[10px] text-amber-400 uppercase">
                        ADR-014 Reference
                      </span>
                      <p className="mt-0.5 font-medium text-white">
                        Standardized 3-Day Free Trial & Upfront Card Validation
                      </p>
                      <p className="mt-1 text-[11px] text-[#A1A1AA]">
                        All tenant requests enforce{" "}
                        <code className="text-white font-mono">verifyAccessOrRedirect()</code> to
                        guarantee zero unauthorized dashboard exposure.
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#1E1E22] bg-[#121215] p-3 text-xs">
                      <span className="font-mono text-[10px] text-purple-400 uppercase">
                        GitHub Pull Request #42
                      </span>
                      <p className="mt-0.5 font-medium text-white">
                        feat(billing): 3-day trial webhook reconciler and idempotency lock
                      </p>
                      <p className="mt-1 text-[11px] text-[#A1A1AA]">
                        Merged by engineering lead. 100% test coverage verified in CI.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1E1E22] flex items-center justify-between text-xs text-[#71717A]">
                  <span>Monotonic Optimistic Concurrency Control</span>
                  <span className="text-white font-mono">Zero Overwrite Conflicts</span>
                </div>
              </div>
            )}

            {/* Tab 2: Company Graph Demonstration */}
            {activeTab === "graph" && (
              <div className="flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs text-[#A1A1AA]">
                    <span className="font-mono text-indigo-400">
                      Company Graph / Topological Visualizer
                    </span>
                    <span className="font-mono text-emerald-400">BFS O(V + E) Traversal Active</span>
                  </div>

                  <h3 className="mt-4 text-xl sm:text-2xl font-semibold text-white">
                    {t.landing.showcase.previewGraphTitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#71717A]">
                    {t.landing.showcase.previewGraphBody}
                  </p>

                  {/* Visual SVG Mini-Graph Preview */}
                  <div className="mt-6 relative h-48 w-full rounded-xl border border-[#1E1E22] bg-[#0C0C0E] flex items-center justify-center overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 500 200">
                      <line x1="80" y1="100" x2="220" y2="50" stroke="#27272A" strokeWidth="2" />
                      <line x1="80" y1="100" x2="220" y2="150" stroke="#27272A" strokeWidth="2" />
                      <line x1="220" y1="50" x2="380" y2="70" stroke="#6366F1" strokeWidth="2" strokeDasharray="4 2" />
                      <line x1="220" y1="150" x2="380" y2="130" stroke="#27272A" strokeWidth="2" />
                      <line x1="380" y1="70" x2="450" y2="100" stroke="#6366F1" strokeWidth="2" />

                      <circle cx="80" cy="100" r="16" fill="#18181B" stroke="#3B82F6" strokeWidth="2" />
                      <text x="80" y="104" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">PAGE</text>

                      <circle cx="220" cy="50" r="18" fill="#18181B" stroke="#F59E0B" strokeWidth="2" />
                      <text x="220" y="54" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">ADR</text>

                      <circle cx="220" cy="150" r="16" fill="#18181B" stroke="#10B981" strokeWidth="2" />
                      <text x="220" y="154" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">MEET</text>

                      <circle cx="380" cy="70" r="20" fill="#18181B" stroke="#6366F1" strokeWidth="2.5" />
                      <text x="380" y="74" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="monospace">GRAPH</text>

                      <circle cx="380" cy="130" r="16" fill="#18181B" stroke="#A855F7" strokeWidth="2" />
                      <text x="380" y="134" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">REPO</text>

                      <circle cx="450" cy="100" r="14" fill="#18181B" stroke="#EC4899" strokeWidth="2" />
                      <text x="450" y="104" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">USER</text>
                    </svg>

                    <div className="absolute bottom-2 left-3 text-[10px] font-mono text-[#71717A]">
                      Node Dependencies: 6 Entities • 5 Relations Evaluated
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1E1E22] flex items-center justify-between text-xs text-[#71717A]">
                  <span>Cycle-safe shortest path calculations</span>
                  <span className="text-indigo-400 font-mono">100% Deterministic</span>
                </div>
              </div>
            )}

            {/* Tab 3: System Telemetry & Integrations */}
            {activeTab === "integrations" && (
              <div className="flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs text-[#A1A1AA]">
                    <span className="font-mono text-purple-400">
                      Telemetry / Stripe + GitHub Stream
                    </span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Webhooks Verified
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl sm:text-2xl font-semibold text-white">
                    {t.landing.showcase.previewIntegrationsTitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#71717A]">
                    {t.landing.showcase.previewIntegrationsBody}
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#A1A1AA]">Monthly Recurring Revenue</span>
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-medium">
                          <TrendingUp className="h-3 w-3" /> +14.2% MoM
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white font-mono">
                        €24,850
                      </div>
                      <span className="text-[10px] text-[#71717A]">Verified through Stripe Connect</span>
                    </div>

                    <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#A1A1AA]">GitHub Code Velocity</span>
                        <span className="text-[11px] font-mono text-blue-400 font-medium">
                          32 PRs Merged
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white font-mono">
                        98.4%
                      </div>
                      <span className="text-[10px] text-[#71717A]">All commits tied to accepted ADRs</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1E1E22] flex items-center justify-between text-xs text-[#71717A]">
                  <span>Multi-Tenant In-Memory Coalescing Cache</span>
                  <span className="text-emerald-400 font-mono">Real-Time Refresh</span>
                </div>
              </div>
            )}

            {/* Tab 4: Contextual Business AI */}
            {activeTab === "ai" && (
              <div className="flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs text-[#A1A1AA]">
                    <span className="font-mono text-indigo-400">
                      Context Intelligence / Grounded Q&A
                    </span>
                    <span className="font-mono text-amber-400">Grounded in 4 Workspace Docs</span>
                  </div>

                  <h3 className="mt-4 text-xl sm:text-2xl font-semibold text-white">
                    {t.landing.showcase.previewAITitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#71717A]">
                    {t.landing.showcase.previewAIBody}
                  </p>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-lg border border-[#1E1E22] bg-[#121215] p-3 text-xs text-white">
                      <span className="text-[10px] font-mono text-[#71717A] uppercase block">
                        Executive Query
                      </span>
                      <p className="mt-1 font-medium text-[#FAF9F5]">
                        &quot;Why did we migrate our pricing model to a 3-day trial in Q3, and what are the open tasks?&quot;
                      </p>
                    </div>

                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-100">
                      <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[10px] uppercase font-semibold">
                        <Sparkles className="h-3 w-3" />
                        <span>Grounded Answer • ADR-014 & Monetization Spec</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-indigo-100/90 text-xs">
                        The decision was accepted on August 14th to standardize a 3-day free trial with upfront payment
                        method validation, eliminating fraudulent bots and increasing subscriber qualification.
                        Two tasks remain open: customer portal cancellation flow and Stripe tax nexus audit.
                      </p>

                      <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-indigo-500/20 text-[10px] text-indigo-300">
                        <span>Citations:</span>
                        <span className="underline cursor-pointer">ADR-014</span>
                        <span>•</span>
                        <span className="underline cursor-pointer">Monetization_Spec.md</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1E1E22] flex items-center justify-between text-xs text-[#71717A]">
                  <span>Zero Hallucinations • Strict Context Grounding</span>
                  <span className="text-white font-mono">100% Traceable</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Product Page Jump Button */}
        <div className="mt-12 text-center">
          <Link
            href="/product"
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-5 py-2.5 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] transition-colors shadow-xs"
          >
            <span>Explore Dedicated Product Workstation & Architecture</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
