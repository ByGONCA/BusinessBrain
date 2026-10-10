"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  MapPin,
  Tag,
  Check,
  Search,
  ExternalLink,
  Users,
  CheckSquare,
  Target,
  FolderGit2,
  ChevronDown,
} from "lucide-react";
import { OrganizationIntegration } from "@/lib/integrations/types";
import { useLanguage } from "@/lib/i18n";
import { useSettings } from "@/components/dashboard/settings/settings-context";
import { cn } from "@/lib/utils";
import {
  CalendarEventItem,
  CreateCalendarEventInput,
  CALENDAR_COLOR_OPTIONS,
  CalendarEventColor,
  CalendarEntityType,
  getTagColorClasses,
} from "@/lib/calendar/types";
import {
  getOrganizationCalendarEventsAction,
  createCalendarEventAction,
  updateCalendarEventAction,
  deleteCalendarEventAction,
} from "@/lib/calendar/actions";
import { EventModal } from "./event-modal";

interface CalendarViewProps {
  integrations: OrganizationIntegration[];
}

const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);

export function CalendarView({ integrations }: CalendarViewProps) {
  const { t, locale } = useLanguage();
  const { openSettings } = useSettings();

  // Resolve active locale code for standard date formatting
  const localeCode = React.useMemo(() => {
    switch (locale) {
      case "pt":
        return "pt-PT";
      case "es":
        return "es-ES";
      case "fr":
        return "fr-FR";
      case "en":
      default:
        return "en-US";
    }
  }, [locale]);

  const [firstDayPref, setFirstDayPref] = React.useState<"monday" | "sunday">("monday");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_first_day_of_week") as "monday" | "sunday" | null;
      if (saved === "sunday" || saved === "monday") {
        setFirstDayPref(saved);
      }
    } catch {}
  }, []);

  // Days of week header matching the user's active locale and first day preference
  const daysOfWeek = React.useMemo(() => {
    const days: string[] = [];
    const baseDate = firstDayPref === "sunday" ? new Date(2026, 0, 4) : new Date(2026, 0, 5);
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const str = d.toLocaleDateString(localeCode, { weekday: "short" });
      days.push(str.charAt(0).toUpperCase() + str.slice(1).replace(".", ""));
    }
    return days;
  }, [localeCode, firstDayPref]);

  // Connected calendar accounts
  const connectedCalIntegrations = React.useMemo(() => {
    return integrations.filter(
      (i) =>
        (i.provider === "google_calendar" ||
          i.provider === "outlook_calendar" ||
          (i.provider === "google" && i.scopes?.some((s) => s.includes("calendar"))) ||
          (i.provider === "microsoft" && i.scopes?.some((s) => s.includes("calendar")))) &&
        i.status === "connected"
    );
  }, [integrations]);

  const [selectedAccount, setSelectedAccount] = React.useState<string>(() => {
    return (
      connectedCalIntegrations[0]?.accountEmail ||
      connectedCalIntegrations[0]?.providerAccountId ||
      (locale === "pt" ? "Calendário Principal" : "Primary Calendar")
    );
  });

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // New item dropdown menu state
  const [isNewMenuOpen, setIsNewMenuOpen] = React.useState(false);
  const newMenuRef = React.useRef<HTMLDivElement>(null);

  // Calendar navigation state (defaulting to day view as requested or month)
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [viewMode, setViewMode] = React.useState<"day" | "week" | "month" | "agenda">("day");
  const [selectedTagFilter, setSelectedTagFilter] = React.useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<"all" | CalendarEntityType | "google">("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Custom User Tags (persisted in localStorage without fake preset defaults)
  const [customTags, setCustomTags] = React.useState<
    Array<{ tag: string; color: CalendarEventColor; label: string }>
  >([]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("bb_custom_calendar_tags");
      if (stored) {
        setCustomTags(JSON.parse(stored));
      }
    } catch {
      // Local storage unavailable fallback
    }
  }, []);

  // Events state
  const [events, setEvents] = React.useState<CalendarEventItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Compute ONLY real tags created by the user or derived from real synced events/calendars
  const allAvailableTags = React.useMemo(() => {
    const list: Array<{ tag: string; color: CalendarEventColor; label: string }> = [];

    // 1. User created tags
    for (const ct of customTags) {
      if (!list.some((t) => t.tag.toLowerCase() === ct.tag.toLowerCase())) {
        list.push(ct);
      }
    }

    // 2. Real tags on actual events (from BusinessBrain or Google Calendar)
    for (const evt of events) {
      if (
        evt.tag &&
        evt.tag.trim() !== "" &&
        evt.tag.toLowerCase() !== "general" &&
        !list.some((t) => t.tag.toLowerCase() === evt.tag.toLowerCase())
      ) {
        list.push({
          tag: evt.tag,
          color: (evt.color as CalendarEventColor) || "blue",
          label: evt.tag,
        });
      }
    }

    return list;
  }, [customTags, events]);

  // Inline Tag Creator Popover state
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState<CalendarEventColor>("indigo");

  const handleCreateNewTag = () => {
    const cleanName = newTagName.trim().replace(/^#/, "");
    if (!cleanName) return;

    const existing = allAvailableTags.find(
      (t) => t.tag.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) {
      setSelectedTagFilter(existing.tag);
    } else {
      const newTagObj = {
        tag: cleanName,
        color: newTagColor,
        label: cleanName,
      };
      const updated = [...customTags, newTagObj];
      setCustomTags(updated);
      try {
        localStorage.setItem("bb_custom_calendar_tags", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("bb_custom_tags_updated"));
      } catch {
        // Ignore
      }
      setSelectedTagFilter(cleanName);
    }
    setNewTagName("");
    setIsCreatingTag(false);
  };

  // Event modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalDate, setModalDate] = React.useState<Date | null>(null);
  const [modalEntityType, setModalEntityType] = React.useState<CalendarEntityType>("event");
  const [editingEvent, setEditingEvent] = React.useState<CalendarEventItem | null>(null);

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch unified real events deterministically on-demand
  const loadEvents = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate active date window to avoid requesting excessive ranges from external providers
      let timeMin: string;
      let timeMax: string;

      if (viewMode === "day") {
        timeMin = new Date(currentDate.getTime() - 24 * 3600000).toISOString();
        timeMax = new Date(currentDate.getTime() + 48 * 3600000).toISOString();
      } else if (viewMode === "week") {
        timeMin = new Date(currentDate.getTime() - 7 * 86400000).toISOString();
        timeMax = new Date(currentDate.getTime() + 14 * 86400000).toISOString();
      } else {
        timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
        timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1).toISOString();
      }

      const data = await getOrganizationCalendarEventsAction({
        timeMin,
        timeMax,
      });
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, currentDate]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Calendar date calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Localized month name per user's language setting
  const rawMonthName = currentDate.toLocaleString(localeCode, { month: "long" });
  const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  const navigatePrevious = () => {
    if (viewMode === "day") {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 1);
      setCurrentDate(prev);
    } else if (viewMode === "week") {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentDate(prev);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "day") {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      setCurrentDate(next);
    } else if (viewMode === "week") {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Header date display formatted per viewMode and active locale
  const headerDateDisplay = React.useMemo(() => {
    if (viewMode === "day") {
      const str = currentDate.toLocaleDateString(localeCode, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return {
        main: str.charAt(0).toUpperCase() + str.slice(1),
        sub: String(currentDate.getFullYear()),
      };
    }
    if (viewMode === "week") {
      const curr = new Date(currentDate);
      const dayNum = firstDayPref === "sunday" ? curr.getDay() : (curr.getDay() + 6) % 7;
      const start = new Date(curr);
      start.setDate(curr.getDate() - dayNum);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        main: `${start.toLocaleDateString(localeCode, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(localeCode, { month: "short", day: "numeric" })}`,
        sub: String(year),
      };
    }
    return {
      main: monthName,
      sub: String(year),
    };
  }, [viewMode, currentDate, monthName, year, localeCode, firstDayPref]);

  // Generate days for Month View
  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek =
      firstDayPref === "sunday"
        ? firstDayOfMonth.getDay()
        : (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateString: string;
    }> = [];

    const todayStr = new Date().toISOString().split("T")[0];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const str = d.toISOString().split("T")[0];
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: str === todayStr,
        dateString: str,
      });
    }

    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const str = d.toISOString().split("T")[0];
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: str === todayStr,
        dateString: str,
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = d.toISOString().split("T")[0];
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: str === todayStr,
        dateString: str,
      });
    }

    return days;
  }, [year, month, firstDayPref]);

  // Generate days for Week View
  const weekDays = React.useMemo(() => {
    const curr = new Date(currentDate);
    const dayNum = firstDayPref === "sunday" ? curr.getDay() : (curr.getDay() + 6) % 7;
    const start = new Date(curr);
    start.setDate(curr.getDate() - dayNum);
    const result: Array<{
      date: Date;
      isToday: boolean;
      dateString: string;
    }> = [];
    const todayStr = new Date().toISOString().split("T")[0];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const str = d.toISOString().split("T")[0];
      result.push({
        date: d,
        isToday: str === todayStr,
        dateString: str,
      });
    }
    return result;
  }, [currentDate, firstDayPref]);

  // Filter events by search query, tag, and entity type
  const filteredEvents = React.useMemo(() => {
    return events.filter((evt) => {
      if (
        selectedTagFilter !== "All" &&
        evt.tag.toLowerCase() !== selectedTagFilter.toLowerCase()
      ) {
        return false;
      }
      if (selectedTypeFilter !== "all") {
        if (selectedTypeFilter === "google") {
          if (evt.source !== "google_calendar") return false;
        } else {
          if (evt.entityType !== selectedTypeFilter) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(q);
        const matchesDesc = (evt.description || "").toLowerCase().includes(q);
        const matchesTag = evt.tag.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesTag;
      }
      return true;
    });
  }, [events, selectedTagFilter, selectedTypeFilter, searchQuery]);

  // Map events by dateString
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const evt of filteredEvents) {
      const dateStr = evt.startTime.split("T")[0];
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(evt);
    }
    return map;
  }, [filteredEvents]);

  // Event actions
  const handleOpenCreateModal = (date?: Date, type: CalendarEntityType = "event") => {
    setEditingEvent(null);
    setModalDate(date || new Date());
    setModalEntityType(type);
    setIsNewMenuOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event: CalendarEventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEvent(event);
    setModalDate(new Date(event.startTime));
    setModalEntityType(event.entityType || "event");
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (input: CreateCalendarEventInput) => {
    if (editingEvent) {
      await updateCalendarEventAction(editingEvent.id, input);
      await loadEvents();
    } else {
      const createdItem = await createCalendarEventAction(input);
      if (createdItem) {
        setEvents((prev) => [createdItem, ...prev]);
      } else {
        await loadEvents();
      }
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteCalendarEventAction(eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId && e.entityId !== eventId));
  };

  return (
    <div className="space-y-4 max-w-7xl animate-in fade-in-0 duration-150">
      {/* Top Header & Account Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        {/* Left: Navigation & Today */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {headerDateDisplay.main}
            </h1>
            <span className="text-xl font-normal text-zinc-400 dark:text-zinc-500">
              {headerDateDisplay.sub}
            </span>
          </div>

          <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 bg-zinc-50 dark:bg-zinc-900/40">
            <button
              type="button"
              onClick={navigatePrevious}
              title="Previous"
              className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-md hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              {t.calendarPage.today}
            </button>
            <button
              type="button"
              onClick={navigateNext}
              title="Next"
              className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: Sequence STRICTLY requested: DIA | SEMANA | MÊS | AGENDA */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle: Day -> Week -> Month -> Agenda */}
          <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "day"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t.calendarPage.day}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "week"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t.calendarPage.week}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "month"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t.calendarPage.month}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                viewMode === "agenda"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t.calendarPage.agenda}
            </button>
          </div>

          {/* Connected Calendar Account Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm overflow-hidden">
                <img
                  src="/logos/google-calendar.svg"
                  alt="Calendar"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="max-w-[150px] truncate font-mono text-[11px]">
                {selectedAccount}
              </span>
              <span className="text-[10px] text-zinc-400">▼</span>
            </button>

            {isAccountDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] p-1.5 shadow-xl z-30 animate-in fade-in-0 zoom-in-95 duration-100">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {t.calendarPage.connectedCalendar}
                </div>

                {connectedCalIntegrations.length > 0 ? (
                  connectedCalIntegrations.map((acc) => {
                    const email = acc.accountEmail || acc.providerAccountId;
                    const isSelected = selectedAccount === email;
                    const isGoogle =
                      acc.provider === "google_calendar" || acc.provider === "google";
                    const logo = isGoogle
                      ? "/Logos/google-calendar.svg"
                      : "/Logos/microsoft-icon.svg";

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setSelectedAccount(email);
                          setIsAccountDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors",
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 overflow-hidden">
                            <img src={logo} alt="" className="h-full w-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-mono">{email}</p>
                            <p className="text-[10px] text-zinc-400">
                              {isGoogle ? "Google Workspace" : "Microsoft Outlook"}
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-500" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2 text-xs text-zinc-500">
                    {t.calendarPage.noCalendarConnected}
                  </div>
                )}

                <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountDropdownOpen(false);
                    openSettings("integrations");
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.emailPage.manageOrConnectMore}</span>
                </button>
              </div>
            )}
          </div>

          {/* + New Split Dropdown Button */}
          <div className="relative inline-flex rounded-lg shadow-2xs" ref={newMenuRef}>
            <button
              type="button"
              onClick={() => handleOpenCreateModal(undefined, "event")}
              className="inline-flex items-center gap-1.5 rounded-l-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.calendarPage.newEvent}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-r-lg bg-blue-700 px-2 text-xs font-semibold text-white hover:bg-blue-600 border-l border-blue-500/40 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {isNewMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] p-1.5 shadow-xl z-30 animate-in fade-in-0 zoom-in-95 duration-100 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(undefined, "event")}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                  <span>{t.calendarPage.newEvent}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(undefined, "meeting")}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-purple-500" />
                  <span>{t.calendarPage.newMeeting}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(undefined, "task")}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{t.calendarPage.newTask}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(undefined, "goal")}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Target className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t.calendarPage.newGoal}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter by Entity Type & User Tags */}
      <div className="flex flex-col gap-2.5">
        {/* Object Types Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 shrink-0">
            {t.calendarPage.objects}:
          </span>

          {[
            { id: "all", label: t.calendarPage.allObjects, icon: null },
            { id: "event", label: t.calendarPage.events, icon: CalendarIcon },
            { id: "meeting", label: t.calendarPage.meetings, icon: Users },
            { id: "task", label: t.calendarPage.tasks, icon: CheckSquare },
            { id: "goal", label: t.calendarPage.goals, icon: Target },
            { id: "google", label: "Google Cal", icon: null },
          ].map((item) => {
            const isSelected = selectedTypeFilter === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTypeFilter(item.id as typeof selectedTypeFilter)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 border",
                  isSelected
                    ? "bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-700 dark:border-zinc-600 shadow-xs font-semibold"
                    : "border-transparent bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/60"
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tags Row & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 shrink-0">
              TAGS:
            </span>

            {/* All Filter Button */}
            <button
              type="button"
              onClick={() => setSelectedTagFilter("All")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 border",
                selectedTagFilter === "All"
                  ? "bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-700 dark:border-zinc-600 font-semibold shadow-xs"
                  : "border-transparent bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/60"
              )}
            >
              {t.calendarPage.allTags}
            </button>

            {/* Real User & Synced Tags ONLY (Minimalist & Refined Design) */}
            {allAvailableTags.map((tItem) => {
              const isSelected = selectedTagFilter.toLowerCase() === tItem.tag.toLowerCase();
              const colors = getTagColorClasses(tItem.color);
              return (
                <button
                  key={tItem.tag}
                  type="button"
                  onClick={() => setSelectedTagFilter(tItem.tag)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0",
                    isSelected
                      ? "bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-600 shadow-xs font-semibold ring-1 ring-zinc-500"
                      : "bg-zinc-100/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colors.dot)} />
                  <span>#{tItem.label}</span>
                </button>
              );
            })}

            {/* User Create Tag Button + Inline Creator Popover */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsCreatingTag((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:border-zinc-500 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>{t.calendarPage.newTag}</span>
              </button>

              {isCreatingTag && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] p-3 shadow-xl z-30 animate-in fade-in-0 zoom-in-95 duration-100 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {t.calendarPage.createTag}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingTag(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder={t.calendarPage.tagNamePlaceholder}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateNewTag();
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                      Color
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {CALENDAR_COLOR_OPTIONS.map((c) => {
                        const colorScheme = getTagColorClasses(c.color);
                        const isChosen = newTagColor === c.color;
                        return (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => setNewTagColor(c.color)}
                            className={cn(
                              "h-5 w-5 rounded-full flex items-center justify-center transition-transform",
                              colorScheme.dot,
                              isChosen ? "ring-2 ring-white scale-110 shadow-xs" : "opacity-80 hover:opacity-100"
                            )}
                            title={c.label}
                          >
                            {isChosen && <Check className="h-3 w-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleCreateNewTag()}
                      disabled={!newTagName.trim()}
                      className="w-full rounded-lg bg-blue-600 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {t.calendarPage.createTag}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.calendarPage.searchPlaceholder}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 pl-8 pr-3 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        </div>
      </div>

      {/* ================= 1. DAY VIEW ================= */}
      {viewMode === "day" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xs space-y-4">
          {(() => {
            const currentDayStr = currentDate.toISOString().split("T")[0];
            const currentDayEvents = eventsByDate.get(currentDayStr) || [];
            const allDayEvents = currentDayEvents.filter((e) => e.allDay);

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200/80 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {currentDate.getDate()}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                        {currentDate.toLocaleDateString(localeCode, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h2>
                      <p className="text-xs text-zinc-400">
                        {currentDayEvents.length}{" "}
                        {currentDayEvents.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(currentDate)}
                    className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t.calendarPage.newEvent}</span>
                  </button>
                </div>

                {/* All-Day Events row if present */}
                {allDayEvents.length > 0 && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      {t.calendarPage.allDay}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {allDayEvents.map((evt) => {
                        const colors = getTagColorClasses(evt.color);
                        return (
                          <div
                            key={evt.id}
                            onClick={() => handleOpenEditModal(evt)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-semibold cursor-pointer transition-all hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
                          >
                            <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
                            <span>{evt.title}</span>
                            <span className="text-[10px] text-zinc-400 font-normal">#{evt.tag}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hourly Timeline Grid */}
                <div className="space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800/60 pt-1">
                  {HOURS_OF_DAY.map((hour) => {
                    const hourEvents = currentDayEvents.filter((e) => {
                      if (e.allDay) return false;
                      const d = new Date(e.startTime);
                      return d.getHours() === hour;
                    });

                    const displayTime = `${String(hour).padStart(2, "0")}:00`;

                    return (
                      <div
                        key={hour}
                        className="group flex items-start gap-4 py-2.5 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 rounded-lg px-2"
                      >
                        <div className="w-16 shrink-0 text-right">
                          <span className="font-mono text-xs text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                            {displayTime}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {hourEvents.length > 0 ? (
                            <div className="space-y-2">
                              {hourEvents.map((evt) => {
                                const colors = getTagColorClasses(evt.color);
                                const sTime = new Date(evt.startTime).toLocaleTimeString(localeCode, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const eTime = new Date(evt.endTime).toLocaleTimeString(localeCode, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });

                                return (
                                  <div
                                    key={evt.id}
                                    onClick={() => handleOpenEditModal(evt)}
                                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer shadow-2xs space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn("h-2 w-2 shrink-0 rounded-full", colors.dot)} />
                                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-white truncate">
                                          {evt.title}
                                        </h4>
                                      </div>
                                      <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                                        {sTime} – {eTime}
                                      </span>
                                    </div>

                                    {evt.description && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                                        {evt.description}
                                      </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] pt-0.5">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                        #{evt.tag}
                                      </span>

                                      {evt.meetingLink && (
                                        <a
                                          href={evt.meetingLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                          <Video className="h-3 w-3" />
                                          <span>{t.calendarPage.joinMeeting}</span>
                                        </a>
                                      )}

                                      {evt.location && (
                                        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                                          <MapPin className="h-3 w-3" />
                                          <span>{evt.location}</span>
                                        </span>
                                      )}

                                      {evt.attendees && evt.attendees.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                                          <Users className="h-3 w-3" />
                                          <span>{evt.attendees.length} {t.calendarPage.attendeesCount}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                const slotDate = new Date(currentDate);
                                slotDate.setHours(hour, 0, 0, 0);
                                handleOpenCreateModal(slotDate);
                              }}
                              className="h-7 rounded-lg border border-dashed border-transparent hover:border-zinc-300 dark:hover:border-zinc-700/80 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 flex items-center px-2 cursor-pointer transition-colors"
                            >
                              <span className="text-[11px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                <span>{t.calendarPage.scheduleAt} {displayTime}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ================= 2. WEEK VIEW ================= */}
      {viewMode === "week" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((col, idx) => {
              const dayEvents = eventsByDate.get(col.dateString) || [];
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col min-h-[300px] overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 mb-2">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-zinc-400">
                        {daysOfWeek[idx]}
                      </p>
                      <p className={cn("text-sm font-bold", col.isToday && "text-blue-600")}>
                        {col.date.getDate()} {monthName.slice(0, 3)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal(col.date)}
                      className="rounded p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
                    {dayEvents.map((evt) => {
                      const colors = getTagColorClasses(evt.color);
                      return (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenEditModal(evt)}
                          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs cursor-pointer transition-all w-full max-w-full overflow-hidden min-w-0 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colors.dot)} />
                              <p className="font-semibold truncate text-zinc-900 dark:text-white">
                                {evt.title}
                              </p>
                            </div>
                            {evt.entityType === "task" && (
                              <CheckSquare className="h-3 w-3 opacity-60 shrink-0 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="font-mono shrink-0">
                              {new Date(evt.startTime).toLocaleTimeString(localeCode, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="truncate">#{evt.tag}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 3. MONTH VIEW ================= */}
      {viewMode === "month" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden shadow-2xs">
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 text-center">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="py-2.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800/80">
            {calendarDays.map((cell, idx) => {
              const dayEvents = eventsByDate.get(cell.dateString) || [];

              return (
                <div
                  key={idx}
                  onClick={() => handleOpenCreateModal(cell.date)}
                  className={cn(
                    "min-h-[110px] p-2 transition-colors cursor-pointer group flex flex-col justify-between overflow-hidden",
                    cell.isCurrentMonth
                      ? "bg-white dark:bg-[#161618] hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                      : "bg-zinc-50/40 dark:bg-zinc-950/20 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        cell.isToday
                          ? "bg-blue-600 text-white shadow-2xs font-bold"
                          : cell.isCurrentMonth
                          ? "text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600"
                          : "text-zinc-400 dark:text-zinc-600"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCreateModal(cell.date);
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-opacity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Day Events Stack (Minimalist refined cards) */}
                  <div className="mt-1.5 space-y-1 flex-1 overflow-y-auto overflow-x-hidden max-h-[85px] scrollbar-none">
                    {dayEvents.map((evt) => {
                      const colors = getTagColorClasses(evt.color);
                      const timeStr = new Date(evt.startTime).toLocaleTimeString(localeCode, {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => handleOpenEditModal(evt, e)}
                          title={`${evt.title} (${timeStr}) - #${evt.tag}`}
                          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 w-full max-w-full overflow-hidden min-w-0 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer"
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
                          {!evt.allDay && (
                            <span className="shrink-0 font-mono text-[9px] text-zinc-400">
                              {timeStr}
                            </span>
                          )}
                          <span className="truncate flex-1 min-w-0">{evt.title}</span>
                          {evt.entityType === "task" && (
                            <CheckSquare className="h-2.5 w-2.5 opacity-60 shrink-0 text-zinc-400" />
                          )}
                          {evt.entityType === "meeting" && (
                            <Users className="h-2.5 w-2.5 opacity-60 shrink-0 text-zinc-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 4. AGENDA VIEW ================= */}
      {viewMode === "agenda" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              {t.calendarPage.timelineTitle}
            </h2>
            <span className="text-xs text-zinc-400">
              {filteredEvents.length} {filteredEvents.length === 1 ? "item" : "items"}
            </span>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="space-y-2.5">
              {filteredEvents.map((evt) => {
                const colors = getTagColorClasses(evt.color);
                const startDate = new Date(evt.startTime);
                const dateStr = startDate.toLocaleDateString(localeCode, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = startDate.toLocaleTimeString(localeCode, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={evt.id}
                    onClick={() => handleOpenEditModal(evt)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 pr-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {evt.entityType === "task" ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : evt.entityType === "meeting" ? (
                          <Users className="h-4 w-4" />
                        ) : evt.entityType === "goal" ? (
                          <Target className="h-4 w-4" />
                        ) : (
                          <CalendarIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {evt.title}
                          </p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
                            <span>#{evt.tag}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" />
                            {dateStr} {timeStr}
                          </span>
                          {evt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {evt.location}
                            </span>
                          )}
                          {evt.attendees && evt.attendees.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {evt.attendees.length} {t.calendarPage.attendeesCount}
                            </span>
                          )}
                          {evt.relations && evt.relations.length > 0 && (
                            <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                              <FolderGit2 className="h-3 w-3" />
                              <span>{evt.relations[0].targetTitle}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      {evt.meetingLink && (
                        <a
                          href={evt.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                        >
                          <Video className="h-3 w-3" />
                          <span>{t.calendarPage.joinMeeting}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                        {evt.source === "google_calendar" ? "Google" : "Workspace"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-400 text-xs flex flex-col items-center justify-center space-y-2">
              <CalendarIcon className="h-8 w-8 text-zinc-500/50 mb-1" />
              <p>{t.calendarPage.noEventsFound}</p>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.calendarPage.createFirstItem}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventToEdit={editingEvent}
        initialDate={modalDate}
        initialTag={selectedTagFilter === "All" ? undefined : selectedTagFilter}
        initialEntityType={modalEntityType}
        availableTags={allAvailableTags}
        onCreatedTag={(newTag) => {
          if (!customTags.some((ct) => ct.tag.toLowerCase() === newTag.tag.toLowerCase())) {
            const updated = [...customTags, newTag];
            setCustomTags(updated);
            try {
              localStorage.setItem("bb_custom_calendar_tags", JSON.stringify(updated));
            } catch {
              // Ignore
            }
          }
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
      />
    </div>
  );
}
