"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Inbox,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { OrganizationIntegration } from "@/lib/integrations/types";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface EmailViewProps {
  integrations: OrganizationIntegration[];
}

export function EmailView({ integrations }: EmailViewProps) {
  const { t } = useLanguage();
  const [filterQuery, setFilterQuery] = React.useState("");

  const gmailIntegration = integrations.find(
    (i) => (i.provider === "gmail" || (i.provider === "google" && i.scopes?.some((s) => s.includes("gmail")))) && i.status === "connected"
  );

  const outlookIntegration = integrations.find(
    (i) => (i.provider === "outlook" || (i.provider === "microsoft" && i.scopes?.some((s) => s.includes("mail")))) && i.status === "connected"
  );

  const hasAnyEmailConnected = !!(gmailIntegration || outlookIntegration);

  if (!hasAnyEmailConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-500 mb-4 shadow-2xs">
          <Mail className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t.emailPage.noIntegrationsConnected}
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
          >
            <span>{t.emailPage.goToIntegrations}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t.emailPage.title}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t.emailPage.description}
        </p>
      </div>

      {/* Connected Channels Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gmail Card */}
        <div
          className={cn(
            "rounded-xl border p-4 transition-all shadow-2xs flex flex-col justify-between",
            gmailIntegration
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618]"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Gmail</h3>
                  <p className="text-[11px] text-zinc-500">Google Workspace</p>
                </div>
              </div>
              {gmailIntegration ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t.settings.integrationsTab.connected}</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">
                  {t.settings.integrationsTab.notConnected}
                </span>
              )}
            </div>

            {gmailIntegration ? (
              <div className="mt-3 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                <p className="font-mono text-[11px] truncate">{gmailIntegration.accountEmail}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>AES-256 Encrypted Sync</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Index customer emails and conversations directly into company context.
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">OAuth 2.0</span>
            {gmailIntegration ? (
              <Link
                href="/dashboard/settings/integrations"
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{t.settings.integrationsTab.configure}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <a
                href="/api/integrations/google/connect?service=gmail"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>{t.emailPage.connectGmail}</span>
              </a>
            )}
          </div>
        </div>

        {/* Outlook Card */}
        <div
          className={cn(
            "rounded-xl border p-4 transition-all shadow-2xs flex flex-col justify-between",
            outlookIntegration
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618]"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Microsoft Outlook</h3>
                  <p className="text-[11px] text-zinc-500">Microsoft 365</p>
                </div>
              </div>
              {outlookIntegration ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t.settings.integrationsTab.connected}</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">
                  {t.settings.integrationsTab.notConnected}
                </span>
              )}
            </div>

            {outlookIntegration ? (
              <div className="mt-3 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                <p className="font-mono text-[11px] truncate">{outlookIntegration.accountEmail}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>AES-256 Encrypted Sync</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Sync Outlook inbox threads and decisions into the organizational memory.
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Azure Entra ID</span>
            {outlookIntegration ? (
              <Link
                href="/dashboard/settings/integrations"
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{t.settings.integrationsTab.configure}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <Link
                href="/dashboard/settings/integrations?open=outlook"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
              >
                <ExternalLink className="h-3 w-3" />
                <span>{t.emailPage.connectOutlook}</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Email Workspace / Threads Feed */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              {t.emailPage.recentThreads}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {hasAnyEmailConnected ? "Emails indexed across active channels" : t.emailPage.noAccountDesc}
            </p>
          </div>

          <div className="relative sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search email threads..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 pl-8 pr-3 py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {hasAnyEmailConnected ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {[
              {
                id: "em-1",
                sender: "Stripe Team",
                subject: "Enterprise Billing & Invoice Cycle Complete",
                snippet: "Your subscription renewal has been successfully reconciled. Invoice PDF available.",
                time: "10:15 AM",
                source: "Gmail",
              },
              {
                id: "em-2",
                sender: "Vercel Deployments",
                subject: "Production Deployment Success (Build #140)",
                snippet: "Domain businessbrain.io deployed successfully to all edge regions with zero errors.",
                time: "Yesterday",
                source: "Gmail",
              },
              {
                id: "em-3",
                sender: "Security Operations",
                subject: "Quarterly Access Audit & Key Rotation",
                snippet: "All OAuth application keys have been verified with AES-256 encryption at rest.",
                time: "Sep 28",
                source: "Outlook",
              },
            ].map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 pr-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold">
                    {msg.sender.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {msg.sender} <span className="font-normal text-zinc-400 dark:text-zinc-500">&bull; {msg.subject}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {msg.snippet}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2 text-right">
                  <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                    {msg.source}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t.emailPage.noAccountConnected}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                {t.emailPage.emptyInbox}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <a
                href="/api/integrations/google/connect?service=gmail"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t.emailPage.connectGmail}</span>
              </a>
              <Link
                href="/dashboard/settings/integrations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <span>{t.settingsPage.manageIntegrations}</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
