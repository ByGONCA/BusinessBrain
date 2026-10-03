"use client";

import * as React from "react";
import { Locale, Dictionary, LocaleOption } from "./types";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { pt } from "./dictionaries/pt";

export const DEFAULT_LOCALE: Locale = "en";

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "en", label: "English (US)", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
];

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  es,
  fr,
  pt,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  interpolate: (text: string, params: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  // Initialize saved locale from localStorage
  React.useEffect(() => {
    try {
      const savedLocale = localStorage.getItem("cb_locale") as Locale | null;
      if (
        savedLocale &&
        (savedLocale === "en" || savedLocale === "es" || savedLocale === "fr" || savedLocale === "pt")
      ) {
        setLocaleState(savedLocale);
        document.documentElement.lang = savedLocale;
      } else {
        document.documentElement.lang = DEFAULT_LOCALE;
      }
    } catch {}
  }, []);

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("cb_locale", newLocale);
      document.documentElement.lang = newLocale;
    } catch {}
  }, []);

  const t = React.useMemo(() => getDictionary(locale), [locale]);

  const interpolate = React.useCallback(
    (text: string, params: Record<string, string | number>): string => {
      let result = text;
      for (const [key, value] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
      }
      return result;
    },
    []
  );

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t,
        interpolate,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
