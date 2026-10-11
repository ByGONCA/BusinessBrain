"use client";

import * as React from "react";
import { Sliders, Check, Loader2, Sparkles, Layout, Clock, Eye, ShieldCheck } from "lucide-react";
import { updateUserPreferencesAction, getUserProfileAction } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

export interface UserPreferencesState {
  openLastVisitedPage: boolean;
  confirmBeforeDelete: boolean;
  compactMode: boolean;
  showShortcuts: boolean;
  reduceMotion: boolean;
  defaultEditorWidth: "standard" | "full" | "narrow";
  defaultPageLayout: "standard" | "wide";
  workingHoursStart: string;
  workingHoursEnd: string;
  defaultMeetingDuration: number;
  defaultCalendarView: "day" | "week" | "month";
}

const DEFAULT_PREFERENCES: UserPreferencesState = {
  openLastVisitedPage: true,
  confirmBeforeDelete: true,
  compactMode: false,
  showShortcuts: true,
  reduceMotion: false,
  defaultEditorWidth: "standard",
  defaultPageLayout: "standard",
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  defaultMeetingDuration: 30,
  defaultCalendarView: "month",
};

export function PreferencesTab() {
  const [prefs, setPrefs] = React.useState<UserPreferencesState>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ success?: boolean; message?: string } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    getUserProfileAction().then((res) => {
      if (!mounted) return;
      if (res.success && res.profile?.user_preferences) {
        setPrefs((prev) => ({
          ...prev,
          ...(res.profile?.user_preferences as Partial<UserPreferencesState>),
        }));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = (key: keyof UserPreferencesState) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = <K extends keyof UserPreferencesState>(key: K, value: UserPreferencesState[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await updateUserPreferencesAction(prefs as unknown as Record<string, unknown>);
      if (res.success) {
        setStatusMessage({ success: true, message: "Workspace preferences saved." });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ success: false, message: res.error || "Failed to save preferences." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Personal Preferences</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Navigation & Safety */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Navigation & Safety
          </span>

          {/* Open last visited page */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Open last visited page on startup</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Resume directly where you left off</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("openLastVisitedPage")}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                prefs.openLastVisitedPage ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                  prefs.openLastVisitedPage ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Confirm before delete */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Confirm before deletion</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Show confirmation modal before trashing items</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("confirmBeforeDelete")}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                prefs.confirmBeforeDelete ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                  prefs.confirmBeforeDelete ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Keyboard shortcut hints */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Show keyboard shortcut hints</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Display modifier badges in buttons and menus</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("showShortcuts")}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                prefs.showShortcuts ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                  prefs.showShortcuts ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Reduce motion */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Reduce Motion</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Minimize animations and smooth scrolling transitions</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("reduceMotion")}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                prefs.reduceMotion ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                  prefs.reduceMotion ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Editor & Layout Defaults */}
        <div className="space-y-3 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Editor & Document Layout
          </span>

          {/* Default Editor Width */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Editor Width</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Content canvas width for documents</p>
            </div>
            <select
              value={prefs.defaultEditorWidth}
              onChange={(e) => handleChange("defaultEditorWidth", e.target.value as "standard" | "full" | "narrow")}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              <option value="standard">Standard (720px)</option>
              <option value="full">Full Width</option>
              <option value="narrow">Narrow (600px)</option>
            </select>
          </div>
        </div>

        {/* Calendar & Working Hours */}
        <div className="space-y-3 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Calendar & Working Hours
          </span>

          {/* Working Hours */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Working Hours</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Primary focus availability for meetings</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={prefs.workingHoursStart}
                onChange={(e) => handleChange("workingHoursStart", e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2 py-1 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="time"
                value={prefs.workingHoursEnd}
                onChange={(e) => handleChange("workingHoursEnd", e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2 py-1 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Default Meeting Duration */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Meeting Duration</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Initial length when scheduling new events</p>
            </div>
            <select
              value={prefs.defaultMeetingDuration}
              onChange={(e) => handleChange("defaultMeetingDuration", Number(e.target.value))}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            {statusMessage && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  statusMessage.success
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                }`}
              >
                {statusMessage.success && <Check className="h-3.5 w-3.5" />}
                {statusMessage.message}
              </span>
            )}
          </span>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
