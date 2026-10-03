"use client";

import { useSettings } from "./settings-context";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useLanguage } from "@/lib/i18n";
import { Sliders } from "lucide-react";

export function OpenSettingsButton() {
  const { openSettings } = useSettings();
  const { modKey } = usePlatform();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => openSettings("preferences")}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-[#27272a] bg-zinc-100 dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-[#27272a] hover:text-zinc-900 dark:hover:text-white transition-colors"
    >
      <Sliders className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
      <span>{t.settingsPage.openPreferences} ({modKey} ,)</span>
    </button>
  );
}
