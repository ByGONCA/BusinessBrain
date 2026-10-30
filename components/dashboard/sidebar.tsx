"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Search,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Mail,
  ChevronDown,
  Briefcase,
  Layers,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  PhosphorHouse,
  PhosphorFolder,
  PhosphorCheckSquare,
  PhosphorTarget,
  PhosphorCalendarDots,
  PhosphorBrain,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
  PhosphorClock,
  PhosphorUserList,
  PhosphorCalendar,
  PhosphorGithubLogo,
} from "@/components/icons";
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
  demoMode?: boolean;
  activeDemoPath?: string;
  onDemoNavigate?: (href: string) => void;
}

interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  badge?: string;
  hasBadge?: boolean;
}

interface DropdownNavGroup {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  items: NavItem[];
  isCustom?: boolean;
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
  demoMode = false,
  activeDemoPath,
  onDemoNavigate,
}: SidebarProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || "";
  const effectivePath = demoMode && activeDemoPath ? activeDemoPath : pathname;
  const { formatShortcut } = usePlatform();
  const { t } = useLanguage();
  const { openInbox, isInboxOpen, unreadCount } = useInbox();
  const {
    isCompact,
    toggleSidebar,
    isMobileOpen,
    closeMobileSidebar,
    isGroupExpanded,
    toggleGroup,
  } = useSidebar();

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [activeFlyoutGroup, setActiveFlyoutGroup] = React.useState<string | null>(null);
  const flyoutTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Dynamic integration state: GitHub appears under ORGANIZATION when connected
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

  // Auto-expand parent group of active route
  React.useEffect(() => {
    if (!effectivePath) return;
    if (
      effectivePath.startsWith("/dashboard/projects") ||
      effectivePath.startsWith("/dashboard/tasks") ||
      effectivePath.startsWith("/dashboard/goals") ||
      effectivePath.startsWith("/dashboard/meetings") ||
      effectivePath.startsWith("/dashboard/finance")
    ) {
      if (!isGroupExpanded("work")) toggleGroup("work");
    } else if (effectivePath.startsWith("/dashboard/pages")) {
      if (!isGroupExpanded("pages")) toggleGroup("pages");
    } else if (
      effectivePath.startsWith("/dashboard/brain") ||
      effectivePath.startsWith("/dashboard/decisions") ||
      effectivePath.startsWith("/dashboard/knowledge") ||
      effectivePath.startsWith("/dashboard/connections") ||
      effectivePath.startsWith("/dashboard/timeline")
    ) {
      if (!isGroupExpanded("brain")) toggleGroup("brain");
    } else if (
      effectivePath.startsWith("/dashboard/people") ||
      effectivePath.startsWith("/dashboard/teams") ||
      effectivePath.startsWith("/dashboard/github")
    ) {
      if (!isGroupExpanded("company")) toggleGroup("company");
    }
  }, [effectivePath]);

  // Close flyout on pathname change
  React.useEffect(() => {
    setActiveFlyoutGroup(null);
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  // Top navigation items: Home, Inbox, Calendar, Email
  const topNavItems: NavItem[] = [
    {
      id: "home",
      name: t?.sidebar?.home || "Home",
      href: "/dashboard",
      icon: PhosphorHouse,
      isActive: effectivePath === "/dashboard",
    },
    {
      id: "inbox",
      name: t?.sidebar?.inbox || "Inbox",
      href: "#inbox",
      icon: Inbox,
      isActive: isInboxOpen,
      hasBadge: unreadCount > 0,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    {
      id: "calendar",
      name: t?.sidebar?.calendar || "Calendar",
      href: "/dashboard/calendar",
      icon: PhosphorCalendar,
      isActive: effectivePath === "/dashboard/calendar" || effectivePath.startsWith("/dashboard/calendar/"),
    },
    {
      id: "email",
      name: t?.sidebar?.email || "Email",
      href: "/dashboard/email",
      icon: Mail,
      isActive: effectivePath === "/dashboard/email" || effectivePath.startsWith("/dashboard/email/"),
    },
  ];

  // Grouped items
  const workItems: NavItem[] = [
    {
      id: "projects",
      name: t?.sidebar?.projects || "Projects",
      href: "/dashboard/projects",
      icon: PhosphorFolder,
      isActive: effectivePath.startsWith("/dashboard/projects"),
    },
    {
      id: "tasks",
      name: t?.sidebar?.tasks || "Tasks",
      href: "/dashboard/tasks",
      icon: PhosphorCheckSquare,
      isActive: effectivePath.startsWith("/dashboard/tasks"),
    },
    {
      id: "goals",
      name: t?.sidebar?.goals || "Goals",
      href: "/dashboard/goals",
      icon: PhosphorTarget,
      isActive: effectivePath.startsWith("/dashboard/goals"),
    },
    {
      id: "meetings",
      name: t?.sidebar?.meetings || "Meetings",
      href: "/dashboard/meetings",
      icon: PhosphorCalendarDots,
      isActive: effectivePath.startsWith("/dashboard/meetings"),
    },
    {
      id: "finance",
      name: t?.sidebar?.finance || "Finance",
      href: "/dashboard/finance",
      icon: TrendingUp,
      isActive: effectivePath.startsWith("/dashboard/finance"),
    },
  ];

  const brainItems: NavItem[] = [
    {
      id: "ai-chat",
      name: "AI Chat",
      href: "/dashboard/brain/chat",
      icon: Sparkles,
      isActive: effectivePath.startsWith("/dashboard/brain/chat"),
    },
    {
      id: "brain",
      name: "Brain",
      href: "/dashboard/brain",
      icon: PhosphorBrain,
      isActive: effectivePath === "/dashboard/brain",
    },
    {
      id: "decisions",
      name: t?.sidebar?.decisions || "Decisions",
      href: "/dashboard/decisions",
      icon: PhosphorGitBranch,
      isActive: effectivePath.startsWith("/dashboard/decisions"),
    },
    {
      id: "knowledge",
      name: t?.sidebar?.knowledge || "Knowledge",
      href: "/dashboard/knowledge",
      icon: PhosphorBookOpen,
      isActive: effectivePath.startsWith("/dashboard/knowledge"),
    },
    {
      id: "connections",
      name: t?.sidebar?.companyMap || "Company Map",
      href: "/dashboard/connections",
      icon: PhosphorNetwork,
      isActive: effectivePath.startsWith("/dashboard/connections"),
    },
    {
      id: "timeline",
      name: t?.sidebar?.timeline || "Timeline",
      href: "/dashboard/timeline",
      icon: PhosphorClock,
      isActive: effectivePath.startsWith("/dashboard/timeline"),
    },
  ];

  const organizationItems: NavItem[] = [
    {
      id: "people",
      name: t?.sidebar?.people || "People & Teams",
      href: "/dashboard/people",
      icon: PhosphorUserList,
      isActive: effectivePath.startsWith("/dashboard/people") || effectivePath.startsWith("/dashboard/teams"),
    },
    ...(isGitHubConnected
      ? [
          {
            id: "github",
            name: "GitHub",
            href: "/dashboard/github",
            icon: PhosphorGithubLogo,
            isActive: effectivePath.startsWith("/dashboard/github"),
          },
        ]
      : []),
  ];

  const dropdownGroups: DropdownNavGroup[] = [
    {
      id: "work",
      name: "Work",
      icon: PhosphorFolder,
      items: workItems,
    },
    {
      id: "brain",
      name: "Brain",
      icon: PhosphorBrain,
      items: brainItems,
    },
    {
      id: "company",
      name: "Organization",
      icon: PhosphorUserList,
      items: organizationItems,
    },
  ];

  const handleFlyoutEnter = (groupId: string) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    setActiveFlyoutGroup(groupId);
  };

  const handleFlyoutLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => {
      setActiveFlyoutGroup(null);
    }, 150);
  };

  const handleNavClick = (href: string, e?: React.MouseEvent) => {
    if (demoMode && onDemoNavigate) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      onDemoNavigate(href);
    }
  };

  // Reusable render helper for standard nav items (Home, Inbox, Calendar, Email, subitems)
  const renderNavItem = (item: NavItem, isSubitem = false) => {
    const Icon = item.icon;
    const isInboxItem = item.id === "inbox";

    const content = (
      <>
        <Icon
          className={cn(
            "shrink-0 transition-colors",
            isSubitem ? "h-4 w-4" : "h-[17px] w-[17px]",
            item.isActive ? "text-[#FFFFFF]" : "text-[#71717A] group-hover:text-[#FAFAFA]"
          )}
        />
        <span className="truncate">{item.name}</span>
        {item.badge && (
          <span className="ml-auto flex items-center justify-center h-4 min-w-4 px-1.5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-semibold border border-blue-500/25">
            {item.badge}
          </span>
        )}
      </>
    );

    const itemClass = cn(
      "group flex w-full items-center rounded-lg transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600",
      isSubitem
        ? "h-[32px] px-2.5 gap-2 text-[13px] font-medium text-[#94949E] hover:text-[#FAFAFA] hover:bg-[#18181B]"
        : "h-[36px] px-2.5 gap-2.5 text-[13.5px] font-medium text-[#94949E] hover:text-[#FAFAFA] hover:bg-[#18181B]",
      item.isActive && "bg-[#202024] text-[#FFFFFF] font-medium border border-[#2E2E34]/50 shadow-2xs"
    );

    const dataTour = item.id === "connections" ? "company-map" : undefined;

    return isInboxItem ? (
      <button
        key={item.id}
        type="button"
        data-tour={dataTour}
        onClick={openInbox}
        className={itemClass}
      >
        {content}
      </button>
    ) : (
      <Link
        key={item.id}
        href={item.href}
        data-tour={dataTour}
        prefetch={false}
        onClick={(e) => handleNavClick(item.href, e)}
        className={itemClass}
      >
        {content}
      </Link>
    );
  };

  // Reusable render helper for expandable group toggles (Work, Pages, Brain, Organization)
  const renderGroupToggle = (
    id: string,
    name: string,
    Icon: React.ComponentType<{ className?: string }>,
    isExpanded: boolean,
    hasActiveChild: boolean
  ) => (
    <button
      type="button"
      onClick={() => toggleGroup(id)}
      aria-expanded={isExpanded}
      className={cn(
        "group flex w-full items-center justify-between rounded-lg h-[36px] px-2.5 text-[13.5px] font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600",
        hasActiveChild && !isExpanded
          ? "bg-[#18181B] text-[#FAFAFA] font-medium"
          : "text-[#94949E] hover:bg-[#18181B] hover:text-[#FAFAFA]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-[17px] w-[17px] shrink-0 text-[#71717A] group-hover:text-[#FAFAFA]" />
        <span className="truncate">{name}</span>
      </div>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-[#52525B] group-hover:text-[#A1A1AA] transition-transform duration-150",
          !isExpanded && "-rotate-90"
        )}
      />
    </button>
  );

  // Compact rail helpers
  const renderCompactNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isInboxItem = item.id === "inbox";
    return isInboxItem ? (
      <button
        key={item.id}
        type="button"
        onClick={openInbox}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
          item.isActive
            ? "bg-[#202024] text-[#FFFFFF] border border-[#2E2E34]/50 shadow-2xs"
            : "text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]"
        )}
        title={item.name}
      >
        <Icon className="h-4 w-4" />
        {item.hasBadge && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-[#09090A]" />
        )}
      </button>
    ) : (
      <Link
        key={item.id}
        href={item.href}
        prefetch={false}
        onClick={(e) => handleNavClick(item.href, e)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
          item.isActive
            ? "bg-[#202024] text-[#FFFFFF] border border-[#2E2E34]/50 shadow-2xs"
            : "text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]"
        )}
        title={item.name}
      >
        <Icon className="h-4 w-4" />
      </Link>
    );
  };

  const renderCompactGroup = (group: DropdownNavGroup) => {
    const GroupIcon = group.icon;
    const isGroupActive = group.items.some((i) => i.isActive);
    const isFlyoutOpen = activeFlyoutGroup === group.id;

    return (
      <div
        key={group.id}
        className="relative"
        onMouseEnter={() => handleFlyoutEnter(group.id)}
        onMouseLeave={handleFlyoutLeave}
      >
        <button
          type="button"
          onClick={() => setActiveFlyoutGroup((prev) => (prev === group.id ? null : group.id))}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
            isGroupActive
              ? "bg-[#202024] text-[#FFFFFF] border border-[#2E2E34]/50 shadow-2xs"
              : "text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]"
          )}
          title={group.name}
          aria-haspopup="true"
          aria-expanded={isFlyoutOpen}
        >
          <GroupIcon className="h-4 w-4" />
        </button>

        {isFlyoutOpen && (
          <div
            className="absolute left-full top-0 ml-2 w-52 rounded-xl border border-[#242428] bg-[#121215] p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100"
            onMouseEnter={() => handleFlyoutEnter(group.id)}
            onMouseLeave={handleFlyoutLeave}
          >
            <div className="px-2.5 py-1 text-[11px] font-semibold text-[#FAFAFA] border-b border-[#1E1E22] mb-1">
              {group.name}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={false}
                    onClick={(e) => handleNavClick(item.href, e)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                      item.isActive
                        ? "bg-[#202024] text-[#FFFFFF] font-medium"
                        : "text-[#94949E] hover:bg-[#18181B] hover:text-[#FAFAFA]"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded-full bg-blue-500/15 px-1.5 py-0.2 text-[9px] font-medium text-blue-400 border border-blue-500/25">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        id="main-sidebar"
        data-sidebar="true"
        className={cn(
          demoMode
            ? "relative flex h-full max-h-full shrink-0 flex-col border-r border-[#1E1E22] bg-[#09090B] select-none transition-all duration-200 ease-in-out"
            : "fixed md:sticky top-0 left-0 flex h-screen shrink-0 flex-col border-r border-[#1E1E22] bg-[#09090B] select-none z-50 transition-all duration-200 ease-in-out",
          // Mobile state
          isMobileOpen ? "translate-x-0 w-60 shadow-2xl" : "-translate-x-full md:translate-x-0",
          // Desktop compact vs expanded
          isCompact ? "md:w-16" : "md:w-60"
        )}
      >
        {/* ========================================================= */}
        {/* Top Header: Organization Switcher & Search (Reference)    */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-2 p-2.5 pb-2 shrink-0">
          {isCompact ? (
            /* COLLAPSED MODE: Single centered logo button that expands the sidebar */
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-xs hover:bg-blue-500 transition-colors ring-1 ring-blue-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                title="Expand sidebar (Ctrl+\)"
                aria-label="Expand sidebar"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* EXPANDED MODE: Logo link to Landing Page ('/') + Collapse Button */
            <div className="flex items-center justify-between" data-tour="org-switcher">
              <Link
                href="/"
                onClick={(e) => handleNavClick("/dashboard", e)}
                className="flex items-center justify-center rounded-md p-0.5 hover:bg-[#141416] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
                title="Go to home page"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white shadow-xs shrink-0 ring-1 ring-blue-500/20 hover:bg-blue-500 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              </Link>

              {/* Collapse button on desktop */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 cursor-pointer"
                title="Collapse sidebar (Ctrl+\)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick Search Pill */}
          {!isCompact ? (
            <button
              type="button"
              data-tour="search-bar"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-[#242428] bg-[#141416] px-2.5 h-9 text-xs text-[#71717A] hover:border-[#323238] hover:text-[#D4D4D8] transition-colors shadow-2xs mt-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
            >
              <Search className="h-3.5 w-3.5 text-[#71717A]" />
              <span className="truncate">{t?.sidebar?.searchPlaceholder || "Search or ask..."}</span>
              <kbd className="ml-auto rounded border border-[#27272A] bg-[#1C1C1F] px-1.5 py-0.5 text-[10px] text-[#A1A1AA] font-mono">
                {formatShortcut("K")}
              </kbd>
            </button>
          ) : (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
                title={`Search (${formatShortcut("K")})`}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Horizontal Quick-Nav Bar (Home, Inbox, Calendar, Email) */}
          {!isCompact && (
            <div className="flex items-center gap-1 pt-1">
              {topNavItems.map((item) => {
                const Icon = item.icon;
                const isInboxItem = item.id === "inbox";
                const isActive = item.isActive;

                const content = (
                  <>
                    <Icon
                      className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "h-4 w-4 text-[#FFFFFF]" : "h-4 w-4 text-[#71717A] group-hover:text-[#FAFAFA]"
                      )}
                    />
                    {isActive && (
                      <span className="text-xs font-semibold truncate max-w-[75px] leading-none text-[#FFFFFF]">
                        {item.name}
                      </span>
                    )}
                    {item.hasBadge && !isActive && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-[#09090B]" />
                    )}
                    {item.hasBadge && isActive && (
                      <span className="ml-1 flex items-center justify-center h-3.5 min-w-3.5 px-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-semibold border border-blue-500/30">
                        {item.badge}
                      </span>
                    )}
                  </>
                );

                const itemClassName = cn(
                  "group relative flex items-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 select-none",
                  isActive
                    ? "h-8 gap-1.5 rounded-lg bg-[#202024] px-2.5 text-xs font-semibold text-[#FFFFFF] border border-[#2E2E34]/50 shadow-2xs"
                    : "h-8 w-8 items-center justify-center rounded-lg text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]"
                );

                return isInboxItem ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={openInbox}
                    className={itemClassName}
                    title={item.name}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={false}
                    onClick={(e) => handleNavClick(item.href, e)}
                    className={itemClassName}
                    title={item.name}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-2.5 my-1 border-t border-[#1E1E22]" />

        {/* ========================================================= */}
        {/* Navigation List: Unified Vertical List with Dropdowns      */}
        {/* ========================================================= */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-1.5 overscroll-contain overflow-x-hidden no-scrollbar">
          {/* ================= COMPACT MODE (Icon-Rail) ============= */}
          {isCompact ? (
            <div className="flex flex-col items-center gap-1">
              {/* 1. Top items: Home, Inbox, Calendar, Email */}
              {topNavItems.map((item) => renderCompactNavItem(item))}

              <div className="w-6 border-t border-[#1E1E22] my-1" />

              {/* 2. Work in compact mode */}
              {renderCompactGroup(dropdownGroups[0])}

              {/* 3. Pages in compact mode */}
              <div className="relative">
                <Link
                  href="/dashboard/pages"
                  prefetch={false}
                  onClick={(e) => handleNavClick("/dashboard/pages", e)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600",
                    effectivePath.startsWith("/dashboard/pages")
                      ? "bg-[#202024] text-[#FFFFFF] border border-[#2E2E34]/50 shadow-2xs"
                      : "text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]"
                  )}
                  title="Pages"
                >
                  <PhosphorBookOpen className="h-5 w-5" />
                </Link>
              </div>

              {/* 4. Brain in compact mode */}
              {renderCompactGroup(dropdownGroups[1])}

              {/* 5. Organization in compact mode */}
              {renderCompactGroup(dropdownGroups[2])}

              {/* Expand button at bottom of compact rail */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-colors mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600"
                title="Expand sidebar (Ctrl+\)"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* ================= EXPANDED MODE (Vertical List) ============= */
            <div className="space-y-2.5">
              {/* 1. Work Section (Expandable with subitems) */}
              <div className="space-y-0.5">
                {renderGroupToggle("work", "Work", PhosphorFolder, isGroupExpanded("work"), workItems.some((i) => i.isActive))}

                {isGroupExpanded("work") && (
                  <div className="ml-2 space-y-0.5 pt-0.5 my-0.5 animate-in fade-in duration-150">
                    {workItems.map((item) => renderNavItem(item, true))}
                  </div>
                )}
              </div>

              {/* 2. Pages Section (Expandable Tree) */}
              {activeOrg && (
                <div className="space-y-0.5" data-tour="knowledge-tree">
                  {renderGroupToggle("pages", "Pages", PhosphorBookOpen, isGroupExpanded("pages"), effectivePath.startsWith("/dashboard/pages"))}

                  {isGroupExpanded("pages") && (
                    <div className="ml-2 pt-0.5 my-0.5 animate-in fade-in duration-150">
                      <SidebarPageTree
                        initialPages={pageTree}
                        favoritePages={favoritePages}
                        archivedPages={archivedPages}
                        organizationId={activeOrg.id}
                        demoMode={demoMode}
                        onDemoNavigate={onDemoNavigate}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. Brain Section (Expandable - NO AI BADGE) */}
              <div className="space-y-0.5">
                {renderGroupToggle("brain", "Brain", PhosphorBrain, isGroupExpanded("brain"), brainItems.some((i) => i.isActive))}

                {isGroupExpanded("brain") && (
                  <div className="ml-2 space-y-0.5 pt-0.5 my-0.5 animate-in fade-in duration-150">
                    {brainItems.map((item) => renderNavItem(item, true))}
                  </div>
                )}
              </div>

              {/* 4. Organization Section (Expandable) */}
              <div className="space-y-0.5">
                {renderGroupToggle("company", "Organization", PhosphorUserList, isGroupExpanded("company"), organizationItems.some((i) => i.isActive))}

                {isGroupExpanded("company") && (
                  <div className="ml-2 space-y-0.5 pt-0.5 my-0.5 animate-in fade-in duration-150">
                    {organizationItems.map((item) => renderNavItem(item, true))}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* ========================================================= */}
        {/* Bottom User Profile & Workspace Menu (Reference Image 2)  */}
        {/* ========================================================= */}
        <div className="mt-auto p-2 border-t border-[#1E1E22] bg-[#09090A] shrink-0">
          <AccountMenu
            user={user}
            organizations={organizations}
            activeOrg={activeOrg}
            entitlement={entitlement}
            demoMode={demoMode}
          />
        </div>

        {/* Global Quick Search Modal Window */}
        {activeOrg && (
          <SearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            organizationId={activeOrg.id}
          />
        )}
      </aside>
    </>
  );
}
