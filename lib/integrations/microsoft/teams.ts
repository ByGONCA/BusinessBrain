// ==============================================================================
// KogSync: Microsoft Teams & Online Meetings Metadata Ingestion
// Fetches onlineMeeting data, attendees, summaries, and syncs into external_discussions
// ==============================================================================

import { getAuthenticatedMicrosoftClient } from "./client";
import { logger } from "@/lib/security/logger";
import { createServiceClient } from "@/lib/supabase/server";

export interface TeamsMeetingEvent {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  teamsLink?: string;
  attendees?: string[];
  htmlLink?: string;
}

/**
 * Lists Calendar events with Microsoft Teams online meeting conference links.
 */
export async function listTeamsMeetings(
  organizationId: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    accountEmail?: string;
  }
): Promise<TeamsMeetingEvent[]> {
  const client = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail: options?.accountEmail,
    service: "teams",
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startIso = options?.timeMin || thirtyDaysAgo.toISOString();
  const endIso =
    options?.timeMax || new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams();
  params.set("startDateTime", startIso);
  params.set("endDateTime", endIso);
  params.set("$top", String(options?.maxResults || 50));
  params.set("$orderby", "start/dateTime asc");
  params.set(
    "$select",
    "id,subject,bodyPreview,start,end,location,webLink,onlineMeeting,isOnlineMeeting,attendees"
  );

  const res = await client.microsoftFetch(`/me/calendarview?${params.toString()}`);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    logger.error("Failed to list Microsoft Teams calendar meetings", {
      status: res.status,
      errorText,
    });
    throw new Error(`Microsoft Teams Calendar API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      webLink?: string;
      isOnlineMeeting?: boolean;
      onlineMeeting?: { joinUrl?: string };
      attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
    }>;
  };

  const items = data.value || [];

  return items
    .filter((event) => Boolean(event.onlineMeeting?.joinUrl || event.isOnlineMeeting))
    .map((event) => ({
      id: event.id,
      summary: event.subject || "(Reunião Teams)",
      description: event.bodyPreview,
      start: event.start,
      end: event.end,
      teamsLink: event.onlineMeeting?.joinUrl,
      htmlLink: event.webLink,
      attendees: (event.attendees || [])
        .map((a) => a.emailAddress?.address || a.emailAddress?.name)
        .filter(Boolean) as string[],
    }));
}

/**
 * Synchronizes Microsoft Teams meetings into public.external_discussions.
 */
export async function syncTeamsMeetings(
  organizationId: string,
  accountEmail?: string
): Promise<{ syncedCount: number; failedCount: number; error?: string }> {
  const supabase = createServiceClient();
  const startTime = new Date();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "microsoft",
      sync_type: "teams_meetings",
      status: "in_progress",
      details: { accountEmail },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const meetings = await listTeamsMeetings(organizationId, {
      accountEmail,
      maxResults: 50,
    });

    for (const meeting of meetings) {
      try {
        const title = `[Teams Meeting] ${meeting.summary}`;
        const startTimeStr = meeting.start?.dateTime ? `Data/Hora: ${meeting.start.dateTime}` : "";
        const attendeesStr = meeting.attendees?.length
          ? `Participantes: ${meeting.attendees.join(", ")}`
          : "";
        const linkStr = meeting.teamsLink ? `Link: ${meeting.teamsLink}` : "";
        const bodyContent = [title, startTimeStr, attendeesStr, linkStr, meeting.description]
          .filter(Boolean)
          .join("\n\n");

        await supabase.from("external_discussions").upsert(
          {
            organization_id: organizationId,
            source_platform: "microsoft_teams",
            source_id: meeting.id,
            title,
            body: bodyContent,
            author_username: accountEmail || "Microsoft Teams",
            author_avatar_url: "/Logos/microsoft-teams.svg",
            external_url: meeting.teamsLink || meeting.htmlLink || null,
            discussion_type: "meeting",
            sync_status: "imported",
            metadata: {
              start: meeting.start,
              end: meeting.end,
              teamsLink: meeting.teamsLink,
              attendees: meeting.attendees,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, source_platform, source_id" }
        );
        syncedCount++;
      } catch (meetErr: any) {
        logger.warn("Failed to sync Teams meeting", { meetingId: meeting.id, error: meetErr.message });
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
    logger.error("Failed Microsoft Teams sync job", err, { organizationId });

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

    return { syncedCount, failedCount, error: err.message };
  }
}
