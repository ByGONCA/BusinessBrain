"use client";

import * as React from "react";

export type ThemeMode = "system" | "dark" | "light";
export type ContrastMode = "system" | "standard" | "high";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  contrast: ContrastMode;
  setContrast: (contrast: ContrastMode) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>("system");
  const [contrast, setContrastState] = React.useState<ContrastMode>("system");
  const [systemIsDark, setSystemIsDark] = React.useState(true);

  // Initialize from localStorage
  React.useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("cb_theme_mode") as ThemeMode | null;
      if (savedTheme && (savedTheme === "system" || savedTheme === "dark" || savedTheme === "light")) {
        setThemeState(savedTheme);
      }
      const savedContrast = localStorage.getItem("cb_contrast_mode") as ContrastMode | null;
      if (savedContrast && (savedContrast === "system" || savedContrast === "standard" || savedContrast === "high")) {
        setContrastState(savedContrast);
      }
    } catch {}

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemIsDark(media.matches);

    const listener = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Mandatory dark theme as per redesign specification
  const resolvedTheme: "dark" | "light" = "dark";

  // Apply classes to documentElement
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    root.style.colorScheme = "dark";

    if (contrast === "high") {
      root.setAttribute("data-contrast", "high");
    } else {
      root.removeAttribute("data-contrast");
    }
  }, [resolvedTheme, contrast]);

  const setTheme = React.useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("cb_theme_mode", newTheme);
    } catch {}
  }, []);

  const setContrast = React.useCallback((newContrast: ContrastMode) => {
    setContrastState(newContrast);
    try {
      localStorage.setItem("cb_contrast_mode", newContrast);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        contrast,
        setContrast,
        resolvedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
