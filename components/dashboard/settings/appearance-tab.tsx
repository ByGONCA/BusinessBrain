"use client";

import * as React from "react";
import { Sun, Moon, Monitor, RotateCcw, Check, Type, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import {
  useTypography,
  parsePxNumber,
  formatPxValue,
} from "@/components/theme/typography-provider";
import { updateTypographySettingsAction } from "@/lib/settings/actions";

interface PixelInputRowProps {
  label: string;
  description: string;
  value: string;
  fallback: number;
  min?: number;
  max?: number;
  onChange: (val: string) => void;
}

function PixelInputRow({
  label,
  description,
  value,
  fallback,
  min = 8,
  max = 96,
  onChange,
}: PixelInputRowProps) {
  const numValue = parsePxNumber(value, fallback);
  const [localInput, setLocalInput] = React.useState(String(numValue));

  React.useEffect(() => {
    setLocalInput(String(parsePxNumber(value, fallback)));
  }, [value, fallback]);

  const commitValue = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(formatPxValue(clamped, fallback));
      setLocalInput(String(clamped));
    } else {
      setLocalInput(String(numValue));
    }
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-zinc-800">
      <div>
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(formatPxValue(Math.max(min, numValue - 1), fallback))}
          className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer select-none"
          title="Decrease by 1px"
        >
          -
        </button>

        <div className="relative flex items-center">
          <input
            type="text"
            inputMode="numeric"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onBlur={() => commitValue(localInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitValue(localInput);
              }
            }}
            aria-label={`${label} in pixels`}
            placeholder={String(fallback)}
            className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2 py-1 pr-6 text-xs text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors shadow-2xs"
          />
          <span className="absolute right-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">
            px
          </span>
        </div>

        <button
          type="button"
          onClick={() => onChange(formatPxValue(Math.min(max, numValue + 1), fallback))}
          className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer select-none"
          title="Increase by 1px"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function AppearanceTab() {
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { settings, updateSettings, resetSettings } = useTypography();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleTypographyChange = (key: keyof typeof settings, val: string) => {
    updateSettings({ [key]: val });
  };

  const handleSaveToProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await updateTypographySettingsAction(settings);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Appearance & Display</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
          Customize how Company Brain looks and feels, including interface themes, accessibility, and customizable typography sizing.
        </p>
      </div>

      {/* Visual Theme Mode Cards */}
      <div className="space-y-3 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Interface Theme
        </span>

        <div className="grid grid-cols-3 gap-3">
          {/* Light Theme */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-all cursor-pointer",
              theme === "light"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
          >
            <div className="flex h-10 w-full items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200/80 shadow-2xs">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">Light</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Clean bright canvas</p>
            </div>
            {theme === "light" && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>

          {/* Dark Theme */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-all cursor-pointer",
              theme === "dark"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
          >
            <div className="flex h-10 w-full items-center justify-center rounded-lg bg-[#141416] border border-zinc-800 shadow-2xs">
              <Moon className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">Dark</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">High focus dark mode</p>
            </div>
            {theme === "dark" && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>

          {/* System Theme */}
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-all cursor-pointer",
              theme === "system"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
          >
            <div className="flex h-10 w-full items-center justify-center rounded-lg bg-zinc-200/50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
              <Monitor className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">System</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Follows OS theme</p>
            </div>
            {theme === "system" && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* High Contrast Mode */}
      <div className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">High Contrast Mode</p>
            <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
              ACCESSIBILITY
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Increases visual boundary borders and element contrast ratios.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setContrast(contrast === "high" ? "standard" : "high")}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
            contrast === "high" ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
              contrast === "high" ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* ========================================================= */}
      {/* ADVANCED TYPOGRAPHY SECTION (CUSTOMIZABLE PIXELS)         */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Advanced Typography & Sizing
            </h3>
          </div>
          <button
            type="button"
            onClick={resetSettings}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Reset typography to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Set custom pixel dimensions for page paragraphs and header scales. Type your exact preferred pixel value or use the adjusters.
        </p>

        {/* Base Font Size */}
        <PixelInputRow
          label="Base Reading Font Size"
          description="Default body paragraph and document text size"
          value={settings.baseFontSize}
          fallback={16}
          min={10}
          max={32}
          onChange={(val) => handleTypographyChange("baseFontSize", val)}
        />

        {/* H1 Heading Size */}
        <PixelInputRow
          label="Heading 1 (H1) Size"
          description="Top-level page titles and prominent headers"
          value={settings.h1Size}
          fallback={32}
          min={18}
          max={72}
          onChange={(val) => handleTypographyChange("h1Size", val)}
        />

        {/* H2 Heading Size */}
        <PixelInputRow
          label="Heading 2 (H2) Size"
          description="Major section headings and milestone dividers"
          value={settings.h2Size}
          fallback={24}
          min={14}
          max={54}
          onChange={(val) => handleTypographyChange("h2Size", val)}
        />

        {/* H3 Heading Size */}
        <PixelInputRow
          label="Heading 3 (H3) Size"
          description="Sub-section headers and card group labels"
          value={settings.h3Size}
          fallback={20}
          min={12}
          max={42}
          onChange={(val) => handleTypographyChange("h3Size", val)}
        />

        {/* Interactive Live Typography Preview */}
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Live Typography Preview
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {settings.baseFontSize} &bull; {settings.h1Size} &bull; {settings.h2Size} &bull; {settings.h3Size}
            </span>
          </div>
          <div className="space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-2.5 text-zinc-900 dark:text-zinc-100">
            <h1 style={{ fontSize: settings.h1Size }} className="font-bold leading-tight tracking-tight">
              Strategic Product Roadmap (H1)
            </h1>
            <h2 style={{ fontSize: settings.h2Size }} className="font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">
              Key Objectives & Deliverables (H2)
            </h2>
            <h3 style={{ fontSize: settings.h3Size }} className="font-medium text-zinc-700 dark:text-zinc-300 leading-snug">
              Phase 1 Execution Plan (H3)
            </h3>
            <p style={{ fontSize: settings.baseFontSize }} className="text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              Company Brain aggregates your team&apos;s knowledge, decisions, and documents into an actionable memory layer.
            </p>
          </div>
        </div>

        {/* Save to Profile Action */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            {saveSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved to your profile
              </span>
            ) : (
              "Settings apply in real time and persist to your account."
            )}
          </span>
          <button
            type="button"
            onClick={handleSaveToProfile}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
