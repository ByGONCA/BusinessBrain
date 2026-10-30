"use client";

import * as React from "react";

export type SettingsTab =
  | "profile"
  | "security"
  | "preferences"
  | "appearance"
  | "notifications"
  | "workspace"
  | "people"
  | "permissions"
  | "integrations"
  | "defaults"
  | "privacy"
  | "audit_log"
  | "storage"
  | "billing"
  | "ai_providers";

interface SettingsContextValue {
  isOpen: boolean;
  activeTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function normalizeSettingsTab(param: string | null): SettingsTab | null {
  if (!param) return null;
  const p = param.toLowerCase().trim();
  if (p === "general") return "workspace";
  if (p === "audit" || p === "audit-log") return "audit_log";
  if (p === "billing-usage" || p === "plans") return "billing";
  if (p === "members" || p === "teams") return "people";
  if (p === "roles") return "permissions";
  const validTabs: SettingsTab[] = [
    "profile",
    "security",
    "preferences",
    "appearance",
    "notifications",
    "workspace",
    "people",
    "permissions",
    "integrations",
    "defaults",
    "privacy",
    "audit_log",
    "storage",
    "billing",
    "ai_providers",
  ];
  return validTabs.includes(p as SettingsTab) ? (p as SettingsTab) : null;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("preferences");

  const openSettings = React.useCallback((tab?: SettingsTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = React.useCallback(() => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("tab") || url.searchParams.has("settings")) {
        url.searchParams.delete("tab");
        url.searchParams.delete("settings");
        const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, []);

  // Global keyboard shortcut: Cmd+, or Ctrl+, to open settings
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        if (isOpen) {
          closeSettings();
        } else {
          openSettings();
        }
      }
      if (e.key === "Escape" && isOpen) {
        closeSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSettings, openSettings]);

  // Check URL query parameters (e.g. ?tab=integrations or ?settings=integrations)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") || params.get("settings");
    if (!tabParam) return;

    const normalized = normalizeSettingsTab(tabParam);
    if (normalized) {
      openSettings(normalized);
    }
  }, [openSettings]);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        activeTab,
        openSettings,
        closeSettings,
        setActiveTab,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
