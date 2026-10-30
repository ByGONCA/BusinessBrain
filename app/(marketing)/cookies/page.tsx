import * as React from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "Cookie Policy | BusinessBrain",
  description: "Information regarding cookie classification, session storage, and ePrivacy compliance on BusinessBrain.",
};

export default function CookiePolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] dark:bg-[#09090B] text-[#18181B] dark:text-[#F4F4F5] antialiased selection:bg-blue-600/20 font-sans transition-colors">
      <LandingHeader />

      <main className="flex-1 px-6 lg:px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <span className="text-xs font-mono font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Cookie & Tracking Transparency
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Cookie Policy
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Compliance with Directive 2002/58/EC (ePrivacy Directive) & GDPR
          </p>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Pre-Launch Regulatory Draft & Transparency Notice</p>
          <p>
            This cookie and tracking disclosure outlines the operational cookies used on BusinessBrain. Formal corporate legal entity details and representative appointments are subject to final executive confirmation prior to public commercial billing.
          </p>
        </div>
        <div className="prose prose-zinc dark:prose-invert max-w-none pt-8 space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device by websites you visit. They are widely used to ensure websites function securely, recall your session preferences, and deliver optimized performance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">2. Cookie Classification on BusinessBrain</h2>
            <p>
              Under the ePrivacy Directive and GDPR, cookies are categorized into strictly necessary and optional categories:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-zinc-200 dark:border-zinc-800">
                <thead className="bg-zinc-100 dark:bg-zinc-800 font-semibold">
                  <tr>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Cookie Name</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Category</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Duration</th>
                    <th className="p-2 border-b border-zinc-200 dark:border-zinc-800">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr>
                    <td className="p-2 font-mono">sb-*-auth-token</td>
                    <td className="p-2 font-medium text-emerald-600 dark:text-emerald-400">Strictly Necessary</td>
                    <td className="p-2">Session / Persistent</td>
                    <td className="p-2">Maintains authenticated user session and CSRF protection.</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">cb_active_org_id</td>
                    <td className="p-2 font-medium text-emerald-600 dark:text-emerald-400">Strictly Necessary</td>
                    <td className="p-2">1 Year</td>
                    <td className="p-2">Stores current active workspace scope to maintain tenant isolation.</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">cb_locale</td>
                    <td className="p-2 font-medium text-blue-600 dark:text-blue-400">Functional</td>
                    <td className="p-2">1 Year</td>
                    <td className="p-2">Stores preferred UI language (EN, PT, ES, FR).</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">cb_theme</td>
                    <td className="p-2 font-medium text-blue-600 dark:text-blue-400">Functional</td>
                    <td className="p-2">1 Year</td>
                    <td className="p-2">Stores user theme preference (light, dark, system).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">3. Third-Party Tracking & Advertising</h2>
            <p>
              BusinessBrain does <strong>not</strong> employ cross-site tracking cookies, behavioral advertising beacons, or third-party data broker scripts. We prioritize zero tracking pixels and strict tenant confidentiality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">4. Managing Your Cookie Preferences</h2>
            <p>
              Because strictly necessary cookies are indispensable to authenticate your identity and enforce tenant security boundaries, they cannot be disabled without breaking service availability. You may configure your browser to block or alert you about these cookies, but critical features will fail to operate.
            </p>
          </section>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            Learn more about how we safeguard your data in our{" "}
            <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-white">
              Privacy Policy
            </Link>{" "}
            or view our{" "}
            <Link href="/terms" className="underline hover:text-zinc-900 dark:hover:text-white">
              Terms of Service
            </Link>.
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
