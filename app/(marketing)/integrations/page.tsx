import { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { MARKETING_INTEGRATIONS } from "@/lib/marketing/config";
import { Blocks, ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Ecosystem Integrations — BusinessBrain",
  description:
    "Connect GitHub, Stripe, Google Drive, Google Calendar, and Slack to your central company memory with live telemetry and unified search.",
};

export default function IntegrationsPage() {
  const engineeringIntegrations = MARKETING_INTEGRATIONS.filter(
    (i) => i.category === "engineering"
  );
  const commerceIntegrations = MARKETING_INTEGRATIONS.filter(
    (i) => i.category === "commerce"
  );
  const communicationIntegrations = MARKETING_INTEGRATIONS.filter(
    (i) => i.category === "communication"
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 flex flex-col">
        {/* Page Hero */}
        <section className="pt-12 pb-8 sm:pt-20 sm:pb-12 text-center px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE] dark:bg-[#121215] px-3 py-1 text-xs font-mono font-medium text-[#71717A] dark:text-[#A1A1AA]">
              <Blocks className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>NATIVE INTEGRATION ECOSYSTEM</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5]">
              Connect your existing tools to your company memory.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
              BusinessBrain doesn&apos;t replace your specialized tools — it bridges them. Pull request metadata, revenue telemetry, meeting agendas, and shared drives automatically link to your institutional documents.
            </p>
          </div>
        </section>

        {/* Categorized Integration Directory */}
        <section className="pb-20 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-16">
            {/* Engineering Stack */}
            <div>
              <div className="border-b border-[#E5E5E0] dark:border-[#1E1E22] pb-4 mb-8">
                <h2 className="text-xl font-bold text-[#18181B] dark:text-[#F4F4F5]">
                  Engineering & Code Intelligence
                </h2>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1">
                  Connect code repositories, pull requests, and commit histories to architectural decisions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {engineeringIntegrations.map((item) => (
                  <IntegrationCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Commerce & Finance */}
            <div>
              <div className="border-b border-[#E5E5E0] dark:border-[#1E1E22] pb-4 mb-8">
                <h2 className="text-xl font-bold text-[#18181B] dark:text-[#F4F4F5]">
                  Commerce & Financial Telemetry
                </h2>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1">
                  Live MRR, net settled volume, and subscription dunning telemetry linked to corporate milestones.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {commerceIntegrations.map((item) => (
                  <IntegrationCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Communication & Workspace */}
            <div>
              <div className="border-b border-[#E5E5E0] dark:border-[#1E1E22] pb-4 mb-8">
                <h2 className="text-xl font-bold text-[#18181B] dark:text-[#F4F4F5]">
                  Communication & Workspace Knowledge
                </h2>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1">
                  Capture fleeting conversations and turn them into permanent company knowledge assets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communicationIntegrations.map((item) => (
                  <IntegrationCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] text-center px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F4F5]">
              Connect your stack in minutes.
            </h2>
            <p className="mt-2 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Start your 3-day free trial and connect GitHub, Stripe, and Google with one click.
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
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

function IntegrationCard({ item }: { item: (typeof MARKETING_INTEGRATIONS)[0] }) {
  const isActive = item.status === "active";

  return (
    <div className="rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] p-6 shadow-xs hover:border-[#D4D4D8] dark:hover:border-[#2E2E35] transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#1B1B20] p-2.5">
            <img
              src={item.logoUrl}
              alt={`${item.name} logo`}
              className="h-6 w-6 object-contain"
              loading="lazy"
            />
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              isActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {isActive ? "Active Native" : "Roadmap"}
          </span>
        </div>

        <h3 className="mt-4 text-base font-semibold text-[#18181B] dark:text-[#F4F4F5]">
          {item.name}
        </h3>
        <p className="mt-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
          {item.description}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-[#E5E5E0] dark:border-[#1E1E22] flex items-center justify-between text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
        <span className="capitalize">{item.category}</span>
        <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
          {isActive ? "OAuth 2.0" : "Planned Q4"}
        </span>
      </div>
    </div>
  );
}
