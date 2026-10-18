import React from "react";
import ReactDOMServer from "react-dom/server";
import { Sidebar } from "../components/dashboard/sidebar";
import { SidebarProvider } from "../components/dashboard/sidebar-context";
import { InboxProvider } from "../components/dashboard/inbox/inbox-context";
import { LanguageProvider } from "../lib/i18n";

// Mock next/navigation
jestMockNavigation();

function jestMockNavigation() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nextNav = require("next/navigation");
  try {
    Object.defineProperty(nextNav, "usePathname", {
      value: () => "/dashboard",
      configurable: true,
      writable: true,
    });
    Object.defineProperty(nextNav, "useRouter", {
      value: () => ({ push: () => {}, replace: () => {} }),
      configurable: true,
      writable: true,
    });
  } catch {
    // fallback if non-configurable
  }
}

import { SidePeekProvider } from "../components/dashboard/pages/side-peek-context";
import { SettingsProvider } from "../components/dashboard/settings/settings-context";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PathnameContext } = require("next/dist/shared/lib/hooks-client-context.shared-runtime");

function testSidebar() {
  console.log("=== Testing Sidebar Redesign Render ===");

  const user = {
    id: "usr_123",
    email: "test@example.com",
    user_metadata: { full_name: "Test User" },
  };

  const org = {
    id: "org_123",
    name: "Acme Corp",
    slug: "acme",
    role: "owner" as const,
    created_at: new Date().toISOString(),
    created_by: "usr_123",
    status: "active" as const,
    updated_at: new Date().toISOString(),
  };

  const mockRouter = {
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  };

  const html = ReactDOMServer.renderToString(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter },
      React.createElement(
        PathnameContext.Provider,
        { value: "/dashboard" },
        React.createElement(
          SidePeekProvider,
          null,
          React.createElement(
            SettingsProvider,
            null,
            React.createElement(
              LanguageProvider,
              null,
              React.createElement(
                SidebarProvider,
                null,
                React.createElement(
                  InboxProvider,
                  null,
                  React.createElement(Sidebar, {
                    user,
                    organizations: [org],
                    activeOrg: org,
                    entitlement: null,
                    pageTree: [],
                  })
                )
              )
            )
          )
        )
      )
    )
  );

  const hasHome = html.includes('title="Home"');
  const hasInbox = html.includes('title="Inbox"');
  const hasCalendar = html.includes('title="Calendar"');
  const hasEmail = html.includes('title="Email"');
  console.log("Top nav items present:", hasHome && hasInbox && hasCalendar && hasEmail ? "PASS" : "FAIL");

  // 2. Verify order: Home appears before Inbox, Inbox appears before Calendar, Calendar appears before Email
  const homeIdx = html.indexOf('href="/dashboard"');
  const inboxIdx = html.indexOf('title="Inbox"');
  const calendarIdx = html.indexOf('href="/dashboard/calendar"');
  const emailIdx = html.indexOf('href="/dashboard/email"');
  const isOrderCorrect = homeIdx < inboxIdx && inboxIdx < calendarIdx && calendarIdx < emailIdx;
  console.log("Order: Home -> Inbox -> Calendar -> Email:", isOrderCorrect ? "PASS" : "FAIL");

  // 3. Verify horizontal quick-nav bar exists
  const hasHorizontalBar = html.includes("flex items-center gap-1 pt-1");
  console.log("Horizontal quick-nav bar present:", hasHorizontalBar ? "PASS" : "FAIL");

  // 4. Verify only the active page displays text label, and inactive items display icon-only
  // At /dashboard, Home is active -> shows text "Home". Calendar and Email are inactive -> do not render text label span
  const homeHasTextSpan = html.includes('>Home</span>');
  const calendarHasTextSpan = html.includes('>Calendar</span>');
  const emailHasTextSpan = html.includes('>Email</span>');
  console.log("Active page (Home) renders text label:", homeHasTextSpan ? "PASS" : "FAIL");
  console.log("Inactive items do NOT render text label (icon-only):", !calendarHasTextSpan && !emailHasTextSpan ? "PASS" : "FAIL");

  // 5. Verify Work is NOT uppercase WORK
  const hasAllCapsWork = html.includes(">WORK<") || html.includes('="WORK"');
  const hasNormalWork = html.includes("Work");
  console.log("Work capitalization normal (not 'WORK'):", !hasAllCapsWork && hasNormalWork ? "PASS" : "FAIL");

  // 6. Verify Brain has NO AI badge
  const hasAIBadge = html.includes('>AI</span>') || html.includes('>AI Brain<');
  console.log("Brain has NO 'AI' badge:", !hasAIBadge ? "PASS" : "FAIL");

  // 7. Verify Pages and Organization exist
  const hasPages = html.includes("Pages");
  const hasOrg = html.includes("Organization");
  console.log("Pages and Organization present:", hasPages && hasOrg ? "PASS" : "FAIL");

  // 8. Verify AccountMenu workspace selector exists in footer
  const hasAcme = html.includes("Acme Corp");
  console.log("Workspace selector / AccountMenu present:", hasAcme ? "PASS" : "FAIL");

  // 9. Verify Redesigned Typography and Reference-Matching Target Dimensions
  const hasSidebarWidth = html.includes("md:w-60");
  const hasMainItemHeight = html.includes("h-[36px]");
  const hasSubitemHeight = html.includes("h-[32px]");
  const hasMainItemFont = html.includes("text-[13.5px]");
  const hasSubitemFont = html.includes("text-[13px]");
  const hasMainIconSize = html.includes("h-[17px] w-[17px]");
  const hasSearchHeight = html.includes("h-9");
  const hasAccountHeight = html.includes("h-[38px] px-2");

  console.log("Sidebar width md:w-60 (240px):", hasSidebarWidth ? "PASS" : "FAIL");
  console.log("Main item height h-[36px] (34-38px range):", hasMainItemHeight ? "PASS" : "FAIL");
  console.log("Subitem height h-[32px] (30-34px range):", hasSubitemHeight ? "PASS" : "FAIL");
  console.log("Main item typography text-[13.5px] (13-14px range):", hasMainItemFont ? "PASS" : "FAIL");
  console.log("Subitem typography text-[13px] (13px range):", hasSubitemFont ? "PASS" : "FAIL");
  console.log("Main icon size h-[17px] w-[17px] (16-18px range):", hasMainIconSize ? "PASS" : "FAIL");
  console.log("Search bar height h-9 (36px):", hasSearchHeight ? "PASS" : "FAIL");
  console.log("Account menu button height h-[38px]:", hasAccountHeight ? "PASS" : "FAIL");

  // 10. Verify top logo in expanded mode links to landing page ("/")
  const hasLandingPageLink = html.includes('href="/"');
  console.log("Top logo links to landing page ('/'):", hasLandingPageLink ? "PASS" : "FAIL");

  const allChecks = [
    hasHome, hasInbox, hasCalendar, hasEmail,
    isOrderCorrect, hasHorizontalBar, homeHasTextSpan,
    !calendarHasTextSpan, !emailHasTextSpan, !hasAllCapsWork,
    hasNormalWork, !hasAIBadge, hasPages, hasOrg, hasAcme,
    hasSidebarWidth, hasMainItemHeight, hasSubitemHeight, hasMainItemFont,
    hasSubitemFont, hasMainIconSize, hasSearchHeight, hasAccountHeight,
    hasLandingPageLink,
  ];

  if (allChecks.some((c) => !c)) {
    console.error("Some expanded sidebar assertions failed!");
    process.exit(1);
  }

  // 11. Test Collapsed/Compact Mode Sidebar
  console.log("=== Testing Collapsed Sidebar Mode ===");
  const mockCompactContext = {
    isCollapsed: true,
    isCompact: true,
    toggleSidebar: () => {},
    openSidebar: () => {},
    closeSidebar: () => {},
    isMobileOpen: false,
    setMobileOpen: () => {},
    toggleMobileSidebar: () => {},
    closeMobileSidebar: () => {},
    expandedGroups: { work: true, pages: true, brain: true, company: true },
    toggleGroup: () => {},
    isGroupExpanded: () => true,
  };

  const { SidebarContext } = require("../components/dashboard/sidebar-context");

  const compactHtml = ReactDOMServer.renderToString(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter },
      React.createElement(
        PathnameContext.Provider,
        { value: "/dashboard" },
        React.createElement(
          SidePeekProvider,
          null,
          React.createElement(
            SettingsProvider,
            null,
            React.createElement(
              LanguageProvider,
              null,
              React.createElement(
                SidebarContext.Provider,
                { value: mockCompactContext },
                React.createElement(
                  InboxProvider,
                  null,
                  React.createElement(Sidebar, {
                    user,
                    organizations: [org],
                    activeOrg: org,
                    entitlement: null,
                    pageTree: [],
                  })
                )
              )
            )
          )
        )
      )
    )
  );

  const hasCompactExpandButton = compactHtml.includes('aria-label="Expand sidebar"');
  const hasNoCollapseButton = !compactHtml.includes('aria-label="Collapse sidebar"');
  console.log("Compact mode has top expand button:", hasCompactExpandButton ? "PASS" : "FAIL");
  console.log("Compact mode does NOT have collapse button (no squeezing bug):", hasNoCollapseButton ? "PASS" : "FAIL");

  if (!hasCompactExpandButton || !hasNoCollapseButton) {
    console.error("Compact sidebar assertions failed!");
    process.exit(1);
  }

  console.log("=== All Sidebar Assertions Passed ===");
}

testSidebar();
