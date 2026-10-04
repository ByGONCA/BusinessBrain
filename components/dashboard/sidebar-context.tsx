"use client";

import * as React from "react";
import { PanelLeftOpen } from "lucide-react";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("cb_sidebar_collapsed");
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    } catch {}
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cb_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const openSidebar = React.useCallback(() => {
    setIsCollapsed(false);
    try {
      localStorage.setItem("cb_sidebar_collapsed", "false");
    } catch {}
  }, []);

  const closeSidebar = React.useCallback(() => {
    setIsCollapsed(true);
    try {
      localStorage.setItem("cb_sidebar_collapsed", "true");
    } catch {}
  }, []);

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
        isCollapsed,
        toggleSidebar,
        openSidebar,
        closeSidebar,
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
 * Re-open button shown when sidebar is collapsed
 */
export function SidebarTrigger() {
  const { isCollapsed, openSidebar } = useSidebar();

  if (!isCollapsed) return null;

  return (
    <button
      type="button"
      data-sidebar-trigger="true"
      onClick={openSidebar}
      className="fixed top-3 left-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 animate-in fade-in"
      title="Abrir barra lateral (Ctrl+\)"
    >
      <PanelLeftOpen className="h-4 w-4" />
    </button>
  );
}
