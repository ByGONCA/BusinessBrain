import { getAuthenticatedGoogleClient } from "./client";
import { GoogleCalendarSummary, GoogleCalendarEvent } from "../types";

/**
 * Retrieves the user's available Google Calendars.
 */
export async function listGoogleCalendars(
  organizationId: string
): Promise<GoogleCalendarSummary[]> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);

  const response = await googleFetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar API list failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((cal: any) => ({
    id: cal.id,
    summary: cal.summary || "Untitled Calendar",
    description: cal.description,
    primary: !!cal.primary,
    timeZone: cal.timeZone,
  }));
}

/**
 * Lists upcoming calendar events for a given calendar (defaults to primary calendar).
 */
export async function listGoogleCalendarEvents(
  organizationId: string,
  options?: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
): Promise<GoogleCalendarEvent[]> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);
  const calendarId = encodeURIComponent(options?.calendarId || "primary");

  const params = new URLSearchParams();
  params.set("singleEvents", "true");
  params.set("orderBy", "startTime");
  params.set("maxResults", String(options?.maxResults || 20));

  // Default to today if timeMin is not provided
  params.set("timeMin", options?.timeMin || new Date().toISOString());
  if (options?.timeMax) params.set("timeMax", options.timeMax);

  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar events list failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((evt: any) => ({
    id: evt.id,
    summary: evt.summary || "(No Title)",
    description: evt.description,
    location: evt.location,
    start: evt.start,
    end: evt.end,
    htmlLink: evt.htmlLink,
    status: evt.status,
  }));
}

/**
 * Retrieves details for a specific calendar event.
 */
export async function getGoogleCalendarEvent(
  organizationId: string,
  calendarId: string,
  eventId: string
): Promise<GoogleCalendarEvent> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);
  const encodedCalId = encodeURIComponent(calendarId || "primary");
  const encodedEventId = encodeURIComponent(eventId);

  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${encodedEventId}`
  );

  if (!response.ok) {
    throw new Error(`Google Calendar get event failed: ${response.statusText}`);
  }

  const evt = await response.json();

  return {
    id: evt.id,
    summary: evt.summary || "(No Title)",
    description: evt.description,
    location: evt.location,
    start: evt.start,
    end: evt.end,
    htmlLink: evt.htmlLink,
    status: evt.status,
  };
}
