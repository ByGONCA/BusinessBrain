import { Metadata } from "next";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingProblem } from "@/components/landing/landing-problem";
import { LandingGraphSection } from "@/components/landing/landing-graph-section";
import { LandingIntegrations } from "@/components/landing/landing-integrations";
import { LandingAISection } from "@/components/landing/landing-ai-section";
import { LandingConversionBridge } from "@/components/landing/landing-conversion-bridge";
import { LandingFAQ } from "@/components/landing/landing-faq";
import { LandingFinalCTA } from "@/components/landing/landing-final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "BusinessBrain — Where your company remembers everything",
  description:
    "BusinessBrain brings company pages, strategic decisions, connected graphs, and system context into one coherent operating system for modern teams.",
};

export default function MarketingLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] selection:bg-blue-600/20 antialiased font-sans scroll-smooth transition-colors">
      {/* Top Floating Compact Header */}
      <LandingHeader />

      {/* Main Marketing Narrative */}
      <main className="flex-1 flex flex-col">
        {/* Section 1: Hero */}
        <LandingHero />

        {/* Section 2: Interactive Product Showcase */}
        <LandingShowcase />

        {/* Section 3: The Fragmented Information Problem */}
        <LandingProblem />

        {/* Section 4: Connected Knowledge and Company Graph */}
        <LandingGraphSection />

        {/* Section 5: Ecosystem Integrations */}
        <LandingIntegrations />

        {/* Section 6: Contextual Business AI */}
        <LandingAISection />

        {/* Section 7: Focused Value & Conversion Opportunity */}
        <LandingConversionBridge />

        {/* Section 8: Buyer FAQ */}
        <LandingFAQ />

        {/* Section 9: Final Conversion Callout */}
        <LandingFinalCTA />
      </main>

      {/* Section 10: Editorial Footer */}
      <LandingFooter />
    </div>
  );
}
