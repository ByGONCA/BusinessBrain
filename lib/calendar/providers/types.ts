export type ExternalCalendarProvider = "google_calendar" | "outlook_calendar";

export interface NormalizedExternalEvent {
  id: string;
  externalId: string;
  provider: ExternalCalendarProvider;
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  allDay: boolean;
  meetingLink?: string; // Google Meet or Microsoft Teams
  htmlLink?: string;
  attendees?: string[];
}

export interface CreateExternalEventParams {
  summary: string;
  description?: string;
  location?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  allDay?: boolean;
  attendees?: string[];
  createMeetingLink?: boolean;
}
