"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  BookOpen,
  FolderKanban,
  CheckSquare,
  Users,
  GitBranch,
  Sparkles,
  Search,
  Home,
  Calendar,
  Inbox,
  PanelLeftClose,
  Network,
  Clock,
  Target,
  Briefcase,
  Activity,
  Sliders,
  ShieldCheck,
  CreditCard,
  History,
  Mail,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PageTreeNode, PageRecord } from "@/lib/pages/types";
import { OrganizationIntegration } from "@/lib/integrations/types";
import { AccountMenu } from "./account-menu";
import { SidebarPageTree } from "./sidebar-page-tree";
import { SearchModal } from "./pages/search-modal";
import { useSidebar } from "./sidebar-context";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useLanguage } from "@/lib/i18n";
import { useInbox } from "./inbox/inbox-context";

interface SidebarProps {
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
  pageTree?: PageTreeNode[];
  favoritePages?: PageRecord[];
  archivedPages?: PageRecord[];
  initialIntegrations?: OrganizationIntegration[];
}

export function Sidebar({
  user,
  organizations,
  activeOrg,
  entitlement,
  pageTree = [],
  favoritePages = [],
  archivedPages = [],
  initialIntegrations = [],
}: SidebarProps) {
  const pathname = usePathname();
  const { formatShortcut } = usePlatform();
  const { t } = useLanguage();
  const { openInbox, isInboxOpen, unreadCount } = useInbox();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Dynamic integration state: GitHub appears under COMPANY when connected
  const initialGitHub = initialIntegrations.some(
    (i) => i.provider === "github" && i.status === "connected"
  );
  const [isGitHubConnected, setIsGitHubConnected] = React.useState(initialGitHub);

  React.useEffect(() => {
    setIsGitHubConnected(
      initialIntegrations.some(
        (i) => i.provider === "github" && i.status === "connected"
      )
    );
  }, [initialIntegrations]);

  React.useEffect(() => {
    function handleIntegrationChange(e: Event) {
      const customEvent = e as CustomEvent<{ provider: string; status: string }>;
      if (customEvent.detail?.provider === "github") {
        setIsGitHubConnected(customEvent.detail.status === "connected");
      }
    }
    window.addEventListener("cb-integration-changed", handleIntegrationChange);
    return () => window.removeEventListener("cb-integration-changed", handleIntegrationChange);
  }, []);

  // Global Cmd+K / Ctrl+K listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const quickNavItems = [
    {
      id: "home",
      name: t.sidebar.home || "Home",
      href: "/dashboard",
      icon: Home,
      isActive: pathname === "/dashboard" || pathname.startsWith("/dashboard/pages"),
    },
    {
      id: "email",
      name: t.sidebar.email || "Email",
      href: "/dashboard/email",
      icon: Mail,
      isActive: pathname === "/dashboard/email" || pathname.startsWith("/dashboard/email/"),
    },
    {
      id: "calendar",
      name: t.sidebar.calendar || "Calendar",
      href: "/dashboard/calendar",
      icon: Calendar,
      isActive: pathname === "/dashboard/calendar" || pathname.startsWith("/dashboard/calendar/"),
    },
    {
      id: "inbox",
      name: t.sidebar.inbox || "Inbox",
      href: "#inbox",
      icon: Inbox,
      isActive: isInboxOpen,
      hasBadge: unreadCount > 0,
    },
  ];

  return (
    <aside
      id="main-sidebar"
      data-sidebar="true"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-sidebar-border bg-sidebar select-none z-30 transition-all duration-200 overflow-hidden",
        isCollapsed
          ? "w-0 border-r-0 opacity-0 pointer-events-none"
          : "w-64 border-r opacity-100"
      )}
    >
      {/* Brand Header, Global Search & Top Quick-Nav Bar */}
      <div className="flex flex-col gap-2.5 p-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-1 hover:opacity-90 transition-opacity min-w-0"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400/25 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground truncate">
              {activeOrg?.name || "Company Brain"}
            </span>
          </Link>

          {/* Button to toggle/close sidebar on the top-right */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title="Collapse sidebar (Ctrl+\)"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Search Action */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t.sidebar.searchPlaceholder || "Search or ask..."}</span>
          <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
            {formatShortcut("K")}
          </kbd>
        </button>

        {/* Horizontal Quick-Nav Bar (Home, Email, Calendar, Inbox) */}
        <div className="flex items-center gap-1 pt-0.5">
          {quickNavItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon className={cn("shrink-0", item.isActive ? "h-3.5 w-3.5" : "h-4 w-4")} />
                {item.isActive && (
                  <span className="text-xs font-medium truncate max-w-[65px]">{item.name}</span>
                )}
                {item.hasBadge && !item.isActive && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-sidebar" />
                )}
              </>
            );

            const itemClassName = cn(
              "relative flex items-center transition-all duration-150 focus:outline-none",
              item.isActive
                ? "gap-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-white shadow-2xs"
                : "rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            );

            if (item.id === "inbox") {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={openInbox}
                  className={itemClassName}
                  title={item.name}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={itemClassName}
                title={item.name}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Canonical Navigation Links (Independently scrollable) */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2 no-scrollbar">
        {/* ========================================================= */}
        {/* 1. WORK                                                   */}
        {/* ========================================================= */}
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.sidebar.work || "WORK"}
          </div>

          {/* Projects */}
          <Link
            href="/dashboard/projects"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/projects")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <FolderKanban
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/projects")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.projects || "Projects"}</span>
          </Link>

          {/* Tasks */}
          <Link
            href="/dashboard/tasks"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/tasks")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <CheckSquare
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/tasks")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.tasks || "Tasks"}</span>
          </Link>

          {/* Goals */}
          <Link
            href="/dashboard/goals"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/goals")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Target
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/goals")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.goals || "Goals"}</span>
          </Link>

          {/* Meetings */}
          <Link
            href="/dashboard/meetings"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/meetings")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Users
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/meetings")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.meetings || "Meetings"}</span>
          </Link>
        </div>

        {/* ========================================================= */}
        {/* 2. PAGES HIERARCHY TREE                                   */}
        {/* ========================================================= */}
        {activeOrg && (
          <div className="py-0.5">
            <SidebarPageTree
              initialPages={pageTree}
              favoritePages={favoritePages}
              archivedPages={archivedPages}
              organizationId={activeOrg.id}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. BRAIN                                                  */}
        {/* ========================================================= */}
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.sidebar.brain || "BRAIN"}
          </div>

          {/* Brain (AI intelligence layer) */}
          <Link
            href="/dashboard/brain"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/brain")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Brain
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/brain")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">Brain</span>
            <span className="ml-auto rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
              AI
            </span>
          </Link>

          {/* Decisions */}
          <Link
            href="/dashboard/decisions"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/decisions")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <GitBranch
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/decisions")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.decisions || "Decisions"}</span>
          </Link>

          {/* Knowledge */}
          <Link
            href="/dashboard/knowledge"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/knowledge")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <BookOpen
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/knowledge")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.knowledge || "Knowledge"}</span>
          </Link>

          {/* Company Map */}
          <Link
            href="/dashboard/connections"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/connections")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Network
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/connections")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.companyMap || "Company Map"}</span>
          </Link>

          {/* Timeline */}
          <Link
            href="/dashboard/timeline"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/timeline")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Clock
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/timeline")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.timeline || "Timeline"}</span>
          </Link>
        </div>

        {/* ========================================================= */}
        {/* 3. COMPANY                                                */}
        {/* ========================================================= */}
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.sidebar.company || "COMPANY"}
          </div>

          {/* People */}
          <Link
            href="/dashboard/people"
            prefetch={false}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname.startsWith("/dashboard/people")
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <Users
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname.startsWith("/dashboard/people")
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.people || "People"}</span>
          </Link>

          {/* GitHub (Appears dynamically only when integration is connected) */}
          {isGitHubConnected && (
            <Link
              href="/dashboard/github"
              prefetch={false}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors animate-in fade-in duration-200",
                pathname.startsWith("/dashboard/github")
                  ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Github
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  pathname.startsWith("/dashboard/github")
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate">GitHub</span>
            </Link>
          )}
        </div>
      </nav>

      {/* ========================================================= */}
      {/* 6. ACCOUNT (Fixed bottom user control & settings)         */}
      {/* ========================================================= */}
      <div className="mt-auto p-2 border-t border-sidebar-border bg-sidebar shrink-0 transition-colors duration-150">
        <AccountMenu
          user={user}
          organizations={organizations}
          activeOrg={activeOrg}
          entitlement={entitlement}
        />
      </div>

      {/* Quick Search Modal Window */}
      {activeOrg && (
        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          organizationId={activeOrg.id}
        />
      )}
    </aside>
  );
}
