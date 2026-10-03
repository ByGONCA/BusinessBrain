"use client";

import * as React from "react";

export type SettingsTab =
  | "profile"
  | "preferences"
  | "notifications"
  | "workspace"
  | "people"
  | "integrations"
  | "billing";

interface SettingsContextValue {
  isOpen: boolean;
  activeTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("preferences");

  const openSettings = React.useCallback((tab?: SettingsTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global keyboard shortcut: Cmd+, or Ctrl+, to open settings
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
