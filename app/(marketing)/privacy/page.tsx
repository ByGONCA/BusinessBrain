import * as React from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "Privacy Policy | BusinessBrain",
  description: "Comprehensive privacy notice, data processing standards, and GDPR compliance policies of BusinessBrain.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 px-6 lg:px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <span className="text-xs font-mono font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Privacy & Data Protection
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Effective Date: October 2026 | Version 1.2 | GDPR (EU 2016/679) & Global Data Privacy
          </p>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Pre-Launch Regulatory Draft & Subprocessor Notice</p>
          <p>
            This privacy notice details our technical architecture, data processing roles, and subprocessor framework. Production infrastructure regional hosting verification and formal data transfer agreements are subject to final operational validation prior to commercial launch.
          </p>
        </div>
        <div className="prose prose-zinc dark:prose-invert max-w-none pt-8 space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">1. Data Controller & Overview</h2>
            <p>
              This Privacy Policy explains how BusinessBrain (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, processes, stores, and protects personal data when you interact with our website, application platform, and services.
            </p>
            <p>
              For personal data processed when managing user accounts and billing relationships, BusinessBrain acts as the <strong>Data Controller</strong>. For Customer Data stored within individual organization workspaces (such as internal company documents, meeting summaries, and team task graphs), your organization acts as the <strong>Data Controller</strong>, and BusinessBrain acts as the <strong>Data Processor</strong> under a Data Processing Agreement (DPA).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">2. Categories of Data Collected</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account & Identity Data:</strong> Full name, business email address, avatar URL, authentication provider metadata (Supabase Auth / GitHub OAuth).</li>
              <li><strong>Billing & Invoicing Data:</strong> Payment transaction identifiers, billing addresses, country, and VAT/tax ID. Credit card numbers are handled directly by certified Level 1 PCI-DSS payment gateways (Stripe) and are never stored on our servers.</li>
              <li><strong>Organizational & Workspace Data:</strong> Workspace configuration, role memberships, uploaded documentation, integration metadata, and team activity logs.</li>
              <li><strong>Technical & Telemetry Data:</strong> IP addresses, browser user-agent, session tokens, audit logs, and diagnostic performance metrics.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">3. Legal Bases for Processing (GDPR Art. 6)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract Performance (Art. 6(1)(b)):</strong> Providing core workspace functionality, authentication, team collaboration, and subscription management.</li>
              <li><strong>Legal Obligation (Art. 6(1)(c)):</strong> Preserving statutory accounting records, invoices, and transaction audit trails pursuant to Portuguese and European fiscal directives (CIVA / Art. 123.º CIRC) and international tax regulations.</li>
              <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> Platform security, preventing brute-force attacks, multi-tenant isolation enforcement, and infrastructure abuse detection.</li>
              <li><strong>Explicit Consent (Art. 6(1)(a)):</strong> Optional marketing communications and analytical cookies, revocable at any time. Marketing consent is never pre-selected.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">4. Subprocessors & International Transfers</h2>
            <p>
              We partner with trusted enterprise infrastructure providers to host and secure the Service:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-zinc-200 dark:border-zinc-800">
                <thead className="bg-zinc-100 dark:bg-zinc-800 font-semibold">
                  <tr>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Subprocessor</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Purpose</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Location</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Transfer Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr>
                    <td className="p-2 font-medium">Supabase Inc.</td>
                    <td className="p-2">Database & Auth Hosting</td>
                    <td className="p-2">EU / US</td>
                    <td className="p-2">EU-US DPF / Standard Contractual Clauses (SCC)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Stripe Payments Europe Ltd.</td>
                    <td className="p-2">Billing & Invoicing</td>
                    <td className="p-2">Ireland / Global</td>
                    <td className="p-2">Adequacy Decision / SCC</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Vercel Inc.</td>
                    <td className="p-2">Edge Hosting & Compute</td>
                    <td className="p-2">Global Edge / US</td>
                    <td className="p-2">EU-US DPF / SCC</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Resend Inc.</td>
                    <td className="p-2">Transactional Email Delivery</td>
                    <td className="p-2">US</td>
                    <td className="p-2">Standard Contractual Clauses (SCC)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">5. Data Subject Rights (GDPR & Global Privacy)</h2>
            <p>
              Under the General Data Protection Regulation and global privacy frameworks (including CCPA/CPRA, LGPD), you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access & Portability (Art. 15, 20):</strong> Export your personal data and full workspace data at any time via Workspace Settings in JSON format.</li>
              <li><strong>Rectification (Art. 16):</strong> Correct inaccurate personal profile information directly in your profile settings.</li>
              <li><strong>Erasure / Right to be Forgotten (Art. 17):</strong> Request deletion of your personal account. Personal identity attributes will be expunged, subject to statutory statutory retention mandates for fiscal/audit records.</li>
              <li><strong>Restriction & Objection (Art. 18, 21):</strong> Object to processing based on legitimate interests or revoke marketing consent with 1 click.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">6. Security Measures</h2>
            <p>
              BusinessBrain maintains defense-in-depth technical and organizational measures (TOMs), including PostgreSQL Row-Level Security, TLS 1.3 in-transit encryption, AES-256 at-rest encryption for sensitive secrets, rate limiting, and automated security scanning.
            </p>
          </section>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            For privacy inquiries or to exercise your statutory rights, contact our Data Protection Officer at dpo@businessbrain.io or privacy@businessbrain.io.
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
