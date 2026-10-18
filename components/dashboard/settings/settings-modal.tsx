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
  Trash2,
  Loader2,
  Palette,
  Globe,
  Clock,
  HardDrive,
  FileText,
  Settings2,
  Shield,
  FolderGit2,
  RefreshCw,
} from "lucide-react";
import {
  PhosphorGear,
  PhosphorPlugs,
  PhosphorBell,
  PhosphorCreditCard,
  PhosphorFiles,
  PhosphorClock,
  PhosphorWarningOctagon,
  PhosphorArrowsClockwise,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { OrganizationWithRole, OrganizationMember } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { useSettings } from "./settings-context";
import { useTheme } from "@/components/theme/theme-provider";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useLanguage, SUPPORTED_LOCALES, Locale } from "@/lib/i18n";
import {
  INTEGRATION_CATALOG,
  IntegrationDefinition,
  getProviderLogoUrl,
} from "@/lib/integrations/catalog";
import { OrganizationIntegration } from "@/lib/integrations/types";
import {
  getOrganizationIntegrationsAction,
  deleteIntegrationAction,
} from "@/lib/integrations/actions";
import { disconnectStripeIntegrationAction } from "@/lib/integrations/stripe/actions";
import {
  getGitHubRepositoriesAction,
  setDefaultGitHubRepositoryAction,
} from "@/lib/integrations/github/actions";
import { GitHubRepository, GitHubDiagnosticStatus } from "@/lib/integrations/github/types";
import { ProfileTab } from "./profile-tab";
import { PreferencesTab } from "./preferences-tab";
import { AppearanceTab } from "./appearance-tab";
import { SecurityTab } from "./security-tab";
import { NotificationsTab } from "./notifications-tab";
import { WorkspaceGeneralTab } from "./workspace-general-tab";
import { WorkspaceDefaultsTab } from "./workspace-defaults-tab";
import { PrivacyDataTab } from "./privacy-data-tab";
import { AuditLogTab } from "./audit-log-tab";
import { StorageTab } from "./storage-tab";
import { UsageBillingTab } from "./usage-billing-tab";
import { updateUserLocalizationAction } from "@/lib/settings/actions";

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
  initialIntegrations?: OrganizationIntegration[];
  isOwner?: boolean;
  userPermissions?: string[];
}

function renderProviderIcon(id: string) {
  const logoUrl = getProviderLogoUrl(id);
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={id}
        className="h-5 w-5 object-contain select-none"
        loading="lazy"
      />
    );
  }
  return <Sparkles className="h-4 w-4 text-blue-500" />;
}

const POPULAR_TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (WET / WEST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET / CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET / CEST)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET / CEST)" },
  { value: "America/New_York", label: "America/New York (Eastern Time)" },
  { value: "America/Chicago", label: "America/Chicago (Central Time)" },
  { value: "America/Denver", label: "America/Denver (Mountain Time)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (Pacific Time)" },
  { value: "America/Sao_Paulo", label: "America/São Paulo (BRT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)" },
];

