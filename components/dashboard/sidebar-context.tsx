"use client";

import * as React from "react";
import { PanelLeftOpen } from "lucide-react";

interface SidebarContextValue {
  isCollapsed: boolean;
  isCompact: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  expandedGroups: Record<string, boolean>;
  toggleGroup: (group: string) => void;
  isGroupExpanded: (group: string) => boolean;
}

export const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCompact, setIsCompact] = React.useState(false);
  const [isMobileOpen, setMobileOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({
    work: true,
    pages: true,
    brain: true,
    company: true,
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("cb_sidebar_compact");
      if (stored !== null) {
        setIsCompact(stored === "true");
      } else {
        const legacyStored = localStorage.getItem("cb_sidebar_collapsed");
        if (legacyStored !== null) {
          setIsCompact(legacyStored === "true");
        }
      }

      const storedGroups = localStorage.getItem("cb_sidebar_groups");
      if (storedGroups) {
        const parsed = JSON.parse(storedGroups);
        if (parsed && typeof parsed === "object") {
          setExpandedGroups((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {}
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cb_sidebar_compact", String(next));
        localStorage.setItem("cb_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const openSidebar = React.useCallback(() => {
    setIsCompact(false);
    try {
      localStorage.setItem("cb_sidebar_compact", "false");
      localStorage.setItem("cb_sidebar_collapsed", "false");
    } catch {}
  }, []);

  const closeSidebar = React.useCallback(() => {
    setIsCompact(true);
    try {
      localStorage.setItem("cb_sidebar_compact", "true");
      localStorage.setItem("cb_sidebar_collapsed", "true");
    } catch {}
  }, []);

  const toggleMobileSidebar = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobileSidebar = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleGroup = React.useCallback((group: string) => {
    setExpandedGroups((prev) => {
      const current = prev[group] !== false; // default true
      const next = { ...prev, [group]: !current };
      try {
        localStorage.setItem("cb_sidebar_groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isGroupExpanded = React.useCallback(
    (group: string) => {
      return expandedGroups[group] !== false;
    },
    [expandedGroups]
  );

  // Global Ctrl+\ or Cmd+\ shortcut to toggle sidebar
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed: isCompact,
        isCompact,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        isMobileOpen,
        setMobileOpen,
        toggleMobileSidebar,
        closeMobileSidebar,
        expandedGroups,
        toggleGroup,
        isGroupExpanded,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

/**
 * Mobile sidebar trigger button
 */
export function SidebarTrigger() {
  const { toggleMobileSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar-trigger="true"
      onClick={toggleMobileSidebar}
      className="md:hidden fixed top-3 left-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-[#242427] bg-[#141415]/90 backdrop-blur shadow-sm text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-all duration-150"
      title="Toggle sidebar"
      aria-label="Toggle navigation menu"
    >
      <PanelLeftOpen className="h-4 w-4" />
    </button>
  );
}
