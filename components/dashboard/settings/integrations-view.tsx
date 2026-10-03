"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Github,
  ShoppingBag,
  Layers,
  ShieldAlert,
  CheckSquare,
  CreditCard,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Unlink,
  Clock,
  X,
  Code2,
} from "lucide-react";
import { OrganizationIntegration } from "@/lib/integrations/types";
import { INTEGRATION_CATALOG, IntegrationDefinition } from "@/lib/integrations/catalog";
import { disconnectIntegrationAction } from "@/lib/integrations/actions";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface IntegrationsViewProps {
  integrations: OrganizationIntegration[];
  isGoogleConfigured: boolean;
  statusParam?: string;
  errorParam?: string;
  initialOpenId?: string;
}

function renderProviderIcon(id: string) {
  switch (id) {
    case "gmail":
      return <Mail className="h-5 w-5 text-red-500" />;
    case "google_calendar":
      return <Calendar className="h-5 w-5 text-blue-500" />;
    case "outlook":
      return <Mail className="h-5 w-5 text-sky-500" />;
    case "outlook_calendar":
      return <Calendar className="h-5 w-5 text-sky-500" />;
    case "github":
      return <Github className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />;
    case "linear":
      return <CheckSquare className="h-5 w-5 text-indigo-500" />;
    case "vercel":
      return <Layers className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />;
    case "sentry":
      return <ShieldAlert className="h-5 w-5 text-amber-500" />;
    case "stripe":
      return <CreditCard className="h-5 w-5 text-emerald-500" />;
    case "shopify":
      return <ShoppingBag className="h-5 w-5 text-teal-500" />;
    default:
      return <Sparkles className="h-5 w-5 text-blue-500" />;
  }
}

export function IntegrationsView({
  integrations,
  isGoogleConfigured,
  statusParam,
  errorParam,
  initialOpenId,
}: IntegrationsViewProps) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [infoModalItem, setInfoModalItem] = React.useState<IntegrationDefinition | null>(null);
  const [isDisconnecting, startDisconnectTransition] = React.useTransition();

  // Open info modal if requested via URL searchParams
  React.useEffect(() => {
    if (initialOpenId) {
      const match = INTEGRATION_CATALOG.find((i) => i.id === initialOpenId);
      if (match) setInfoModalItem(match);
    }
  }, [initialOpenId]);

  // Helper to find active connection for a catalog item
  const findActiveConnection = (itemId: string) => {
    return integrations.find((i) => {
      if (i.status !== "connected") return false;
      if (i.provider === itemId) return true;
      // Backward compatibility for existing "google" connection
      if (i.provider === "google") {
        if (itemId === "gmail" && i.scopes?.some((s) => s.includes("gmail"))) return true;
        if (itemId === "google_calendar" && i.scopes?.some((s) => s.includes("calendar"))) return true;
      }
      return false;
    });
  };

  const filteredCatalog = INTEGRATION_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badge.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t.settings.integrationsTab.title}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {t.settings.integrationsTab.description}
          </p>
        </div>
      </div>

      {/* Status & Error Alerts */}
      {statusParam === "connected" && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Integration was successfully connected to your workspace.</span>
        </div>
      )}

      {errorParam && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>
            Connection notice: {errorParam === "config_error" ? "OAuth credentials must be set in your .env file." : errorParam}
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: "all", label: t.settings.integrationsTab.all },
            { id: "communication", label: t.settings.integrationsTab.communication },
            { id: "calendar", label: t.settings.integrationsTab.calendar },
            { id: "engineering", label: t.settings.integrationsTab.engineering },
            { id: "operations", label: t.settings.integrationsTab.operations },
            { id: "commerce", label: t.settings.integrationsTab.commerce },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                selectedCategory === cat.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.settings.integrationsTab.searchPlaceholder}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Grid of 10 Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCatalog.map((item) => {
          const connection = findActiveConnection(item.id);
          const isConnected = !!connection;

          const providerTrans =
            (t.settings.integrationsTab.providers as any)?.[
              item.id === "google_calendar"
                ? "googleCalendar"
                : item.id === "outlook_calendar"
                ? "outlookCalendar"
                : item.id
            ] || { name: item.name, description: "" };

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4.5 transition-all shadow-2xs",
                isConnected
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              <div>
                {/* Top Row: Icon + Name + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
                      {renderProviderIcon(item.id)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {providerTrans.name}
                        </h3>
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                          {item.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{t.settings.integrationsTab.connected}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {t.settings.integrationsTab.notConnected}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {providerTrans.description}
                </p>

                {/* Connected Details preview */}
                {isConnected && connection && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-500">Account:</span>
                      <span className="font-mono font-medium truncate max-w-[180px]">
                        {connection.accountEmail || connection.providerAccountId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-500">Encrypted:</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3 w-3" /> AES-256
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setInfoModalItem(item)}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Code2 className="h-3 w-3" />
                  <span>Setup Guide</span>
                </button>

                <div>
                  {isConnected && connection ? (
                    <button
                      type="button"
                      disabled={isDisconnecting}
                      onClick={() => {
                        startDisconnectTransition(async () => {
                          await disconnectIntegrationAction(connection.id);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Unlink className="h-3 w-3" />
                      <span>{t.settings.integrationsTab.disconnect}</span>
                    </button>
                  ) : item.id === "gmail" ? (
                    <a
                      href="/api/integrations/google/connect?service=gmail"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{t.settings.integrationsTab.connect}</span>
                    </a>
                  ) : item.id === "google_calendar" ? (
                    <a
                      href="/api/integrations/google/connect?service=calendar"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{t.settings.integrationsTab.connect}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInfoModalItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
                    >
                      <span>{t.settings.integrationsTab.configure}</span>
                      <ExternalLink className="h-3 w-3 text-zinc-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Setup Guide / Credentials Modal */}
      {infoModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setInfoModalItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  {renderProviderIcon(infoModalItem.id)}
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">{infoModalItem.name}</h3>
                  <span className="text-[11px] text-zinc-500">{infoModalItem.badge}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalItem(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Environment Variables</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Configure these in your <code className="font-mono text-blue-600 dark:text-blue-400">.env</code> to activate this integration:
                </p>
                <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 p-2.5 font-mono text-[11px] space-y-1 text-zinc-800 dark:text-zinc-200">
                  {infoModalItem.envVars.map((v) => (
                    <div key={v} className="flex items-center justify-between">
                      <span>{v}</span>
                      <span className="text-[10px] text-zinc-400 font-sans">Required</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-blue-700 dark:text-blue-300 space-y-1 text-[11px]">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Configured via .env.example</span>
                </p>
                <p className="text-blue-600/90 dark:text-blue-300/90">
                  Check your project&apos;s <code className="font-mono">.env.example</code> for copy-paste instructions and redirect callback URLs.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              {infoModalItem.docsUrl && (
                <a
                  href={infoModalItem.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <span>Provider Documentation</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setInfoModalItem(null)}
                className="ml-auto rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {t.common.gotIt}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
