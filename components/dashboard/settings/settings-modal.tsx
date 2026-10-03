"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Search,
  Sliders,
  Bell,
  Mail,
  Calendar,
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  Check,
  ExternalLink,
  Lock,
  ChevronDown,
  Github,
  ShoppingBag,
  Layers,
  ShieldAlert,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationWithRole, OrganizationMember } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { useSettings } from "./settings-context";
import { useTheme } from "@/components/theme/theme-provider";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useLanguage, SUPPORTED_LOCALES, Locale } from "@/lib/i18n";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { getOrganizationMembersAction } from "@/lib/organizations/actions";

interface SettingsModalProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      [key: string]: unknown;
    };
  };
  organizations: OrganizationWithRole[];
  activeOrg: OrganizationWithRole | null;
  entitlement: OrganizationEntitlement | null;
  members?: OrganizationMember[];
}

function renderProviderIcon(id: string) {
  switch (id) {
    case "gmail":
      return <Mail className="h-4 w-4 text-red-500" />;
    case "google_calendar":
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case "outlook":
      return <Mail className="h-4 w-4 text-sky-500" />;
    case "outlook_calendar":
      return <Calendar className="h-4 w-4 text-sky-500" />;
    case "github":
      return <Github className="h-4 w-4 text-zinc-800 dark:text-zinc-200" />;
    case "linear":
      return <CheckSquare className="h-4 w-4 text-indigo-500" />;
    case "vercel":
      return <Layers className="h-4 w-4 text-zinc-900 dark:text-white" />;
    case "sentry":
      return <ShieldAlert className="h-4 w-4 text-amber-500" />;
    case "stripe":
      return <CreditCard className="h-4 w-4 text-emerald-500" />;
    case "shopify":
      return <ShoppingBag className="h-4 w-4 text-teal-500" />;
    default:
      return <Sparkles className="h-4 w-4 text-blue-500" />;
  }
}

