"use client";

import * as React from "react";
import { User, Mail, Phone, Calendar, Globe, Clock, Check, Loader2, Sparkles } from "lucide-react";
import { updateUserProfileInfoAction, getUserProfileAction } from "@/lib/settings/actions";
import { useLanguage, SUPPORTED_LOCALES, Locale } from "@/lib/i18n";

interface ProfileTabProps {
  user: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      [key: string]: unknown;
    };
  };
}

const POPULAR_TIMEZONES = [
  { value: "Europe/Lisbon", label: "Europe/Lisbon (WET / WEST) - Default" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET / CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET / CEST)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET / CEST)" },
  { value: "America/New_York", label: "America/New York (Eastern Time)" },
  { value: "America/Chicago", label: "America/Chicago (Central Time)" },
  { value: "America/Denver", label: "America/Denver (Mountain Time)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (Pacific Time)" },
  { value: "America/Sao_Paulo", label: "America/São Paulo (BRT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)" },
];

export function ProfileTab({ user }: ProfileTabProps) {
  const { locale, setLocale } = useLanguage();

  const [fullName, setFullName] = React.useState(
    user.user_metadata?.full_name || user.user_metadata?.name || ""
  );
  const [avatarUrl, setAvatarUrl] = React.useState(user.user_metadata?.avatar_url || "");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [dateFormat, setDateFormat] = React.useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = React.useState("24h");
  const [timezone, setTimezone] = React.useState("Europe/Lisbon");
  const [firstDayOfWeek, setFirstDayOfWeek] = React.useState<"monday" | "sunday">("monday");

  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ success?: boolean; message?: string } | null>(null);

  // Load existing profile fields
  React.useEffect(() => {
    let mounted = true;
    getUserProfileAction().then((res) => {
      if (!mounted) return;
      setIsLoadingProfile(false);
      if (res.success && res.profile) {
        const p = res.profile;
        if (p.full_name) setFullName(p.full_name as string);
        if (p.avatar_url) setAvatarUrl(p.avatar_url as string);
        if (p.phone_number) setPhoneNumber(p.phone_number as string);
        if (p.date_format) setDateFormat(p.date_format as string);
        if (p.time_format) setTimeFormat(p.time_format as string);
        if (p.timezone) setTimezone(p.timezone as string);
        if (p.first_day_of_week) setFirstDayOfWeek(p.first_day_of_week as "monday" | "sunday");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await updateUserProfileInfoAction({
        fullName,
        avatarUrl,
        phoneNumber,
        dateFormat,
        timeFormat,
        timezone,
        firstDayOfWeek,
        language: locale,
      });

      if (res.success) {
        setStatusMessage({ success: true, message: "Profile preferences saved successfully." });
        try {
          localStorage.setItem("cb_timezone", timezone);
          localStorage.setItem("cb_first_day_of_week", firstDayOfWeek);
        } catch {}
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({ success: false, message: res.error || "Failed to update profile." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const accountCreated = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Unknown";

  const userInitial = (fullName || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Account Profile</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile Avatar & Identity Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || "User"}
                className="h-14 w-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-xs"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-xs">
                {userInitial}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {fullName || "User"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            <p className="text-[10px] text-zinc-400 font-mono">
              Member since {accountCreated}
            </p>
          </div>
        </div>

        {/* Basic Personal Information */}
        <div className="space-y-3 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Personal Information
          </span>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Avatar URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Profile Photo URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[10px] text-zinc-500">
              Provide a direct image URL (PNG, JPG, or SVG) or leave empty for initials avatar.
            </p>
          </div>

          {/* Email Address (Read-only notice, changed in Security) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email Address</label>
              <span className="text-[10px] text-zinc-400">Change in Security tab</span>
            </div>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed select-none"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Phone Number (Optional)</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +351 912 345 678"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Regional & Localization Defaults */}
        <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Regional Defaults
          </span>

          {/* Language */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Display Language</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Application interface localization</p>
            </div>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.nativeLabel} ({loc.code.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Time Zone */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Time Zone</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Used for meeting times, calendar, and task scheduling</p>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs max-w-[220px]"
            >
              {POPULAR_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Format */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Date Format</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Display format for dates across the workspace</p>
            </div>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (Default)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>

          {/* Time Format */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Time Format</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">12-hour or 24-hour clock</p>
            </div>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setTimeFormat("24h")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  timeFormat === "24h"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                24-Hour (14:30)
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("12h")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  timeFormat === "12h"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                12-Hour (2:30 PM)
              </button>
            </div>
          </div>

          {/* First Day of Week */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">First Day of Week</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Start column in calendars and datepickers</p>
            </div>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setFirstDayOfWeek("monday")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  firstDayOfWeek === "monday"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Monday (Default)
              </button>
              <button
                type="button"
                onClick={() => setFirstDayOfWeek("sunday")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  firstDayOfWeek === "sunday"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Sunday
              </button>
            </div>
          </div>
        </div>

        {/* Submit Button & Feedback */}
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
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
