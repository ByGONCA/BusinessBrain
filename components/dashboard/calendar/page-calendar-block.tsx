"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Tag,
  Check,
  List,
  Grid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEventItem,
  CreateCalendarEventInput,
  PRESET_TAGS,
  getTagColorClasses,
} from "@/lib/calendar/types";
import {
  getOrganizationCalendarEventsAction,
  createCalendarEventAction,
} from "@/lib/calendar/actions";
import { EventModal } from "./event-modal";

interface PageCalendarBlockProps {
  blockId: string;
  properties?: {
    filterTag?: string;
    viewMode?: "month" | "list";
    calendarTitle?: string;
    [key: string]: unknown;
  };
  onUpdateProperties: (id: string, properties: Record<string, unknown>) => void;
  readOnly?: boolean;
  authorBlame?: React.ReactNode;
}

const DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function PageCalendarBlock({
  blockId,
  properties = {},
  onUpdateProperties,
  readOnly,
  authorBlame,
}: PageCalendarBlockProps) {
  const filterTag = (properties.filterTag as string) || "All";
  const viewMode = (properties.viewMode as "month" | "list") || "month";
  const title = (properties.calendarTitle as string) || "Calendar";

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [events, setEvents] = React.useState<CalendarEventItem[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = React.useState(false);
  const [customTagInput, setCustomTagInput] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalDate, setModalDate] = React.useState<Date | null>(null);
  const [firstDayPref, setFirstDayPref] = React.useState<"monday" | "sunday">("monday");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("cb_first_day_of_week") as "monday" | "sunday" | null;
      if (saved === "sunday" || saved === "monday") {
        setFirstDayPref(saved);
      }
    } catch {}
  }, []);

  // Synchronized custom tags (shared with Main Calendar via localStorage bb_custom_calendar_tags)
  const [customTags, setCustomTags] = React.useState<
    Array<{ tag: string; color: any; label: string }>
  >([]);

  React.useEffect(() => {
    const loadStoredTags = () => {
      try {
        const stored = localStorage.getItem("bb_custom_calendar_tags");
        if (stored) {
          setCustomTags(JSON.parse(stored));
        }
      } catch {
        // Fallback if localStorage unavailable
      }
    };

    loadStoredTags();

    // Listen to changes across tabs or windows
    window.addEventListener("storage", loadStoredTags);
    // Custom window event for same-page sync
    window.addEventListener("bb_custom_tags_updated", loadStoredTags);

    return () => {
      window.removeEventListener("storage", loadStoredTags);
      window.removeEventListener("bb_custom_tags_updated", loadStoredTags);
    };
  }, []);

  const tagDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close tag dropdown on outside click
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const pageId = (properties.pageId as string) || undefined;

  // Fetch events for active tag filter and page connection
  const loadEvents = React.useCallback(async () => {
    try {
      const data = await getOrganizationCalendarEventsAction({
        tagFilter: filterTag === "All" ? undefined : filterTag,
        pageId,
      });
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch events for page calendar block:", err);
    }
  }, [filterTag, pageId]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const rawMonth = currentDate.toLocaleString("pt-PT", { month: "short" });
  const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const setFilterTag = (newTag: string) => {
    onUpdateProperties(blockId, {
      ...properties,
      filterTag: newTag,
    });
    setIsTagDropdownOpen(false);
  };

  const setBlockViewMode = (mode: "month" | "list") => {
    onUpdateProperties(blockId, {
      ...properties,
      viewMode: mode,
    });
  };

  // Generate days for Month View
  const calendarDays = React.useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek =
      firstDayPref === "sunday"
        ? firstDay.getDay()
        : (firstDay.getDay() + 6) % 7;

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

    for (let i = 1; i <= lastDay.getDate(); i++) {
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

  // Group events by date
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const evt of events) {
      const d = evt.startTime.split("T")[0];
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(evt);
    }
    return map;
  }, [events]);

  const handleCreateEvent = async (input: CreateCalendarEventInput) => {
    const newEvt = await createCalendarEventAction({
      ...input,
      tag: input.tag || (filterTag !== "All" ? filterTag : "Work"),
    });
    setEvents((prev) => [...prev, newEvt]);
  };

  return (
    <div className="my-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden shadow-2xs select-none">
      {/* Block Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled={readOnly}
                value={title}
                onChange={(e) => onUpdateProperties(blockId, { calendarTitle: e.target.value })}
                placeholder="Calendar..."
                className="text-xs font-bold text-zinc-900 dark:text-white bg-transparent border-none outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded px-1 py-0.5 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/40 transition-colors truncate"
              />
              {authorBlame}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 px-1">
              <span>{monthName} {year}</span>
              <span>&bull;</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                #{filterTag}
              </span>
            </div>
          </div>
        </div>

        {/* Controls: Month Nav, Tag Connector, View Toggle & + Add Event */}
        <div className="flex items-center gap-1.5">
          {/* Month Prev/Next */}
          <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 overflow-hidden">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Connected Tag Dropdown (User specifies which tag connects to this calendar) */}
          <div className="relative" ref={tagDropdownRef}>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setIsTagDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Tag className="h-3 w-3 text-zinc-400" />
              <span>Tag: #{filterTag}</span>
              <span className="text-[10px] text-zinc-400">▼</span>
            </button>

            {isTagDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] p-1.5 shadow-xl z-30 animate-in fade-in-0 zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Connect Tag to Calendar
                </div>

                <button
                  type="button"
                  onClick={() => setFilterTag("All")}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs text-left transition-colors",
                    filterTag === "All"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  )}
                >
                  <span>All Events (Unfiltered)</span>
                  {filterTag === "All" && <Check className="h-3 w-3 text-blue-500" />}
                </button>

                {PRESET_TAGS.map((t) => {
                  const isSelected = filterTag.toLowerCase() === t.tag.toLowerCase();
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => setFilterTag(t.tag)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs text-left transition-colors",
                        isSelected
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", getTagColorClasses(t.color).dot)}
                        />
                        <span>#{t.label}</span>
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-blue-500" />}
                    </button>
                  );
                })}

                {/* Synchronized Custom Tags from Main Calendar */}
                {customTags.length > 0 && (
                  <>
                    <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Custom Workspace Tags
                    </div>
                    {customTags.map((t) => {
                      const isSelected = filterTag.toLowerCase() === t.tag.toLowerCase();
                      return (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => setFilterTag(t.tag)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs text-left transition-colors",
                            isSelected
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", getTagColorClasses(t.color || "blue").dot)}
                            />
                            <span>#{t.label || t.tag}</span>
                          </div>
                          {isSelected && <Check className="h-3 w-3 text-blue-500" />}
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Custom tag input & save */}
                <div className="mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="Custom tag..."
                    className="flex-1 rounded px-1.5 py-0.5 text-xs border border-zinc-200 dark:border-zinc-800 bg-transparent outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customTagInput.trim()) {
                        e.preventDefault();
                        const cleanName = customTagInput.trim().replace(/^#/, "");
                        if (cleanName) {
                          const existing = customTags.find((t) => t.tag.toLowerCase() === cleanName.toLowerCase());
                          if (!existing) {
                            const newTagObj = { tag: cleanName, color: "indigo" as const, label: cleanName };
                            const updated = [...customTags, newTagObj];
                            setCustomTags(updated);
                            try {
                              localStorage.setItem("bb_custom_calendar_tags", JSON.stringify(updated));
                              window.dispatchEvent(new CustomEvent("bb_custom_tags_updated"));
                            } catch {
                              // Ignore
                            }
                          }
                          setFilterTag(cleanName);
                          setCustomTagInput("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cleanName = customTagInput.trim().replace(/^#/, "");
                      if (cleanName) {
                        const existing = customTags.find((t) => t.tag.toLowerCase() === cleanName.toLowerCase());
                        if (!existing) {
                          const newTagObj = { tag: cleanName, color: "indigo" as const, label: cleanName };
                          const updated = [...customTags, newTagObj];
                          setCustomTags(updated);
                          try {
                            localStorage.setItem("bb_custom_calendar_tags", JSON.stringify(updated));
                            window.dispatchEvent(new CustomEvent("bb_custom_tags_updated"));
                          } catch {
                            // Ignore
                          }
                        }
                        setFilterTag(cleanName);
                        setCustomTagInput("");
                      }
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View toggle (Month / List) */}
          <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 bg-white dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setBlockViewMode("month")}
              title="Month Grid View"
              className={cn(
                "p-1 rounded text-xs transition-colors",
                viewMode === "month"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-700"
              )}
            >
              <Grid className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setBlockViewMode("list")}
              title="List View"
              className={cn(
                "p-1 rounded text-xs transition-colors",
                viewMode === "list"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-700"
              )}
            >
              <List className="h-3 w-3" />
            </button>
          </div>

          {/* Add Event button */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setModalDate(new Date());
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-2xs"
            >
              <Plus className="h-3 w-3" />
              <span>Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Block Body Content */}
      {viewMode === "month" ? (
        <div>
          {/* Days header */}
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center">
            {(firstDayPref === "sunday"
              ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
              : DAYS_SHORT
            ).map((d) => (
              <div
                key={d}
                className="py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800/80">
            {calendarDays.map((cell, idx) => {
              const dayEvts = eventsByDate.get(cell.dateString) || [];

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!readOnly) {
                      setModalDate(cell.date);
                      setIsModalOpen(true);
                    }
                  }}
                  className={cn(
                    "min-h-[64px] p-1.5 transition-colors cursor-pointer group flex flex-col justify-between",
                    cell.isCurrentMonth
                      ? "bg-white dark:bg-[#161618] hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                      : "bg-zinc-50/40 dark:bg-zinc-950/20 text-zinc-400 dark:text-zinc-600"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        cell.isToday
                          ? "bg-blue-600 text-white font-bold"
                          : cell.isCurrentMonth
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-400 dark:text-zinc-600"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvts.slice(0, 2).map((evt) => {
                      const colors = getTagColorClasses(evt.color);
                      return (
                        <div
                          key={evt.id}
                          title={`${evt.title} - #${evt.tag}`}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[9px] font-medium border flex items-center gap-1",
                            colors.bg,
                            colors.border,
                            colors.text
                          )}
                        >
                          <span className={cn("h-1 w-1 rounded-full shrink-0", colors.dot)} />
                          <span className="truncate">{evt.title}</span>
                        </div>
                      );
                    })}
                    {dayEvts.length > 2 && (
                      <span className="text-[9px] text-zinc-400 pl-1 font-mono">
                        +{dayEvts.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
          {events.length > 0 ? (
            events.map((evt) => {
              const colors = getTagColorClasses(evt.color);
              const dateStr = new Date(evt.startTime).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
              const timeStr = new Date(evt.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)}
                    />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {evt.title}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[9px] font-medium border",
                        colors.bg,
                        colors.border,
                        colors.text
                      )}
                    >
                      #{evt.tag}
                    </span>
                  </div>

                  <div className="shrink-0 text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{dateStr}, {timeStr}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-zinc-400">
              No events found connected to tag <span className="font-semibold">#{filterTag}</span>.
            </div>
          )}
        </div>
      )}

      {/* Create Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialDate={modalDate}
        initialTag={filterTag === "All" ? "Work" : filterTag}
        onSave={handleCreateEvent}
      />
    </div>
  );
}