export function SettingsModal({
  user,
  activeOrg,
  entitlement,
  members = [],
  initialIntegrations = [],
  isOwner = false,
  userPermissions = [],
}: SettingsModalProps) {
  const { isOpen, activeTab, closeSettings, setActiveTab } = useSettings();
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { modKey, modKeyName } = usePlatform();
  const { locale, setLocale, t, interpolate } = useLanguage();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [enterToSend, setEnterToSend] = React.useState(true);
  const [timeFormat, setTimeFormat] = React.useState("24h");
  const [timezone, setTimezone] = React.useState("UTC");
  const [firstDayOfWeek, setFirstDayOfWeek] = React.useState<"monday" | "sunday">("monday");
  const [integrationSearch, setIntegrationSearch] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const savedTz = localStorage.getItem("cb_timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setTimezone(savedTz);
      const savedDay = (localStorage.getItem("cb_first_day_of_week") as "monday" | "sunday") || "monday";
      setFirstDayOfWeek(savedDay);
    } catch {}
  }, []);

  const handleTimezoneChange = async (tz: string) => {
    setTimezone(tz);
    try {
      localStorage.setItem("cb_timezone", tz);
      await updateUserLocalizationAction({ timezone: tz });
    } catch {}
  };

  const handleFirstDayChange = async (day: "monday" | "sunday") => {
    setFirstDayOfWeek(day);
    try {
      localStorage.setItem("cb_first_day_of_week", day);
      await updateUserLocalizationAction({ firstDayOfWeek: day });
    } catch {}
  };

  const [integrations, setIntegrations] = React.useState<OrganizationIntegration[]>(initialIntegrations);
  const [loadingIntegrations, setLoadingIntegrations] = React.useState(false);
  const [deletingIntegrationId, setDeletingIntegrationId] = React.useState<string | null>(null);
  const [infoModalItem, setInfoModalItem] = React.useState<IntegrationDefinition | null>(null);

  React.useEffect(() => {
    if (initialIntegrations && initialIntegrations.length > 0) {
      setIntegrations(initialIntegrations);
    }
  }, [initialIntegrations]);

  const loadIntegrations = React.useCallback(async () => {
    setLoadingIntegrations(true);
    try {
      const list = await getOrganizationIntegrationsAction();
      setIntegrations(list);
    } catch (err) {
      console.error("Failed to load integrations", err);
    } finally {
      setLoadingIntegrations(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && activeTab === "integrations") {
      loadIntegrations();
    }
  }, [isOpen, activeTab, loadIntegrations]);

  // GitHub default repository configuration state
  const [githubRepos, setGithubRepos] = React.useState<GitHubRepository[]>([]);
  const [githubDiagnostic, setGithubDiagnostic] = React.useState<{
    status: GitHubDiagnosticStatus;
    message?: string;
    isPartial?: boolean;
    installationsCount?: number;
    appInstallUrl?: string;
  } | null>(null);
  const [loadingGithubRepos, setLoadingGithubRepos] = React.useState(false);
  const [isSavingDefaultRepo, setIsSavingDefaultRepo] = React.useState(false);

  const loadGitHubRepos = React.useCallback(async () => {
    if (!activeOrg) return;
    const isGithubConnected = integrations.some(
      (i) => i.provider === "github" && i.status === "connected"
    );
    if (!isGithubConnected) {
      setGithubRepos([]);
      setGithubDiagnostic(null);
      return;
    }
    setLoadingGithubRepos(true);
    try {
      const res = await getGitHubRepositoriesAction(activeOrg.id);
      if (res.success && res.repositories) {
        setGithubRepos(res.repositories);
      }
      setGithubDiagnostic({
        status: res.diagnosticStatus || (res.success ? "ok" : "api_error"),
        message: res.diagnosticMessage || res.error,
        isPartial: res.isPartial,
        installationsCount: res.installationsCount,
        appInstallUrl: res.appInstallUrl,
      });
    } catch (err: any) {
      console.error("Failed to load GitHub repos", err);
      setGithubDiagnostic({
        status: "api_error",
        message: err?.message || "Falha ao carregar repositórios do GitHub.",
      });
    } finally {
      setLoadingGithubRepos(false);
    }
  }, [activeOrg, integrations]);

  React.useEffect(() => {
    if (isOpen && activeTab === "integrations" && activeOrg) {
      loadGitHubRepos();
    }
  }, [isOpen, activeTab, activeOrg, loadGitHubRepos]);

  // Permissions & Governance
  const userPermSet = React.useMemo(() => new Set(userPermissions), [userPermissions]);
  const hasRootAccess = isOwner || activeOrg?.role === "owner";

  const hasCompanyView = hasRootAccess || userPermSet.has("company.view_settings");
  const hasIntegrationsView = hasRootAccess || userPermSet.has("integrations.view");
  const hasFilesView = hasRootAccess || userPermSet.has("files.view");
  const hasBillingView = hasRootAccess || userPermSet.has("billing.view");
  const isAuditAllowed = hasRootAccess || activeOrg?.role === "admin";

  const canManageIntegrations =
    hasRootAccess ||
    userPermSet.has("integrations.connect") ||
    userPermSet.has("integrations.disconnect");

  const canManageGitHubConnection =
    hasRootAccess ||
    userPermSet.has("github.manage_connection") ||
    userPermSet.has("integrations.connect");

  const canManageGitHubRepos =
    hasRootAccess ||
    userPermSet.has("github.manage_repositories") ||
    userPermSet.has("integrations.configure");

  // Fallback if activeTab is not permitted for the user
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "workspace" && !hasCompanyView) {
      setActiveTab("preferences");
    } else if (activeTab === "integrations" && !hasIntegrationsView) {
      setActiveTab("preferences");
    } else if (activeTab === "defaults" && !hasCompanyView) {
      setActiveTab("preferences");
    } else if (activeTab === "audit_log" && !isAuditAllowed) {
      setActiveTab("preferences");
    } else if (activeTab === "storage" && !hasFilesView) {
      setActiveTab("preferences");
    } else if (activeTab === "billing" && !hasBillingView) {
      setActiveTab("preferences");
    }
  }, [isOpen, activeTab, hasCompanyView, hasIntegrationsView, isAuditAllowed, hasFilesView, hasBillingView, setActiveTab]);

  // User details
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";
  const userInitial = userName.charAt(0).toUpperCase();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6"
      onClick={closeSettings}
    >
      {/* Modal Dialog Window */}
      <div
        className="relative flex h-[820px] max-h-[94vh] w-full max-w-6xl xl:max-w-7xl overflow-hidden rounded-2xl border border-[#242427] bg-[#141415] text-[#F5F5F5] shadow-2xl transition-colors duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* LEFT SETTINGS SIDEBAR                                    */}
        {/* ========================================================= */}
        <aside className="w-56 shrink-0 border-r border-[#1C1C1F] bg-[#080809] p-3 flex flex-col justify-between select-none">
          <div className="space-y-3 overflow-y-auto no-scrollbar">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.settings.searchPlaceholder}
                className="w-full rounded-lg border border-[#242427] bg-[#141415] py-1.5 pl-8 pr-2.5 text-xs text-[#F5F5F5] placeholder-[#71717A] focus:border-[#3B82F6] focus:outline-none transition-colors"
              />
            </div>

            {/* Section: Account */}
            <div className="space-y-0.5">
              <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Account
              </span>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "profile"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-[10px] font-bold text-blue-400">
                  {userInitial}
                </div>
                <span className="truncate">{userName}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "security"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <PhosphorWarningOctagon className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Security</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("preferences")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "preferences"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <Sliders className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Preferences</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "appearance"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <Palette className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Appearance</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "notifications"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <PhosphorBell className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Notifications</span>
              </button>
            </div>

            {/* Section: Workspace */}
            {(hasCompanyView || hasIntegrationsView) && (
              <div className="space-y-0.5 pt-2">
                <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                  Workspace
                </span>

                {hasCompanyView && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("workspace")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                      activeTab === "workspace"
                        ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                        : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                    )}
                  >
                    <PhosphorGear className="h-3.5 w-3.5 text-[#71717A]" />
                    <span>General</span>
                  </button>
                )}

                {hasIntegrationsView && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("integrations")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                      activeTab === "integrations"
                        ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                        : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                    )}
                  >
                    <PhosphorPlugs className="h-3.5 w-3.5 text-[#71717A]" />
                    <span>Integrations</span>
                  </button>
                )}

                {hasCompanyView && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("defaults")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                      activeTab === "defaults"
                        ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                        : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                    )}
                  >
                    <PhosphorGear className="h-3.5 w-3.5 text-[#71717A]" />
                    <span>Defaults</span>
                  </button>
                )}
              </div>
            )}

            {/* Section: Data & Security */}
            <div className="space-y-0.5 pt-2">
              <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Data & Security
              </span>

              <button
                type="button"
                onClick={() => setActiveTab("privacy")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                  activeTab === "privacy"
                    ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <FileText className="h-3.5 w-3.5 text-[#71717A]" />
                <span>Privacy & Data</span>
              </button>

              {isAuditAllowed && (
                <button
                  type="button"
                  onClick={() => setActiveTab("audit_log")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    activeTab === "audit_log"
                      ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                      : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                  )}
                >
                  <PhosphorClock className="h-3.5 w-3.5 text-[#71717A]" />
                  <span>Audit Log</span>
                </button>
              )}

              {hasFilesView && (
                <button
                  type="button"
                  onClick={() => setActiveTab("storage")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    activeTab === "storage"
                      ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                      : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                  )}
                >
                  <PhosphorFiles className="h-3.5 w-3.5 text-[#71717A]" />
                  <span>Storage</span>
                </button>
              )}
            </div>

            {/* Section: Access & Billing */}
            {hasBillingView && (
              <div className="space-y-0.5 pt-2">
                <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                  {t.settings.sections.accessAndBilling}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab("billing")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    activeTab === "billing"
                      ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                      : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                  )}
                >
                  <PhosphorCreditCard className="h-3.5 w-3.5 text-[#71717A]" />
                  <span>Usage & Billing</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Hint */}
          <div className="pt-2 border-t border-[#1C1C1F] text-[10px] text-[#71717A] font-mono">
            <span>{t.settings.escToClose} &bull; {modKey} ,</span>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT ACTIVE TAB CONTENT                                  */}
        {/* ========================================================= */}
        <main className="flex-1 overflow-y-auto p-7 no-scrollbar relative bg-[#0B0B0C] text-[#F5F5F5]">
          {/* Close button */}
          <button
            type="button"
            onClick={closeSettings}
            aria-label="Close settings"
            className="absolute top-5 right-5 p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* TAB: PREFERENCES */}
          {activeTab === "preferences" && <PreferencesTab />}

          {/* TAB: PROFILE */}
          {activeTab === "profile" && <ProfileTab user={user} />}

          {/* TAB: SECURITY */}
          {activeTab === "security" && <SecurityTab user={user} />}

          {/* TAB: APPEARANCE */}
          {activeTab === "appearance" && <AppearanceTab />}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === "notifications" && <NotificationsTab />}

          {/* TAB: WORKSPACE / GENERAL */}
          {activeTab === "workspace" && <WorkspaceGeneralTab activeOrg={activeOrg} />}

          {/* TAB: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-4 w-full max-w-4xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{t.settings.integrationsTab.title}</h2>
              </div>

              {/* Search Bar Only (Filtros removidos) */}
              <div className="relative pt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={integrationSearch}
                  onChange={(e) => setIntegrationSearch(e.target.value)}
                  placeholder={t.settings.integrationsTab.searchPlaceholder}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Integrations List */}
              <div className="space-y-2.5">
                {INTEGRATION_CATALOG
                  .filter((item) => {
                    const matchesSearch =
                      !integrationSearch ||
                      item.name.toLowerCase().includes(integrationSearch.toLowerCase());
                    return matchesSearch;
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

                    // Find all connected accounts for this specific integration
                    const connectedAccounts = integrations.filter((i) => {
                      if (i.status !== "connected") return false;
                      if (i.provider === item.id) return true;
                      if (i.provider === "google") {
                        if (item.id === "gmail" && i.scopes?.some((s) => s.includes("gmail"))) return true;
                        if (item.id === "google_calendar" && i.scopes?.some((s) => s.includes("calendar"))) return true;
                        if (item.id === "google_drive" && i.scopes?.some((s) => s.includes("drive"))) return true;
                      }
                      if (i.provider === "outlook" || i.provider === "outlook_calendar") {
                        if (item.id === "outlook" && (i.provider === "outlook" || i.scopes?.some((s) => s.toLowerCase().includes("mail")))) return true;
                        if (item.id === "outlook_calendar" && (i.provider === "outlook_calendar" || i.scopes?.some((s) => s.toLowerCase().includes("calendar")))) return true;
                      }
                      if (item.id === "github" && i.provider === "github") {
                        return true;
                      }
                      return false;
                    });

                    const handleConfigureClick = () => {
                      if (item.id === "gmail") {
                        window.location.href = "/api/integrations/google/connect?service=gmail";
                      } else if (item.id === "google_calendar") {
                        window.location.href = "/api/integrations/google/connect?service=calendar";
                      } else if (item.id === "google_drive") {
                        window.location.href = "/api/integrations/google/connect?service=drive";
                      } else if (item.id === "outlook") {
                        window.location.href = "/api/integrations/microsoft/connect?service=outlook";
                      } else if (item.id === "outlook_calendar") {
                        window.location.href = "/api/integrations/microsoft/connect?service=outlook_calendar";
                      } else if (item.id === "github") {
                        window.location.href = "/api/integrations/github/connect";
                      } else if (item.id === "stripe") {
                        window.location.href = "/api/integrations/stripe/connect";
                      } else {
                        setInfoModalItem(item);
                      }
                    };

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        {/* Main Item Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
                              {renderProviderIcon(item.id)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                {providerTrans.name}
                              </p>
                            </div>
                          </div>

                          {item.id === "stripe" && connectedAccounts.length > 0 ? (
                            <div className="shrink-0 flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-mono text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                                  {connectedAccounts[0].providerAccountId}
                                </span>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider ml-1">
                                  Connected
                                </span>
                              </div>
                              {canManageIntegrations && (
                                <button
                                  type="button"
                                  disabled={deletingIntegrationId === connectedAccounts[0].id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Deseja desconectar a conta Stripe da empresa?")) {
                                      setDeletingIntegrationId(connectedAccounts[0].id);
                                      try {
                                        const res = await disconnectStripeIntegrationAction();
                                        if (!res.success) {
                                          alert(res.error || "Erro ao desconectar Stripe.");
                                        } else {
                                          const data = res.data as { warning?: string; remoteRevocationConfirmed?: boolean } | undefined;
                                          if (data?.warning) {
                                            alert(data.warning);
                                          }
                                          await loadIntegrations();
                                          window.dispatchEvent(
                                            new CustomEvent("cb-integration-changed", {
                                              detail: { provider: "stripe", status: "disconnected" },
                                            })
                                          );
                                        }
                                      } catch (err) {
                                        console.error("Erro ao remover Stripe:", err);
                                      } finally {
                                        setDeletingIntegrationId(null);
                                      }
                                    }
                                  }}
                                  className="p-1 rounded-md text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                                  title="Desconectar conta Stripe"
                                >
                                  {deletingIntegrationId === connectedAccounts[0].id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : item.id === "github" && connectedAccounts.length > 0 ? (
                            <div className="shrink-0 flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-mono text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                                  @{(connectedAccounts[0].metadata as any)?.github_login || connectedAccounts[0].accountEmail || connectedAccounts[0].providerAccountId}
                                </span>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider ml-1">
                                  Connected
                                </span>
                              </div>
                              {canManageGitHubConnection && (
                                <button
                                  type="button"
                                  disabled={deletingIntegrationId === connectedAccounts[0].id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const name = (connectedAccounts[0].metadata as any)?.github_login || connectedAccounts[0].accountEmail || connectedAccounts[0].providerAccountId;
                                    if (confirm(`Deseja desconectar a conta do GitHub (@${name})?`)) {
                                      setDeletingIntegrationId(connectedAccounts[0].id);
                                      try {
                                        await deleteIntegrationAction(connectedAccounts[0].id);
                                        setGithubRepos([]);
                                        await loadIntegrations();
                                        window.dispatchEvent(
                                          new CustomEvent("cb-integration-changed", {
                                            detail: { provider: "github", status: "disconnected" },
                                          })
                                        );
                                      } catch (err) {
                                        console.error("Erro ao remover conta:", err);
                                      } finally {
                                        setDeletingIntegrationId(null);
                                      }
                                    }
                                  }}
                                  className="p-1 rounded-md text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                                  title="Desconectar conta"
                                >
                                  {deletingIntegrationId === connectedAccounts[0].id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            ((item.id === "github" ? canManageGitHubConnection : canManageIntegrations) ? (
                              <button
                                type="button"
                                onClick={handleConfigureClick}
                                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
                              >
                                <span>{item.id === "github" || item.id === "stripe" ? "Conectar" : (t.settings.integrationsTab.configure || "Configure")}</span>
                                <ExternalLink className="h-3 w-3 text-zinc-400" />
                              </button>
                            ) : null)
                          )}
                        </div>

                        {/* GitHub Default Repository Selector for Workspace */}
                        {item.id === "github" && connectedAccounts.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              <div className="flex items-center gap-1.5">
                                <span>Repositório Principal do Workspace</span>
                                <button
                                  type="button"
                                  disabled={loadingGithubRepos}
                                  onClick={() => loadGitHubRepos()}
                                  title="Recarregar repositórios do GitHub"
                                  className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                                >
                                  <RefreshCw className={cn("h-3 w-3", loadingGithubRepos && "animate-spin")} />
                                </button>
                              </div>
                              {isSavingDefaultRepo && (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-normal">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> A guardar...
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Define o repositório apresentado por predefinição a todos os membros no separador GitHub.
                            </p>
                            {canManageGitHubRepos ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <select
                                    disabled={loadingGithubRepos || isSavingDefaultRepo}
                                    value={
                                      ((connectedAccounts[0].metadata as any)?.default_repository as string) || ""
                                    }
                                    onChange={async (e) => {
                                      const newRepo = e.target.value;
                                      if (!activeOrg) return;
                                      setIsSavingDefaultRepo(true);
                                      try {
                                        const res = await setDefaultGitHubRepositoryAction(activeOrg.id, newRepo);
                                        if (res.success) {
                                          await loadIntegrations();
                                        }
                                      } finally {
                                        setIsSavingDefaultRepo(false);
                                      }
                                    }}
                                    className="w-full text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#161618] px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100 shadow-2xs focus:border-zinc-500 focus:outline-hidden cursor-pointer"
                                  >
                                    <option value="">-- Selecionar repositório predefinido --</option>
                                    {githubRepos.map((repo) => (
                                      <option key={repo.id} value={repo.full_name}>
                                        {repo.full_name} {repo.private ? "(Privado 🔒)" : "(Público 🌐)"}
                                      </option>
                                    ))}
                                  </select>
                                  {loadingGithubRepos && (
                                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400 shrink-0" />
                                  )}
                                </div>
                                {githubDiagnostic?.status === "auth_expired" && (
                                  <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5">
                                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                      Sessão GitHub Expirada ou Revogada
                                    </p>
                                    <p className="text-[10px]">
                                      A autenticação com o GitHub expirou. Por favor reconecta a integração para restabelecer as permissões de acesso.
                                    </p>
                                  </div>
                                )}

                                {githubDiagnostic?.status === "rate_limit_exceeded" && (
                                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 shrink-0" />
                                      Limite de Pedidos da API Excedido
                                    </p>
                                    <p className="text-[10px]">
                                      O limite temporário de requisições ao GitHub foi atingido. Aguarda alguns minutos e clica no botão de recarregar.
                                    </p>
                                  </div>
                                )}

                                {githubDiagnostic?.status === "insufficient_permissions" && (
                                  <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5">
                                      <Lock className="h-3.5 w-3.5 shrink-0" />
                                      Permissões Insuficientes
                                    </p>
                                    <p className="text-[10px]">
                                      {githubDiagnostic.message || "A conta conectada não possui autorização para aceder a repositórios nesta organização."}
                                    </p>
                                  </div>
                                )}

                                {githubDiagnostic?.status === "app_not_installed" && (
                                  <div className="rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 space-y-1.5">
                                    <p className="font-semibold flex items-center gap-1.5">
                                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                      Aplicação GitHub não instalada
                                    </p>
                                    <p className="text-[10px] leading-relaxed">
                                      Para aceder aos teus repositórios privados da conta pessoal ou organização, a GitHub App precisa de ser instalada na tua conta GitHub.
                                    </p>
                                    <div className="pt-0.5">
                                      <a
                                        href={githubDiagnostic.appInstallUrl || "https://github.com/settings/installations"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100 px-2 py-1 rounded hover:bg-amber-300/80 dark:hover:bg-amber-800 transition-colors"
                                      >
                                        Instalar Aplicação no GitHub
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                )}

                                {githubDiagnostic?.status === "app_installed_limited_access" && (
                                  <div className="rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 space-y-1.5">
                                    <p className="font-semibold flex items-center gap-1.5">
                                      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                      Acesso Restrito na Aplicação GitHub
                                    </p>
                                    <p className="text-[10px] leading-relaxed">
                                      A GitHub App está instalada com seleção restrita de repositórios (<em>Only select repositories</em>). Se o teu repositório privado pretendido não surge na lista acima, concede acesso ao mesmo nas definições de instalação do GitHub.
                                    </p>
                                    <div className="pt-0.5">
                                      <a
                                        href="https://github.com/settings/installations"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100 px-2 py-1 rounded hover:bg-amber-300/80 dark:hover:bg-amber-800 transition-colors"
                                      >
                                        Gerir Repositórios Autorizados
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                )}

                                {githubDiagnostic?.status === "no_repositories" && (
                                  <div className="rounded-lg bg-zinc-100/70 dark:bg-zinc-800/60 p-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                                    Nenhum repositório acessível encontrado na conta conectada.
                                  </div>
                                )}

                                {githubDiagnostic?.isPartial && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <span>⚠️</span> Aviso: A listagem de repositórios pode estar incompleta devido a limite temporário de pedidos.
                                  </p>
                                )}

                                {githubRepos.some((r) => r.private) && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                    ✓ Repositórios privados e públicos disponíveis.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs font-mono px-2.5 py-1.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                                {((connectedAccounts[0].metadata as any)?.default_repository as string) || "Nenhum repositório predefinido configurado"}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Connected Accounts List (for other multi-account integrations) */}
                        {connectedAccounts.length > 0 && item.id !== "github" && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                              <span>Contas conectadas ({connectedAccounts.length})</span>
                            </div>
                            <div className="space-y-1">
                              {connectedAccounts.map((acc) => (
                                <div
                                  key={acc.id}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 truncate">
                                      {acc.accountEmail || acc.providerAccountId}
                                    </span>
                                  </div>
                                  {canManageIntegrations && (
                                    <button
                                      type="button"
                                      disabled={deletingIntegrationId === acc.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Deseja remover a integração de ${acc.accountEmail || acc.providerAccountId}?`)) {
                                          setDeletingIntegrationId(acc.id);
                                          try {
                                            await deleteIntegrationAction(acc.id);
                                            await loadIntegrations();
                                            window.dispatchEvent(
                                              new CustomEvent("cb-integration-changed", {
                                                detail: { provider: acc.provider, status: "disconnected" },
                                              })
                                            );
                                          } catch (err) {
                                            console.error("Erro ao remover conta:", err);
                                          } finally {
                                            setDeletingIntegrationId(null);
                                          }
                                        }
                                      }}
                                      className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                                      title="Remover conta"
                                    >
                                      {deletingIntegrationId === acc.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB: DEFAULTS */}
          {activeTab === "defaults" && <WorkspaceDefaultsTab activeOrg={activeOrg} />}

          {/* TAB: PRIVACY & DATA */}
          {activeTab === "privacy" && <PrivacyDataTab activeOrg={activeOrg} />}

          {/* TAB: AUDIT LOG */}
          {activeTab === "audit_log" && <AuditLogTab activeOrg={activeOrg} />}

          {/* TAB: STORAGE */}
          {activeTab === "storage" && <StorageTab activeOrg={activeOrg} />}

          {/* TAB: USAGE & BILLING */}
          {activeTab === "billing" && (
            <UsageBillingTab entitlement={entitlement} closeSettings={closeSettings} />
          )}
        </main>
      </div>

      {/* Setup Guide / Credentials Modal */}
      {infoModalItem && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
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

              <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/50 p-3 text-zinc-700 dark:text-zinc-300 space-y-1 text-[11px]">
                <p className="font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Configured via .env</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Check your project&apos;s <code className="font-mono">.env.example</code> for credentials and instructions.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModalItem(null)}
                className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
