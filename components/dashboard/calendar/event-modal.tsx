"use client";

import * as React from "react";
import {
  X,
  Calendar as CalendarIcon,
  Tag,
  MapPin,
  Video,
  Users,
  Trash2,
  Loader2,
  Check,
  FolderGit2,
  FileText,
  CheckSquare,
  Target,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEventItem,
  CreateCalendarEventInput,
  CalendarEventColor,
  CalendarEntityType,
  CalendarDestination,
  getTagColorClasses,
} from "@/lib/calendar/types";
import {
  getWorkspaceProjectsAndPagesAction,
  getConnectedCalendarDestinationsAction,
} from "@/lib/calendar/actions";
import { useLanguage } from "@/lib/i18n";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: CalendarEventItem | null;
  initialDate?: Date | null;
  initialTag?: string | null;
  initialEntityType?: CalendarEntityType;
  availableTags?: Array<{ tag: string; color: CalendarEventColor; label: string }>;
  onCreatedTag?: (tag: { tag: string; color: CalendarEventColor; label: string }) => void;
  onSave: (event: CreateCalendarEventInput) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export function EventModal({
  isOpen,
  onClose,
  eventToEdit,
  initialDate,
  initialTag,
  initialEntityType = "event",
  availableTags,
  onCreatedTag,
  onSave,
  onDelete,
}: EventModalProps) {
  const { t } = useLanguage();
  const [entityType, setEntityType] = React.useState<CalendarEntityType>(initialEntityType);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDateStr, setStartDateStr] = React.useState("");
  const [startTimeStr, setStartTimeStr] = React.useState("09:00");
  const [endDateStr, setEndDateStr] = React.useState("");
  const [endTimeStr, setEndTimeStr] = React.useState("10:00");
  const [allDay, setAllDay] = React.useState(false);
  const [selectedTag, setSelectedTag] = React.useState(initialTag || "");
  const [customTagInput, setCustomTagInput] = React.useState("");
  const [color, setColor] = React.useState<CalendarEventColor>("blue");
  const [location, setLocation] = React.useState("");
  const [meetingLink, setMeetingLink] = React.useState("");
  const [attendeesInput, setAttendeesInput] = React.useState("");

  // Task specific properties
  const [status, setStatus] = React.useState<string>("todo");
  const [priority, setPriority] = React.useState<"low" | "medium" | "high">("medium");

  // Company Brain relations state
  const [workspaceProjects, setWorkspaceProjects] = React.useState<Array<{ id: string; title: string }>>([]);
  const [workspacePages, setWorkspacePages] = React.useState<Array<{ id: string; title: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [selectedPageId, setSelectedPageId] = React.useState<string>("");

  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Explicit destination state (Company Brain vs Google vs Outlook)
  const [destination, setDestination] = React.useState<CalendarDestination>("company");
  const [availableDestinations, setAvailableDestinations] = React.useState<{
    hasCompany: boolean;
    hasGoogle: boolean;
    hasOutlook: boolean;
  }>({ hasCompany: true, hasGoogle: false, hasOutlook: false });

  // Load workspace projects, pages and connected destinations
  React.useEffect(() => {
    if (!isOpen) return;
    getWorkspaceProjectsAndPagesAction()
      .then((data) => {
        setWorkspaceProjects(data.projects || []);
        setWorkspacePages(data.pages || []);
      })
      .catch((err) => {
        console.error("Failed to load workspace projects/pages:", err);
      });

    getConnectedCalendarDestinationsAction()
      .then(setAvailableDestinations)
      .catch((err) => {
        console.error("Failed to load calendar destinations:", err);
      });
  }, [isOpen]);

  // Initialize form state when opening or when eventToEdit changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (eventToEdit) {
      setEntityType(eventToEdit.entityType || "event");
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || "");

      const s = new Date(eventToEdit.startTime);
      const e = new Date(eventToEdit.endTime);

      setStartDateStr(s.toISOString().split("T")[0]);
      setStartTimeStr(s.toTimeString().slice(0, 5));
      setEndDateStr(e.toISOString().split("T")[0]);
      setEndTimeStr(e.toTimeString().slice(0, 5));

      setAllDay(eventToEdit.allDay);
      setSelectedTag(eventToEdit.tag || "");
      setColor((eventToEdit.color as CalendarEventColor) || "blue");
      setLocation(eventToEdit.location || "");
      setMeetingLink(eventToEdit.meetingLink || "");
      setAttendeesInput((eventToEdit.attendees || []).join(", "));
      setStatus(eventToEdit.status || "todo");
      setPriority(eventToEdit.priority || "medium");

      // Extract existing project relation if present
      const projectRel = eventToEdit.relations?.find((r) => r.targetType === "project");
      setSelectedProjectId(projectRel ? projectRel.targetId : "");

      const pageRel = eventToEdit.relations?.find((r) => r.targetType === "page");
      setSelectedPageId(pageRel ? pageRel.targetId : "");

      if (eventToEdit.source === "google_calendar") {
        setDestination("google");
      } else if (eventToEdit.source === "outlook_calendar") {
        setDestination("outlook");
      } else {
        setDestination("company");
      }
    } else {
      const baseDate = initialDate || new Date();
      const dateIso = baseDate.toISOString().split("T")[0];

      setDestination("company");
      setEntityType(initialEntityType);
      setTitle("");
      setDescription("");
      setStartDateStr(dateIso);
      setStartTimeStr("09:00");
      setEndDateStr(dateIso);
      setEndTimeStr("10:00");
      setAllDay(initialEntityType === "task" || initialEntityType === "goal");

      const defaultAvailableTag =
        initialTag && initialTag !== "All"
          ? initialTag
          : availableTags && availableTags.length > 0
          ? availableTags[0].tag
          : "";

      setSelectedTag(defaultAvailableTag);

      const matchingTagObj = availableTags?.find(
        (t) => t.tag.toLowerCase() === defaultAvailableTag.toLowerCase()
      );

      setColor(
        matchingTagObj
          ? matchingTagObj.color
          : initialEntityType === "meeting"
          ? "purple"
          : initialEntityType === "task"
          ? "indigo"
          : initialEntityType === "goal"
          ? "amber"
          : "blue"
      );

      setLocation("");
      setMeetingLink("");
      setAttendeesInput("");
      setStatus("todo");
      setPriority("medium");
      setSelectedProjectId("");
      setSelectedPageId("");
    }
  }, [isOpen, eventToEdit, initialDate, initialTag, initialEntityType, availableTags]);

  if (!isOpen) return null;

  const handleTagSelect = (tag: string, tagColor: CalendarEventColor) => {
    setSelectedTag(tag);
    setColor(tagColor);
  };

  const handleAddCustomTag = () => {
    const clean = customTagInput.trim().replace(/^#/, "");
    if (clean) {
      setSelectedTag(clean);
      setColor("indigo");
      if (onCreatedTag) {
        onCreatedTag({ tag: clean, color: "indigo", label: clean });
      }
      setCustomTagInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDateStr) return;

    setIsSaving(true);
    try {
      const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
      const [sHour, sMin] = startTimeStr.split(":").map(Number);
      const start = new Date(sYear, sMonth - 1, sDay, allDay ? 0 : sHour, allDay ? 0 : sMin);

      const [eYear, eMonth, eDay] = (endDateStr || startDateStr).split("-").map(Number);
      const [eHour, eMin] = endTimeStr.split(":").map(Number);
      const end = new Date(eYear, eMonth - 1, eDay, allDay ? 23 : eHour, allDay ? 59 : eMin);

      const attendees = attendeesInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      // Build relations array
      const relations = [];
      if (selectedProjectId) {
        const proj = workspaceProjects.find((p) => p.id === selectedProjectId);
        relations.push({
          targetType: "project",
          targetId: selectedProjectId,
          targetTitle: proj?.title || "Projeto",
          relationshipType: "related_to",
        });
      }
      if (selectedPageId) {
        const pg = workspacePages.find((p) => p.id === selectedPageId);
        relations.push({
          targetType: "page",
          targetId: selectedPageId,
          targetTitle: pg?.title || "Página",
          relationshipType: "discussed_in",
        });
      }

      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        allDay,
        tag: selectedTag.trim() || "Work",
        color,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        attendees,
        entityType,
        status: entityType === "task" || entityType === "goal" ? status : undefined,
        priority: entityType === "task" ? priority : undefined,
        projectId: selectedProjectId || undefined,
        pageId: selectedPageId || undefined,
        destination,
        relations,
      });

      onClose();
    } catch (err) {
      console.error("Failed to save calendar item:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(eventToEdit.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete event:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                {eventToEdit ? t.calendarPage.modalTitleEdit : t.calendarPage.modalTitleNew}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {t.calendarPage.timelineTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Object Type Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.calendarPage.objects}
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setEntityType("event");
                  setColor("blue");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                  entityType === "event"
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>{t.calendarPage.events}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEntityType("meeting");
                  setSelectedTag("Meeting");
                  setColor("purple");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                  entityType === "meeting"
                    ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{t.calendarPage.meetings}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEntityType("task");
                  setSelectedTag("Task");
                  setColor("indigo");
                  setAllDay(true);
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                  entityType === "task"
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>{t.calendarPage.tasks}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEntityType("goal");
                  setSelectedTag("Goal");
                  setColor("amber");
                  setAllDay(true);
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                  entityType === "goal"
                    ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <Target className="h-3.5 w-3.5" />
                <span>{t.calendarPage.goals}</span>
              </button>
            </div>
          </div>

          {/* Target Destination Selector (Company Brain vs Google vs Outlook) */}
          {(entityType === "event" || entityType === "meeting") && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Salvar em
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDestination("company")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center",
                    destination === "company"
                      ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  <span>Company Brain</span>
                </button>

                <button
                  type="button"
                  disabled={!availableDestinations.hasGoogle}
                  onClick={() => setDestination("google")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center",
                    !availableDestinations.hasGoogle && "opacity-40 cursor-not-allowed",
                    destination === "google"
                      ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={availableDestinations.hasGoogle ? "Salvar no Google Calendar (Meet grátis)" : "Google Calendar não conectado"}
                >
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  disabled={!availableDestinations.hasOutlook}
                  onClick={() => setDestination("outlook")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center",
                    !availableDestinations.hasOutlook && "opacity-40 cursor-not-allowed",
                    destination === "outlook"
                      ? "bg-white dark:bg-zinc-800 text-blue-500 dark:text-blue-300 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={availableDestinations.hasOutlook ? "Salvar no Outlook Calendar (Teams grátis)" : "Outlook Calendar não conectado"}
                >
                  <span>Outlook</span>
                </button>
              </div>
              {destination === "google" && (
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1">
                  ✓ Evento será salvo na sua conta Google com Google Meet gerado automaticamente.
                </p>
              )}
              {destination === "outlook" && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                  ✓ Evento será salvo na sua conta Microsoft com Teams gerado automaticamente.
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t.calendarPage.fieldTitle} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                entityType === "meeting"
                  ? "Ex: Roadmap Q4 Sync..."
                  : entityType === "task"
                  ? "Ex: Finish Stripe checkout..."
                  : entityType === "goal"
                  ? "Ex: Reach 100 active customers..."
                  : "Ex: Architecture Review..."
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {entityType === "task" || entityType === "goal" ? t.calendarPage.fieldDeadline : t.calendarPage.fieldStartDate}
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className="w-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                )}
              </div>
            </div>

            {entityType !== "task" && entityType !== "goal" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.calendarPage.fieldEndDate}
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    required
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={endTimeStr}
                      onChange={(e) => setEndTimeStr(e.target.value)}
                      className="w-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allday-check"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="allday-check" className="text-xs text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
              {t.calendarPage.allDay}
            </label>
          </div>

          {/* Task specific priority & status */}
          {entityType === "task" && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.calendarPage.fieldPriority}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.calendarPage.fieldStatus}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          )}

          {/* Company Brain Relations Picker */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Company Brain Relations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <FolderGit2 className="h-3 w-3" />
                  <span>{t.calendarPage.fieldProject}</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">{t.calendarPage.noProject}</option>
                  {workspaceProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{t.calendarPage.fieldPage}</span>
                </label>
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">{t.calendarPage.noPage}</option>
                  {workspacePages.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tag Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-zinc-500" />
                <span>{t.calendarPage.fieldTag}</span>
              </label>
              <span className="text-[11px] text-zinc-400">
                {t.calendarPage.tagDesc}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(availableTags || []).map((tItem) => {
                const isSelected = selectedTag.toLowerCase() === tItem.tag.toLowerCase();
                const colors = getTagColorClasses(tItem.color);
                return (
                  <button
                    key={tItem.tag}
                    type="button"
                    onClick={() => handleTagSelect(tItem.tag, tItem.color)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                      isSelected
                        ? cn(colors.bg, colors.border, colors.text, "ring-1.5 ring-blue-500/50 font-semibold shadow-xs")
                        : cn(colors.bg, colors.border, colors.text, "opacity-75 hover:opacity-100")
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colors.dot)} />
                    <span>#{tItem.label}</span>
                    {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder={t.calendarPage.customTagPlaceholder}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                disabled={!customTagInput.trim()}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t.calendarPage.add}
              </button>
            </div>
          </div>

          {/* Meeting Link & Location (if event or meeting) */}
          {(entityType === "event" || entityType === "meeting") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{t.calendarPage.fieldMeetingLink}</span>
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {!meetingLink && entityType === "meeting" && (
                  <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>• Gera Google Meet ou Microsoft Teams automaticamente conforme o calendário</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{t.calendarPage.fieldLocation}</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Conference Room 1 or Remote"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          )}

          {/* Attendees */}
          {(entityType === "event" || entityType === "meeting") && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-500" />
                <span>{t.calendarPage.fieldAttendees}</span>
              </label>
              <input
                type="text"
                value={attendeesInput}
                onChange={(e) => setAttendeesInput(e.target.value)}
                placeholder="alice@company.com, bob@company.com"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t.calendarPage.fieldDescription}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
            {eventToEdit && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{isDeleting ? t.calendarPage.deleting : t.calendarPage.delete}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t.calendarPage.cancel}
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-2xs transition-colors"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isSaving ? t.calendarPage.saving : t.calendarPage.save}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
