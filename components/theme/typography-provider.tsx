"use client";

import * as React from "react";

export interface TypographySettings {
  baseFontSize: string; // e.g. "16px"
  h1Size: string; // e.g. "32px"
  h2Size: string; // e.g. "24px"
  h3Size: string; // e.g. "20px"
}

export function parsePxNumber(val: string, fallback = 16): number {
  const match = val.match(/\d+(\.\d+)?/);
  if (!match) return fallback;
  const num = parseFloat(match[0]);
  return isNaN(num) ? fallback : Math.round(num);
}

export function formatPxValue(val: string | number, fallback = 16): string {
  if (typeof val === "number") {
    return `${Math.max(8, Math.min(120, Math.round(val)))}px`;
  }
  const parsed = parsePxNumber(val, fallback);
  return `${Math.max(8, Math.min(120, parsed))}px`;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  baseFontSize: "16px",
  h1Size: "32px",
  h2Size: "24px",
  h3Size: "20px",
};

interface TypographyContextValue {
  settings: TypographySettings;
  updateSettings: (newSettings: Partial<TypographySettings>) => void;
  resetSettings: () => void;
}

const TypographyContext = React.createContext<TypographyContextValue | null>(null);

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<TypographySettings>(DEFAULT_TYPOGRAPHY);

  // Load saved settings from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_typography_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  // Sync CSS custom variables to documentElement
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--cb-font-base", settings.baseFontSize);
    root.style.setProperty("--cb-h1-size", settings.h1Size);
    root.style.setProperty("--cb-h2-size", settings.h2Size);
    root.style.setProperty("--cb-h3-size", settings.h3Size);
  }, [settings]);

  const updateSettings = React.useCallback((newSettings: Partial<TypographySettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem("cb_typography_settings", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const resetSettings = React.useCallback(() => {
    setSettings(DEFAULT_TYPOGRAPHY);
    try {
      localStorage.setItem("cb_typography_settings", JSON.stringify(DEFAULT_TYPOGRAPHY));
    } catch {}
  }, []);

  return (
    <TypographyContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const context = React.useContext(TypographyContext);
  if (!context) {
    throw new Error("useTypography must be used within a TypographyProvider");
  }
  return context;
}
