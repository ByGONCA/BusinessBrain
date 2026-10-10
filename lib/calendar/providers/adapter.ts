import {
  ExternalCalendarProvider,
  NormalizedExternalEvent,
  CreateExternalEventParams,
} from "./types";
import {
  listGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/lib/integrations/google/calendar";
import {
  listOutlookCalendarEvents,
  createOutlookCalendarEvent,
  deleteOutlookCalendarEvent,
} from "@/lib/integrations/microsoft/calendar";
import { logger } from "@/lib/security/logger";

export interface CalendarRangeOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export interface CreatedExternalEventResult {
  id: string;
  meetingLink?: string | null;
  htmlLink?: string | null;
}

/**
 * Interface standard for external calendar adapters.
 * Ensures strict separation between BusinessBrain and third-party APIs.
 */
export interface CalendarAdapter {
  readonly provider: ExternalCalendarProvider;
  listEvents(
    organizationId: string,
    userId?: string,
    options?: CalendarRangeOptions
  ): Promise<NormalizedExternalEvent[]>;
  createEvent(
    organizationId: string,
    userId: string | undefined,
    params: CreateExternalEventParams
  ): Promise<CreatedExternalEventResult>;
  deleteEvent(
    organizationId: string,
    userId: string | undefined,
    eventId: string
  ): Promise<void>;
}

/**
 * Google Calendar Adapter
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider: ExternalCalendarProvider = "google_calendar";

  async listEvents(
    organizationId: string,
    userId?: string,
    options?: CalendarRangeOptions
  ): Promise<NormalizedExternalEvent[]> {
    try {
      const gcalEvents = await listGoogleCalendarEvents(organizationId, {
        timeMin: options?.timeMin,
        timeMax: options?.timeMax,
        maxResults: options?.maxResults || 50,
        userId,
      });

      return gcalEvents.map((evt) => {
        const start = evt.start?.dateTime || evt.start?.date || new Date().toISOString();
        const end =
          evt.end?.dateTime ||
          evt.end?.date ||
          new Date(new Date(start).getTime() + 45 * 60000).toISOString();
        const isAllDay = !evt.start?.dateTime && !!evt.start?.date;

        return {
          id: `gcal-${evt.id}`,
          externalId: evt.id,
          provider: "google_calendar",
          title: evt.summary || "Google Calendar Event",
          description: evt.description,
          location: evt.location,
          startTime: start,
          endTime: end,
          allDay: isAllDay,
          meetingLink: evt.hangoutLink || evt.htmlLink,
          htmlLink: evt.htmlLink,
          attendees: [],
        };
      });
    } catch (err: unknown) {
      const errDetails: Record<string, unknown> = {
        organizationId,
        userId,
      };

      if (err instanceof Error) {
        errDetails.name = err.name;
        errDetails.message = err.message;
        if ("status" in err && typeof (err as { status?: unknown }).status === "number") {
          errDetails.status = (err as { status?: number }).status;
        }
        if ("code" in err && (err as { code?: unknown }).code) {
          errDetails.code = (err as { code?: unknown }).code;
        }
      } else {
        errDetails.rawError = String(err);
      }

      logger.warn("GoogleCalendarAdapter: listEvents failed", errDetails);
      return [];
    }
  }

  async createEvent(
    organizationId: string,
    userId: string | undefined,
    params: CreateExternalEventParams
  ): Promise<CreatedExternalEventResult> {
    const isAllDay = !!params.allDay;
    const gcalEvent = await createGoogleCalendarEvent(organizationId, {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: isAllDay
        ? { date: params.startTime.split("T")[0] }
        : { dateTime: new Date(params.startTime).toISOString() },
      end: isAllDay
        ? { date: (params.endTime || params.startTime).split("T")[0] }
        : { dateTime: new Date(params.endTime).toISOString() },
      attendees: params.attendees,
      createMeetLink: params.createMeetingLink !== false,
      userId,
    });

    return {
      id: gcalEvent.id,
      meetingLink: gcalEvent.hangoutLink || gcalEvent.htmlLink || null,
      htmlLink: gcalEvent.htmlLink || null,
    };
  }

  async deleteEvent(
    organizationId: string,
    userId: string | undefined,
    eventId: string
  ): Promise<void> {
    await deleteGoogleCalendarEvent(organizationId, eventId, "primary", userId);
  }
}

/**
 * Outlook / Microsoft 365 Calendar Adapter
 */
export class OutlookCalendarAdapter implements CalendarAdapter {
  readonly provider: ExternalCalendarProvider = "outlook_calendar";

  async listEvents(
    organizationId: string,
    userId?: string,
    options?: CalendarRangeOptions
  ): Promise<NormalizedExternalEvent[]> {
    try {
      const outlookEvents = await listOutlookCalendarEvents(organizationId, {
        timeMin: options?.timeMin,
        timeMax: options?.timeMax,
        maxResults: options?.maxResults || 50,
        userId,
      });

      return outlookEvents.map((evt) => {
        const start = evt.start?.dateTime || new Date().toISOString();
        const end =
          evt.end?.dateTime ||
          new Date(new Date(start).getTime() + 45 * 60000).toISOString();

        return {
          id: `outlook-${evt.id}`,
          externalId: evt.id,
          provider: "outlook_calendar",
          title: evt.summary || "Outlook Calendar Event",
          description: evt.description,
          location: evt.location,
          startTime: start,
          endTime: end,
          allDay: !!evt.isAllDay,
          meetingLink: evt.teamsLink || evt.htmlLink,
          htmlLink: evt.htmlLink,
          attendees: [],
        };
      });
    } catch (err: unknown) {
      const errDetails: Record<string, unknown> = {
        organizationId,
        userId,
      };

      if (err instanceof Error) {
        errDetails.name = err.name;
        errDetails.message = err.message;
        if ("status" in err && typeof (err as { status?: unknown }).status === "number") {
          errDetails.status = (err as { status?: number }).status;
        }
        if ("code" in err && (err as { code?: unknown }).code) {
          errDetails.code = (err as { code?: unknown }).code;
        }
      } else {
        errDetails.rawError = String(err);
      }

      logger.warn("OutlookCalendarAdapter: listEvents failed", errDetails);
      return [];
    }
  }

  async createEvent(
    organizationId: string,
    userId: string | undefined,
    params: CreateExternalEventParams
  ): Promise<CreatedExternalEventResult> {
    const isAllDay = !!params.allDay;
    const outlookEvent = await createOutlookCalendarEvent(organizationId, {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: {
        dateTime: isAllDay
          ? `${params.startTime.split("T")[0]}T00:00:00`
          : new Date(params.startTime).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: isAllDay
          ? `${(params.endTime || params.startTime).split("T")[0]}T23:59:59`
          : new Date(params.endTime).toISOString(),
        timeZone: "UTC",
      },
      attendees: params.attendees,
      isAllDay,
      createTeamsLink: params.createMeetingLink !== false,
      userId,
    });

    return {
      id: outlookEvent.id,
      meetingLink: outlookEvent.teamsLink || outlookEvent.htmlLink || null,
      htmlLink: outlookEvent.htmlLink || null,
    };
  }

  async deleteEvent(
    organizationId: string,
    userId: string | undefined,
    eventId: string
  ): Promise<void> {
    await deleteOutlookCalendarEvent(organizationId, eventId, userId);
  }
}

/**
 * Provider Registry for external calendars.
 * Extensible for future providers (Apple iCloud, CalDAV, etc.).
 */
const adapters: Record<ExternalCalendarProvider, CalendarAdapter> = {
  google_calendar: new GoogleCalendarAdapter(),
  outlook_calendar: new OutlookCalendarAdapter(),
};

export function getCalendarAdapter(provider: ExternalCalendarProvider): CalendarAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unsupported external calendar provider: ${provider}`);
  }
  return adapter;
}
