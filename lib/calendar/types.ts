export type CalendarTag =
  | "Work"
  | "Personal"
  | "Meeting"
  | "Marketing"
  | "Engineering"
  | "Design"
  | "Client"
  | (string & {});

export type CalendarEventColor =
  | "blue"
  | "emerald"
  | "purple"
  | "amber"
  | "indigo"
  | "rose"
  | "teal"
  | "orange"
  | "cyan";

export type CalendarEntityType = "event" | "meeting" | "task" | "project" | "goal";

export interface CalendarItemRelation {
  targetType: string;
  targetId: string;
  targetTitle: string;
  relationshipType: string;
}

export type CalendarDestination = "company" | "google" | "outlook";

export interface CalendarFilterOptions {
  explicitOrgId?: string;
  pageId?: string;
  tagFilter?: string;
  entityType?: "all" | CalendarEntityType;
  source?: "all" | "internal" | "google_calendar" | "outlook_calendar";
  projectId?: string;
  assigneeId?: string;
  timeMin?: string;
  timeMax?: string;
}

export interface CalendarEventItem {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  startTime: string; // ISO string
  endTime: string; // ISO string
  allDay: boolean;
  tag: string;
  color: CalendarEventColor | string;
  location?: string | null;
  meetingLink?: string | null;
  attendees?: string[];
  source: "internal" | "google_calendar" | "outlook_calendar";
  entityType?: CalendarEntityType;
  entityId?: string;
  status?: string;
  priority?: "low" | "medium" | "high";
  assigneeId?: string;
  assigneeName?: string;
  externalEventId?: string;
  relations?: CalendarItemRelation[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  allDay?: boolean;
  tag?: string;
  color?: string;
  location?: string;
  meetingLink?: string;
  attendees?: string[];
  organizationId?: string;
  entityType?: CalendarEntityType;
  status?: string;
  priority?: "low" | "medium" | "high";
  projectId?: string;
  pageId?: string;
  destination?: CalendarDestination;
  relations?: CalendarItemRelation[];
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  tag?: string;
  color?: string;
  location?: string;
  meetingLink?: string;
  attendees?: string[];
  entityType?: CalendarEntityType;
  status?: string;
  priority?: "low" | "medium" | "high";
  relations?: CalendarItemRelation[];
}

export const CALENDAR_COLOR_OPTIONS: Array<{ color: CalendarEventColor; label: string }> = [
  { color: "blue", label: "Blue" },
  { color: "emerald", label: "Emerald" },
  { color: "purple", label: "Purple" },
  { color: "amber", label: "Amber" },
  { color: "indigo", label: "Indigo" },
  { color: "rose", label: "Rose" },
  { color: "teal", label: "Teal" },
  { color: "orange", label: "Orange" },
  { color: "cyan", label: "Cyan" },
];

export const PRESET_TAGS: Array<{ tag: string; color: CalendarEventColor; label: string }> = [];

export function getTagColorClasses(color?: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
  accentBorder: string;
} {
  switch (color) {
    case "emerald":
      return {
        bg: "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-500/25 dark:border-emerald-500/20",
        dot: "bg-emerald-500",
        accentBorder: "border-l-emerald-500",
      };
    case "purple":
      return {
        bg: "bg-purple-500/[0.08] dark:bg-purple-500/[0.12]",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-500/25 dark:border-purple-500/20",
        dot: "bg-purple-500",
        accentBorder: "border-l-purple-500",
      };
    case "amber":
      return {
        bg: "bg-amber-500/[0.08] dark:bg-amber-500/[0.12]",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-500/25 dark:border-amber-500/20",
        dot: "bg-amber-500",
        accentBorder: "border-l-amber-500",
      };
    case "indigo":
      return {
        bg: "bg-indigo-500/[0.08] dark:bg-indigo-500/[0.12]",
        text: "text-indigo-700 dark:text-indigo-300",
        border: "border-indigo-500/25 dark:border-indigo-500/20",
        dot: "bg-indigo-500",
        accentBorder: "border-l-indigo-500",
      };
    case "rose":
      return {
        bg: "bg-rose-500/[0.08] dark:bg-rose-500/[0.12]",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-500/25 dark:border-rose-500/20",
        dot: "bg-rose-500",
        accentBorder: "border-l-rose-500",
      };
    case "teal":
      return {
        bg: "bg-teal-500/[0.08] dark:bg-teal-500/[0.12]",
        text: "text-teal-700 dark:text-teal-300",
        border: "border-teal-500/25 dark:border-teal-500/20",
        dot: "bg-teal-500",
        accentBorder: "border-l-teal-500",
      };
    case "orange":
      return {
        bg: "bg-orange-500/[0.08] dark:bg-orange-500/[0.12]",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-500/25 dark:border-orange-500/20",
        dot: "bg-orange-500",
        accentBorder: "border-l-orange-500",
      };
    case "cyan":
      return {
        bg: "bg-cyan-500/[0.08] dark:bg-cyan-500/[0.12]",
        text: "text-cyan-700 dark:text-cyan-300",
        border: "border-cyan-500/25 dark:border-cyan-500/20",
        dot: "bg-cyan-500",
        accentBorder: "border-l-cyan-500",
      };
    case "blue":
    default:
      return {
        bg: "bg-blue-500/[0.08] dark:bg-blue-500/[0.12]",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-500/25 dark:border-blue-500/20",
        dot: "bg-blue-500",
        accentBorder: "border-l-blue-500",
      };
  }
}
