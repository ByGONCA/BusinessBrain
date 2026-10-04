"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  BookOpen,
  FolderKanban,
  CheckSquare,
  Users,
  GitBranch,
  Sparkles,
  Search,
  Home,
  Mail,
  Calendar,
  Inbox,
  PanelLeftClose,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PageTreeNode, PageRecord } from "@/lib/pages/types";
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
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isAi?: boolean;
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

export function Sidebar({
  user,
  organizations,
  activeOrg,
  entitlement,
  pageTree = [],
  favoritePages = [],
  archivedPages = [],
}: SidebarProps) {
  const pathname = usePathname();
  const { formatShortcut } = usePlatform();
  const { t } = useLanguage();
  const { openInbox, isInboxOpen, unreadCount } = useInbox();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [searchOpen, setSearchOpen] = React.useState(false);

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
      name: t.sidebar.home,
      href: "/dashboard",
      icon: Home,
      isActive: pathname === "/dashboard" || pathname.startsWith("/dashboard/pages"),
    },
    {
      id: "email",
      name: t.sidebar.email,
      href: "/dashboard/email",
      icon: Mail,
      isActive: pathname === "/dashboard/email" || pathname.startsWith("/dashboard/email/"),
    },
    {
      id: "calendar",
      name: t.sidebar.calendar,
      href: "/dashboard/calendar",
      icon: Calendar,
      isActive: pathname === "/dashboard/calendar" || pathname.startsWith("/dashboard/calendar/"),
    },
    {
      id: "inbox",
      name: t.sidebar.inbox,
      href: "#inbox",
      icon: Inbox,
      isActive: isInboxOpen,
      hasBadge: unreadCount > 0,
    },
  ];

  const navSections: NavSection[] = [
    {
      title: t.sidebar.work,
      items: [
        { name: t.sidebar.projects, href: "/dashboard/projects", icon: FolderKanban },
        { name: t.sidebar.tasks, href: "/dashboard/tasks", icon: CheckSquare },
        { name: t.sidebar.meetings, href: "/dashboard/meetings", icon: Users },
      ],
    },
    {
      title: t.sidebar.memory,
      items: [
        { name: "Company Map", href: "/dashboard/connections", icon: Network },
        { name: t.sidebar.brain, href: "/dashboard/brain", icon: Brain, isAi: true },
        { name: t.sidebar.knowledge, href: "/dashboard/knowledge", icon: BookOpen },
        { name: t.sidebar.decisions, href: "/dashboard/decisions", icon: GitBranch },
      ],
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
      {/* Brand Header & Quick Navigation (Seamless - no bottom border) */}
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
            title="Fechar barra lateral (Ctrl+\)"
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
          <span>{t.sidebar.searchPlaceholder}</span>
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
                  title={item.name}
                  className={itemClassName}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                title={item.name}
                className={itemClassName}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Navigation Links (Independently scrollable) */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3 no-scrollbar">
        {/* 1. HOME Section (Primary workspace section at top) */}
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.sidebar.home}
          </div>

          {/* Overview link */}
          <Link
            href="/dashboard"
            prefetch={true}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <LayoutDashboard
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                pathname === "/dashboard"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="truncate">{t.sidebar.overview}</span>
          </Link>

          {/* Pages Workspace Tree (Favorites + Pages) */}
          {activeOrg && (
            <div className="pt-1">
              <SidebarPageTree
                initialPages={pageTree}
                favoritePages={favoritePages}
                archivedPages={archivedPages}
                organizationId={activeOrg.id}
              />
            </div>
          )}
        </div>

        {/* 2. WORK Section */}
        {navSections[0] && (
          <div key={navSections[0].title || "work"} className="space-y-0.5">
            {navSections[0].title && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {navSections[0].title}
              </div>
            )}
            {navSections[0].items.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.isAi && (
                    <span className="ml-auto rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      AI
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* 3. MEMORY Section & any subsequent sections */}
        {navSections.slice(1).map((section, idx) => (
          <div key={section.title || `section-${idx + 1}`} className="space-y-0.5">
            {section.title && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.isAi && (
                    <span className="ml-auto rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      AI
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Fixed Bottom Section (User Account Control) */}
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
