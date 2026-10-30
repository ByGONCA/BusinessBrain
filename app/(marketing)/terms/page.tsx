import * as React from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "Terms of Service | BusinessBrain",
  description: "Terms and conditions governing the use of BusinessBrain enterprise workspace platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 px-6 lg:px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <span className="text-xs font-mono font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Legal & Governance
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Last Updated: October 2026 | Version 1.2
          </p>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Pre-Launch Regulatory Draft & Transparency Notice</p>
          <p>
            This document outlines the standard operational and multi-tenant terms for BusinessBrain. Formal corporate legal entity registration numbers, registered fiscal addresses, and statutory representative appointments are subject to final executive confirmation prior to public commercial billing.
          </p>
        </div>
        <div className="prose prose-zinc dark:prose-invert max-w-none pt-8 space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">1. Contractual Relationship & Scope</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern the access and use of the BusinessBrain software-as-a-service platform, APIs, tools, and documentation (collectively, the &quot;Service&quot;) provided by BusinessBrain (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
            </p>
            <p>
              By creating an account, registering an organization workspace, or accessing the Service, you represent that you have the legal capacity to enter into a binding agreement and agree to be bound by these Terms on behalf of yourself or the entity you represent.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">2. Multi-Tenant Workspaces & Account Security</h2>
            <p>
              BusinessBrain operates on a multi-tenant workspace architecture. Each organization workspace is logically isolated. You are responsible for maintaining the confidentiality of access credentials and all activities occurring within your tenant environment.
            </p>
            <p>
              Workspace Owners and Administrators retain administrative control over organization members, role assignments, billing settings, and data retention policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">3. Subscriptions, Trials & Billing Terms</h2>
            <p>
              BusinessBrain offers tiered subscription plans (Starter, Pro, Enterprise) and an upfront 3-day evaluation trial. A valid payment method is required to activate trial access to verify legitimate corporate identity and maintain uninterrupted continuity.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Trial Period:</strong> You will not be charged during the trial period. You may cancel your subscription anytime prior to trial expiration with one click in Workspace Settings.</li>
              <li><strong>Billing Cycle:</strong> Subscriptions renew automatically at the selected cadence (monthly or annual) unless cancelled before the renewal date.</li>
              <li><strong>Taxes & Invoicing:</strong> Fees are exclusive of value-added tax (VAT), sales tax, or GST where applicable. Compliance with local fiscal and statutory invoicing rules (including EU VAT directives and Portuguese CIVA / Art. 123.º CIRC) is maintained via compliant payment processors.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">4. Customer Data & Proprietary Boundaries</h2>
            <p>
              You retain all ownership, intellectual property rights, and title to all documents, tasks, notes, and records submitted by your workspace members (&quot;Customer Data&quot;).
            </p>
            <p>
              BusinessBrain does not sell Customer Data or use proprietary corporate content to train public foundation machine learning models without express contractual consent.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">5. Acceptable Use Policy</h2>
            <p>
              You agree not to misuse the Service, reverse engineer internal APIs, circumvent multi-tenant access controls, upload malicious payloads, or use the Service in violation of international trade sanctions (including OFAC, EU, and UK sanctions lists).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">6. Termination & Account Erasure</h2>
            <p>
              You may terminate your account at any time. In accordance with GDPR Article 17, personal profile data will be expunged upon verified deletion request. Statutory accounting and security audit logs are retained under legal requirement for mandatory retention periods.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">7. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of Portugal and the European Union, without prejudice to mandatory consumer protection laws in your jurisdiction.
            </p>
          </section>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            Questions regarding these Terms? Contact us at legal@businessbrain.io or consult our{" "}
            <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-white">
              Privacy Policy
            </Link>.
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
