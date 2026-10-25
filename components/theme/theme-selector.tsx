"use client";

import * as React from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme, ThemeMode } from "./theme-provider";
import { useLanguage } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Minimalist Icon-Only Theme Switch (Moon / Sun)
 *
 * Clean, subtle, almost transparent switch.
 * No visible text. Automatically initializes from system preference,
 * and toggles seamlessly between Light and Dark on click.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  const handleToggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "group relative flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] hover:text-[#18181B] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 select-none",
        className
      )}
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 text-[#A1A1AA] group-hover:text-amber-300" />
      ) : (
        <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45 text-[#71717A] group-hover:text-amber-500" />
      )}
    </button>
  );
}

export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  const options: Array<{ mode: ThemeMode; label: string; icon: typeof Monitor }> = [
    {
      mode: "system",
      label: t.settings.preferences.themeSystem || "Automatic",
      icon: Monitor,
    },
    {
      mode: "light",
      label: t.settings.preferences.themeLight || "Light",
      icon: Sun,
    },
    {
      mode: "dark",
      label: t.settings.preferences.themeDark || "Dark",
      icon: Moon,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#F4F3EE] dark:bg-[#121215] p-0.5 text-xs",
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.mode;

        return (
          <button
            key={opt.mode}
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.mode)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSelected
                ? "bg-white dark:bg-[#1B1B20] text-[#18181B] dark:text-[#F4F4F5] shadow-xs"
                : "text-[#71717A] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F4F4F5]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
