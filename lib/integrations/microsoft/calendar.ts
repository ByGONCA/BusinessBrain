import { getAuthenticatedMicrosoftClient } from "./client";

export interface OutlookCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  htmlLink?: string;
  teamsLink?: string;
  isAllDay?: boolean;
  status?: string;
}

export interface CreateOutlookCalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: string[];
  isAllDay?: boolean;
  createTeamsLink?: boolean;
  userId?: string;
}

/**
 * Lists upcoming calendar events from Microsoft Graph for the authenticated organization.
 */
export async function listOutlookCalendarEvents(
  organizationId: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    userId?: string;
  }
): Promise<OutlookCalendarEvent[]> {
  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, { userId: options?.userId });

  const startIso = options?.timeMin || new Date().toISOString();
  // Default to 60 days ahead if timeMax is not supplied
  const endIso =
    options?.timeMax ||
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams();
  params.set("startDateTime", startIso);
  params.set("endDateTime", endIso);
  params.set("$top", String(options?.maxResults || 50));
  params.set("$orderby", "start/dateTime asc");
  params.set(
    "$select",
    "id,subject,bodyPreview,start,end,isAllDay,location,webLink,onlineMeeting,isOnlineMeeting"
  );

  const response = await microsoftFetch(`/me/calendarview?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft Graph Calendar list failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      location?: { displayName?: string };
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      isAllDay?: boolean;
      webLink?: string;
      isOnlineMeeting?: boolean;
      onlineMeeting?: { joinUrl?: string };
    }>;
  };

  const items = data.value || [];

  return items.map((evt) => ({
    id: evt.id,
    summary: evt.subject || "(Sem Título)",
    description: evt.bodyPreview,
    location: evt.location?.displayName,
    start: evt.start,
    end: evt.end,
    isAllDay: !!evt.isAllDay,
    htmlLink: evt.webLink,
    teamsLink: evt.onlineMeeting?.joinUrl,
  }));
}

/**
 * Creates an event in Microsoft Outlook, optionally generating an automatic Microsoft Teams link.
 */
export async function createOutlookCalendarEvent(
  organizationId: string,
  input: CreateOutlookCalendarEventInput
): Promise<OutlookCalendarEvent> {
  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, { userId: input.userId });

  const bodyPayload: Record<string, unknown> = {
    subject: input.summary,
    body: {
      contentType: "HTML",
      content: input.description || "",
    },
    start: {
      dateTime: input.start.dateTime,
      timeZone: input.start.timeZone || "UTC",
    },
    end: {
      dateTime: input.end.dateTime,
      timeZone: input.end.timeZone || "UTC",
    },
    isAllDay: !!input.isAllDay,
  };

  if (input.location) {
    bodyPayload.location = {
      displayName: input.location,
    };
  }

  if (input.attendees && input.attendees.length > 0) {
    bodyPayload.attendees = input.attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    }));
  }

  // Provision Microsoft Teams online meeting if requested
  if (input.createTeamsLink) {
    bodyPayload.isOnlineMeeting = true;
    bodyPayload.onlineMeetingProvider = "teamsForBusiness";
  }

  const response = await microsoftFetch("/me/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft Graph create event failed (${response.status}): ${errorText}`);
  }

  const created = (await response.json()) as {
    id: string;
    subject?: string;
    bodyPreview?: string;
    location?: { displayName?: string };
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
    isAllDay?: boolean;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
  };

  return {
    id: created.id,
    summary: created.subject || input.summary,
    description: created.bodyPreview,
    location: created.location?.displayName || input.location,
    start: created.start,
    end: created.end,
    isAllDay: !!created.isAllDay,
    htmlLink: created.webLink,
    teamsLink: created.onlineMeeting?.joinUrl,
  };
}

/**
 * Deletes an event in Microsoft Outlook.
 */
export async function deleteOutlookCalendarEvent(
  organizationId: string,
  eventId: string,
  userId?: string
): Promise<void> {
  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, { userId });

  const response = await microsoftFetch(`/me/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errorText = await response.text();
    throw new Error(`Microsoft Graph delete event failed (${response.status}): ${errorText}`);
  }
}