export function SettingsModal({
  user,
  activeOrg,
  entitlement,
  members = [],
}: SettingsModalProps) {
  const { isOpen, activeTab, closeSettings, setActiveTab } = useSettings();
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { modKey, modKeyName } = usePlatform();
  const { locale, setLocale, t, interpolate } = useLanguage();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [enterToSend, setEnterToSend] = React.useState(true);
  const [timeFormat, setTimeFormat] = React.useState("24h");
  const [integrationCategory, setIntegrationCategory] = React.useState<string>("all");
  const [integrationSearch, setIntegrationSearch] = React.useState<string>("");

  // User details
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";
  const userInitial = userName.charAt(0).toUpperCase();

  const [memberList, setMemberList] = React.useState<OrganizationMember[]>(members);
  const [loadingMembers, setLoadingMembers] = React.useState(false);

  React.useEffect(() => {
    if (members && members.length > 0) {
      setMemberList(members);
    }
  }, [members]);

  React.useEffect(() => {
    if (isOpen && activeTab === "people" && memberList.length <= 1) {
      setLoadingMembers(true);
      getOrganizationMembersAction(activeOrg?.id).then((res) => {
        setLoadingMembers(false);
        if (res.success && res.members && res.members.length > 0) {
          setMemberList(res.members);
        }
      });
    }
  }, [isOpen, activeTab, activeOrg?.id, memberList.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 dark:bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      onClick={closeSettings}
    >
      {/* Modal Dialog Window - SOLID OPAQUE BACKGROUND */}
      <div
        className="relative flex h-[620px] max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] text-zinc-900 dark:text-zinc-100 shadow-2xl transition-colors duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* LEFT SETTINGS SIDEBAR                                    */}
        {/* ========================================================= */}
        <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214] p-3 flex flex-col justify-between select-none">
          <div className="space-y-3 overflow-y-auto no-scrollbar">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.settings.searchPlaceholder}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] py-1.5 pl-8 pr-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Section: Account */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "profile"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  {userInitial}
                </div>
                <span className="truncate">{userName}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("preferences")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "preferences"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Sliders className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.preferences}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "notifications"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Bell className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.notifications}</span>
              </button>
            </div>

            {/* Section: Workspace */}
            <div className="space-y-0.5 pt-2">
              <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {t.settings.sections.workspace}
              </span>

              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "workspace"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.workspace}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("people")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "people"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Users className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.people}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("integrations")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "integrations"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <Mail className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.integrations}</span>
              </button>
            </div>

            {/* Section: Access & Billing */}
            <div className="space-y-0.5 pt-2">
              <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {t.settings.sections.accessAndBilling}
              </span>

              <button
                type="button"
                onClick={() => setActiveTab("billing")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  activeTab === "billing"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <CreditCard className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{t.settings.tabs.billing}</span>
              </button>
            </div>
          </div>

          {/* Bottom Hint */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            <span>{t.settings.escToClose} &bull; {modKey} ,</span>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT ACTIVE TAB CONTENT - SOLID OPAQUE                  */}
        {/* ========================================================= */}
        <main className="flex-1 overflow-y-auto p-7 no-scrollbar relative bg-white dark:bg-[#161618]">
          {/* Close button */}
          <button
            type="button"
            onClick={closeSettings}
            aria-label="Close settings"
            className="absolute top-5 right-5 p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* TAB: PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.preferences.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {t.settings.preferences.description}
                </p>
              </div>

              {/* Group: Appearance */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.settings.preferences.appearance}
                </span>

                {/* Theme Selector */}
                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.preferences.theme}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t.settings.preferences.themeDesc}
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as "system" | "dark" | "light")}
                      className="appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
                    >
                      <option value="system">{t.settings.preferences.themeSystem}</option>
                      <option value="dark">{t.settings.preferences.themeDark}</option>
                      <option value="light">{t.settings.preferences.themeLight}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>

                {/* High Contrast Selector */}
                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.preferences.highContrast}</p>
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {t.common.beta}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t.settings.preferences.highContrastDesc}
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={contrast}
                      onChange={(e) => setContrast(e.target.value as "system" | "standard" | "high")}
                      className="appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
                    >
                      <option value="system">{t.settings.preferences.contrastSystem}</option>
                      <option value="standard">{t.settings.preferences.contrastStandard}</option>
                      <option value="high">{t.settings.preferences.contrastHigh}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>
              </div>

              {/* Group: Input options */}
              <div className="space-y-3 pt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.settings.preferences.inputOptions}
                </span>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.preferences.enterNewLine}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {interpolate(t.settings.preferences.enterNewLineDesc, { modKey: modKeyName })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnterToSend(!enterToSend)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                      enterToSend ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                        enterToSend ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Group: Language & time */}
              <div className="space-y-3 pt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.settings.preferences.languageAndTime}
                </span>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.preferences.language}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t.settings.preferences.languageDesc}
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={locale}
                      onChange={(e) => setLocale(e.target.value as Locale)}
                      className="appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
                    >
                      {SUPPORTED_LOCALES.map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {loc.nativeLabel} ({loc.code.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.preferences.timeFormat}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t.settings.preferences.timeFormatDesc}
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={timeFormat}
                      onChange={(e) => setTimeFormat(e.target.value)}
                      className="appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
                    >
                      <option value="24h">{t.settings.preferences.format24h}</option>
                      <option value="12h">{t.settings.preferences.format12h}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.profile.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {t.settings.profile.description}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30 text-base font-bold text-blue-600 dark:text-blue-400">
                    {userInitial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{userName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.profile.email}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.profile.emailDesc}</p>
                  </div>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{user.email}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.profile.password}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.profile.passwordDesc}</p>
                  </div>
                  <Link
                    href="/reset-password"
                    onClick={closeSettings}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Lock className="h-3 w-3" />
                    <span>{t.settings.profile.changePassword}</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB: WORKSPACE */}
          {activeTab === "workspace" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.workspaceTab.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {interpolate(t.settings.workspaceTab.description, { name: activeOrg?.name || "your organization" })}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.workspaceTab.orgName}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.workspaceTab.orgNameDesc}</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">{activeOrg?.name}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.workspaceTab.slug}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.workspaceTab.slugDesc}</p>
                  </div>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">/{activeOrg?.slug}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.workspaceTab.security}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.workspaceTab.securityDesc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    <span>{t.settings.workspaceTab.rlsEnforced}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PEOPLE */}
          {activeTab === "people" && (
            <div className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.peopleTab.title}</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {t.settings.peopleTab.description}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {loadingMembers ? "Loading..." : `${memberList.length || 1} ${t.settings.peopleTab.total}`}
                </span>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                {(memberList.length > 0 ? memberList : [{ id: "self", role: activeOrg?.role || "owner", profile: { email: user.email, full_name: userName } }]).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {m.profile?.full_name ? m.profile.full_name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                          {m.profile?.full_name || m.profile?.email || "Member"}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{m.profile?.email}</p>
                      </div>
                    </div>
                    <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-mono uppercase font-semibold text-zinc-600 dark:text-zinc-400">
                      {m.role === "owner" ? t.settings.peopleTab.owner : m.role === "admin" ? t.settings.peopleTab.admin : t.settings.peopleTab.member}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.integrationsTab.title}</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {t.settings.integrationsTab.description}
                  </p>
                </div>
                <Link
                  href="/dashboard/settings/integrations"
                  onClick={closeSettings}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <span>{t.settingsPage.manageIntegrations}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={integrationSearch}
                    onChange={(e) => setIntegrationSearch(e.target.value)}
                    placeholder={t.settings.integrationsTab.searchPlaceholder}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

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
                      onClick={() => setIntegrationCategory(cat.id)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                        integrationCategory === cat.id
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Integrations List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5">
                {INTEGRATION_CATALOG
                  .filter((item) => {
                    const matchesCategory =
                      integrationCategory === "all" || item.category === integrationCategory;
                    const matchesSearch =
                      !integrationSearch ||
                      item.name.toLowerCase().includes(integrationSearch.toLowerCase());
                    return matchesCategory && matchesSearch;
                  })
                  .map((item) => {
                    const providerTrans =
                      (t.settings.integrationsTab.providers as any)?.[
                        item.id === "google_calendar"
                          ? "googleCalendar"
                          : item.id === "outlook_calendar"
                          ? "outlookCalendar"
                          : item.id
                      ] || { name: item.name, description: "" };

                    const connectHref =
                      item.id === "gmail"
                        ? "/api/integrations/google/connect?service=gmail"
                        : item.id === "google_calendar"
                        ? "/api/integrations/google/connect?service=calendar"
                        : `/dashboard/settings/integrations?open=${item.id}`;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
                            {renderProviderIcon(item.id)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                {providerTrans.name}
                              </p>
                              <span className="rounded bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                              {providerTrans.description}
                            </p>
                          </div>
                        </div>

                        {item.id === "gmail" || item.id === "google_calendar" ? (
                          <a
                            href={connectHref}
                            className="shrink-0 flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                          >
                            <span>{t.settings.integrationsTab.connect}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <Link
                            href={connectHref}
                            onClick={closeSettings}
                            className="shrink-0 flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <span>{t.settings.integrationsTab.configure}</span>
                            <ExternalLink className="h-3 w-3 text-zinc-400" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB: BILLING */}
          {activeTab === "billing" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.billingTab.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {t.settings.billingTab.description}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.billingTab.currentPlan}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.billingTab.currentPlanDesc}</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white capitalize">
                    {entitlement?.plan || "Starter Plan"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.billingTab.status}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.billingTab.statusDesc}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    <span>{entitlement?.isTrial ? t.settings.billingTab.activeTrial : t.settings.billingTab.activeSubscription}</span>
                  </span>
                </div>

                <div className="pt-2">
                  <Link
                    href="/pricing"
                    onClick={closeSettings}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span>{t.settings.billingTab.changePlan}</span>
                    <ExternalLink className="h-3 w-3 text-zinc-500" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.notificationsTab.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {t.settings.notificationsTab.description}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.notificationsTab.emailNotifs}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.notificationsTab.emailNotifsDesc}</p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">{t.common.enabled}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.settings.notificationsTab.inAppBadges}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.settings.notificationsTab.inAppBadgesDesc}</p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">{t.common.enabled}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
