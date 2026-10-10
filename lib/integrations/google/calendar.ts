import { getAuthenticatedGoogleClient } from "./client";
import { GoogleCalendarSummary, GoogleCalendarEvent } from "../types";

/**
 * Retrieves the user's available Google Calendars.
 */
export async function listGoogleCalendars(
  organizationId: string
): Promise<GoogleCalendarSummary[]> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    service: "google_calendar",
  });

  const response = await googleFetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar API list failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { items?: Array<{ id: string; summary?: string; description?: string; primary?: boolean; timeZone?: string }> };
  const items = data.items || [];

  return items.map((cal) => ({
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
    userId?: string;
  }
): Promise<GoogleCalendarEvent[]> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    userId: options?.userId,
    service: "google_calendar",
  });
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

  const data = (await response.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      htmlLink?: string;
      status?: string;
    }>;
  };
  const items = data.items || [];

  return items.map((evt) => ({
    id: evt.id,
    summary: evt.summary || "(No Title)",
    description: evt.description,
    location: evt.location,
    start: evt.start,
    end: evt.end,
    htmlLink: evt.htmlLink,
    hangoutLink: (evt as { hangoutLink?: string }).hangoutLink,
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
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    service: "google_calendar",
  });
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
    hangoutLink: evt.hangoutLink,
    status: evt.status,
  };
}

export interface CreateGoogleCalendarEventInput {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: string[];
  createMeetLink?: boolean;
  userId?: string;
}

/**
 * Creates an event in Google Calendar, optionally generating a free Google Meet conference link.
 */
export async function createGoogleCalendarEvent(
  organizationId: string,
  input: CreateGoogleCalendarEventInput
): Promise<GoogleCalendarEvent> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    userId: input.userId,
    service: "google_calendar",
  });
  const encodedCalId = encodeURIComponent(input.calendarId || "primary");

  const bodyPayload: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: input.start,
    end: input.end,
  };

  if (input.attendees && input.attendees.length > 0) {
    bodyPayload.attendees = input.attendees.map((email) => ({ email }));
  }

  if (input.createMeetLink) {
    bodyPayload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const queryParams = input.createMeetLink ? "?conferenceDataVersion=1" : "";
  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events${queryParams}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar create event failed (${response.status}): ${errText}`);
  }

  const created = (await response.json()) as {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    htmlLink?: string;
    hangoutLink?: string;
    status?: string;
  };

  return {
    id: created.id,
    summary: created.summary || input.summary,
    description: created.description,
    location: created.location,
    start: created.start,
    end: created.end,
    htmlLink: created.htmlLink,
    hangoutLink: created.hangoutLink,
    status: created.status,
  };
}

/**
 * Deletes an event in Google Calendar.
 */
export async function deleteGoogleCalendarEvent(
  organizationId: string,
  eventId: string,
  calendarId: string = "primary",
  userId?: string
): Promise<void> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    userId,
    service: "google_calendar",
  });
  const encodedCalId = encodeURIComponent(calendarId || "primary");
  const encodedEventId = encodeURIComponent(eventId);

  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${encodedEventId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errText = await response.text();
    throw new Error(`Google Calendar delete event failed (${response.status}): ${errText}`);
  }
}
