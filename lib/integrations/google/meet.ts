// ==============================================================================
// Company Brain: Google Meet & Calendar Metadata Ingestion
// Fetches conferenceData, attendees, and summaries, and syncs into external_discussions
// ==============================================================================

import { getAuthenticatedGoogleClient } from "./client";
import { logger } from "@/lib/security/logger";
import { createServiceClient } from "@/lib/supabase/server";

export interface GoogleMeetEvent {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  conferenceData?: {
    conferenceId?: string;
    entryPoints?: Array<{ entryPointType: string; uri: string; label?: string }>;
  };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  htmlLink?: string;
}

/**
 * Lists Calendar events with Google Meet conference data.
 */
export async function listGoogleMeetEvents(
  organizationId: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    accountEmail?: string;
  }
): Promise<GoogleMeetEvent[]> {
  const client = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail: options?.accountEmail,
    service: "google_calendar",
    requiredScope: "calendar",
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    calendarId: "primary",
    singleEvents: "true",
    orderBy: "startTime",
    conferenceDataVersion: "1",
    timeMin: options?.timeMin || thirtyDaysAgo.toISOString(),
    maxResults: String(options?.maxResults || 50),
  });

  if (options?.timeMax) {
    params.set("timeMax", options.timeMax);
  }

  const res = await client.googleFetch(
    `/calendar/v3/calendars/primary/events?${params.toString()}`
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    logger.error("Failed to list Google Calendar events", { status: res.status, errorText });
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  const items: GoogleMeetEvent[] = data.items || [];

  // Filter to events that have Google Meet conference data or video links
  return items.filter(
    (event) =>
      Boolean(event.conferenceData?.entryPoints?.some((ep) => ep.entryPointType === "video")) ||
      Boolean(event.description?.includes("meet.google.com"))
  );
}

/**
 * Synchronizes Google Meet events into public.external_discussions.
 */
export async function syncGoogleMeetEvents(
  organizationId: string,
  accountEmail?: string
): Promise<{ syncedCount: number; failedCount: number }> {
  const supabase = createServiceClient();
  const startTime = new Date();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "google",
      sync_type: "meet_meetings",
      status: "in_progress",
      details: { accountEmail },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const events = await listGoogleMeetEvents(organizationId, { accountEmail, maxResults: 50 });

    for (const event of events) {
      try {
        const videoEntryPoint = event.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === "video"
        );
        const meetUrl = videoEntryPoint?.uri || event.htmlLink || null;
        const attendeesSummary =
          event.attendees?.map((a) => a.displayName || a.email).join(", ") || "No attendees";

        await supabase.from("external_discussions").upsert(
          {
            organization_id: organizationId,
            provider: "google_meet",
            external_id: event.id,
            channel_or_repo: "Google Calendar",
            title: event.summary || "Untitled Meeting",
            body: event.description || `Meeting with ${attendeesSummary}`,
            author_name: event.attendees?.[0]?.displayName || event.attendees?.[0]?.email || "Host",
            external_url: meetUrl,
            metadata: {
              conferenceId: event.conferenceData?.conferenceId,
              start: event.start?.dateTime || event.start?.date,
              end: event.end?.dateTime || event.end?.date,
              attendeesCount: event.attendees?.length || 0,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, provider, external_id" }
        );
        syncedCount++;
      } catch (eventErr: any) {
        logger.warn("Failed to sync Meet event", { eventId: event.id, error: eventErr.message });
        failedCount++;
      }
    }

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: failedCount > 0 ? "partial" : "completed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          details: { durationMs: Date.now() - startTime.getTime() },
        })
        .eq("id", logId);
    }

    return { syncedCount, failedCount };
  } catch (err: any) {
    logger.error("Failed Google Meet sync", err, { organizationId });

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: "failed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          error_message: err.message,
        })
        .eq("id", logId);
    }

    throw err;
  }
}
