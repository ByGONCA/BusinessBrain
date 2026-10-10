"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import {
  CalendarEventItem,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarFilterOptions,
  CalendarEntityType,
  CalendarItemRelation,
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
import { getCalendarAdapter } from "./providers/adapter";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";

interface CompanyEntityRow {
  id: string;
  organization_id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Retrieves calendar events for the active organization.
 * Aggregates:
 * 1. organization_calendar_events (internal events)
 * 2. company_entities (meetings, tasks with deadlines, projects with target dates, goals)
 * 3. connected Google Calendar events on-demand
 * 4. company_connections (entity relations)
 *
 * Fully deterministic. Zero mock data. Zero AI calls.
 */
export async function getOrganizationCalendarEventsAction(
  optionsOrOrgId?: string | CalendarFilterOptions,
  legacyTagFilter?: string
): Promise<CalendarEventItem[]> {
  const options: CalendarFilterOptions =
    typeof optionsOrOrgId === "string"
      ? { explicitOrgId: optionsOrOrgId, tagFilter: legacyTagFilter }
      : optionsOrOrgId || {};

  const activeOrg = await getActiveOrganization();
  const orgId = options.explicitOrgId || activeOrg?.id;

  if (!orgId) return [];

  const supabase = await createClient();

  // Defense-in-depth: if explicitOrgId is provided and differs from active workspace, verify caller membership
  if (options.explicitOrgId && (!activeOrg || activeOrg.id !== options.explicitOrgId)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: member } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", options.explicitOrgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) return [];
  }

  const aggregatedEvents: CalendarEventItem[] = [];

  // 1. Fetch organization calendar events (bounded by active date range if provided)
  try {
    let calQuery = supabase
      .from("organization_calendar_events")
      .select("*")
      .eq("organization_id", orgId)
      .order("start_time", { ascending: true });

    if (options.timeMin) {
      calQuery = calQuery.gte("end_time", options.timeMin);
    }
    if (options.timeMax) {
      calQuery = calQuery.lte("start_time", options.timeMax);
    }

    if (options.tagFilter && options.tagFilter.trim() !== "" && options.tagFilter.toLowerCase() !== "all") {
      calQuery = calQuery.ilike("tag", options.tagFilter.trim());
    }

    const { data: dbEvents, error: dbError } = await calQuery;

    if (!dbError && dbEvents) {
      for (const row of dbEvents) {
        const isMeeting = (row.tag && row.tag.toLowerCase() === "meeting") || (row.source === "google_calendar");
        aggregatedEvents.push({
          id: row.id,
          organizationId: row.organization_id,
          title: row.title,
          description: row.description,
          startTime: row.start_time,
          endTime: row.end_time,
          allDay: !!row.all_day,
          tag: row.tag || "General",
          color: row.color || "blue",
          location: row.location,
          meetingLink: row.meeting_link,
          attendees: row.attendees || [],
          source: (row.source as CalendarEventItem["source"]) || "internal",
          externalEventId: row.external_event_id,
          entityType: isMeeting ? "meeting" : "event",
          entityId: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          relations: [],
        });
      }
    }
  } catch (err) {
    logger.warn("Could not query organization_calendar_events", { error: err });
  }

  // 2. Fetch company_entities (projecting only calendar-relevant columns, omitting heavy content bodies)
  try {
    const { data: entities, error: entError } = await supabase
      .from("company_entities")
      .select("id, organization_id, type, title, metadata, created_at, updated_at")
      .eq("organization_id", orgId)
      .in("type", ["meeting", "task", "project", "goal"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (!entError && entities) {
      for (const ent of entities as CompanyEntityRow[]) {
        const meta = ent.metadata || {};

        if (ent.type === "meeting") {
          const startTime =
            (meta.start_time as string) ||
            (meta.date as string) ||
            ent.created_at;
          const endTime =
            (meta.end_time as string) ||
            new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

          aggregatedEvents.push({
            id: `ent-meeting-${ent.id}`,
            organizationId: ent.organization_id,
            title: ent.title,
            description: ent.content || (meta.description as string) || null,
            startTime,
            endTime,
            allDay: !!meta.all_day,
            tag: (meta.tag as string) || "Meeting",
            color: (meta.color as string) || "purple",
            location: (meta.location as string) || null,
            meetingLink: (meta.meeting_link as string) || null,
            attendees: (meta.attendees as string[]) || [],
            source: "internal",
            entityType: "meeting",
            entityId: ent.id,
            status: (meta.status as string) || undefined,
            createdAt: ent.created_at,
            updatedAt: ent.updated_at,
            relations: [],
          });
        } else if (ent.type === "task") {
          const dueDate = (meta.due_date as string) || (meta.deadline as string);
          if (dueDate) {
            const isFullIso = dueDate.includes("T");
            const startTime = isFullIso ? dueDate : `${dueDate}T09:00:00.000Z`;
            const endTime = isFullIso ? dueDate : `${dueDate}T18:00:00.000Z`;

            aggregatedEvents.push({
              id: `ent-task-${ent.id}`,
              organizationId: ent.organization_id,
              title: ent.title,
              description: ent.content || (meta.description as string) || null,
              startTime,
              endTime,
              allDay: !isFullIso,
              tag: (meta.tag as string) || "Task",
              color: (meta.color as string) || "indigo",
              source: "internal",
              entityType: "task",
              entityId: ent.id,
              status: (meta.status as string) || "todo",
              priority: (meta.priority as "low" | "medium" | "high") || "medium",
              createdAt: ent.created_at,
              updatedAt: ent.updated_at,
              relations: [],
            });
          }
        } else if (ent.type === "project") {
          const targetDate =
            (meta.target_date as string) ||
            (meta.deadline as string) ||
            (meta.end_date as string);
          if (targetDate) {
            const isFullIso = targetDate.includes("T");
            const startTime = isFullIso ? targetDate : `${targetDate}T09:00:00.000Z`;
            const endTime = isFullIso ? targetDate : `${targetDate}T18:00:00.000Z`;

            aggregatedEvents.push({
              id: `ent-project-${ent.id}`,
              organizationId: ent.organization_id,
              title: ent.title,
              description: ent.content || (meta.description as string) || null,
              startTime,
              endTime,
              allDay: true,
              tag: (meta.tag as string) || "Project",
              color: (meta.color as string) || "rose",
              source: "internal",
              entityType: "project",
              entityId: ent.id,
              status: (meta.status as string) || "in_progress",
              createdAt: ent.created_at,
              updatedAt: ent.updated_at,
              relations: [],
            });
          }
        } else if (ent.type === "goal") {
          const targetDate = (meta.target_date as string) || (meta.due_date as string);
          if (targetDate) {
            const isFullIso = targetDate.includes("T");
            const startTime = isFullIso ? targetDate : `${targetDate}T09:00:00.000Z`;
            const endTime = isFullIso ? targetDate : `${targetDate}T18:00:00.000Z`;

            aggregatedEvents.push({
              id: `ent-goal-${ent.id}`,
              organizationId: ent.organization_id,
              title: ent.title,
              description: ent.content || (meta.description as string) || null,
              startTime,
              endTime,
              allDay: true,
              tag: (meta.tag as string) || "Goal",
              color: (meta.color as string) || "amber",
              source: "internal",
              entityType: "goal",
              entityId: ent.id,
              status: (meta.status as string) || "active",
              createdAt: ent.created_at,
              updatedAt: ent.updated_at,
              relations: [],
            });
          }
        }
      }
    }
  } catch (err) {
    logger.warn("Could not query company_entities for calendar", { error: err });
  }

  // 3. Attempt to merge live external calendar events on demand (Google & Outlook)
  try {
    const user = await getCurrentUser();
    const integrations = await getOrganizationIntegrations(orgId);

    // In page-specific calendar views, personal external calendars are omitted to prevent latency,
    // as only events explicitly linked via company_connections belong to the page.
    if (!options.pageId) {
      const externalPromises: Promise<void>[] = [];

      // 3A. Google Calendar
      // Privacy scoping: Only fetch personal external calendars if connected by current session user
      const googleIntegration = integrations.find(
        (i) =>
          (i.provider === "google_calendar" ||
            (i.provider === "google" && i.scopes?.some((s) => s.includes("calendar")))) &&
          i.status === "connected" &&
          (!i.connectedByUserId || i.connectedByUserId === user?.id)
      );

      if (googleIntegration) {
        externalPromises.push(
          (async () => {
            try {
              const googleAdapter = getCalendarAdapter("google_calendar");
              const gcalEvents = await googleAdapter.listEvents(orgId, user?.id, {
                maxResults: 50,
                timeMin: options.timeMin,
                timeMax: options.timeMax,
              });

              const existingExternalIds = new Set(
                aggregatedEvents.map((e) => e.externalEventId).filter(Boolean)
              );

              for (const evt of gcalEvents) {
                if (!existingExternalIds.has(evt.externalId)) {
                  aggregatedEvents.push({
                    id: evt.id,
                    organizationId: orgId,
                    title: evt.title,
                    description: evt.description || null,
                    startTime: evt.startTime,
                    endTime: evt.endTime,
                    allDay: evt.allDay,
                    tag: "Meeting",
                    color: "purple",
                    location: evt.location || null,
                    meetingLink: evt.meetingLink || evt.htmlLink || null,
                    attendees: evt.attendees || [],
                    source: "google_calendar",
                    externalEventId: evt.externalId,
                    entityType: "event",
                    entityId: evt.id,
                    relations: [],
                  });
                }
              }
            } catch (gcalErr: unknown) {
              const errDetails: Record<string, unknown> = {
                organizationId: orgId,
                userId: user?.id,
              };
              if (gcalErr instanceof Error) {
                errDetails.name = gcalErr.name;
                errDetails.message = gcalErr.message;
              } else {
                errDetails.rawError = String(gcalErr);
              }
              logger.warn("Google Calendar on-demand fetch failed (resilient isolation)", errDetails);
            }
          })()
        );
      }

      // 3B. Outlook / Microsoft 365 Calendar
      // Privacy scoping: Only fetch personal external calendars if connected by current session user
      const outlookIntegration = integrations.find(
        (i) =>
          (i.provider === "outlook_calendar" ||
            (i.provider === "outlook" && i.scopes?.some((s) => s.toLowerCase().includes("calendar")))) &&
          i.status === "connected" &&
          (!i.connectedByUserId || i.connectedByUserId === user?.id)
      );

      if (outlookIntegration) {
        externalPromises.push(
          (async () => {
            try {
              const outlookAdapter = getCalendarAdapter("outlook_calendar");
              const outlookEvents = await outlookAdapter.listEvents(orgId, user?.id, {
                maxResults: 50,
                timeMin: options.timeMin,
                timeMax: options.timeMax,
              });

              const existingExternalIds = new Set(
                aggregatedEvents.map((e) => e.externalEventId).filter(Boolean)
              );

              for (const evt of outlookEvents) {
                if (!existingExternalIds.has(evt.externalId)) {
                  aggregatedEvents.push({
                    id: evt.id,
                    organizationId: orgId,
                    title: evt.title,
                    description: evt.description || null,
                    startTime: evt.startTime,
                    endTime: evt.endTime,
                    allDay: evt.allDay,
                    tag: "Meeting",
                    color: "blue",
                    location: evt.location || null,
                    meetingLink: evt.meetingLink || evt.htmlLink || null,
                    attendees: evt.attendees || [],
                    source: "outlook_calendar",
                    externalEventId: evt.externalId,
                    entityType: "event",
                    entityId: evt.id,
                    relations: [],
                  });
                }
              }
            } catch (outlookErr: unknown) {
              const errDetails: Record<string, unknown> = {
                organizationId: orgId,
                userId: user?.id,
              };
              if (outlookErr instanceof Error) {
                errDetails.name = outlookErr.name;
                errDetails.message = outlookErr.message;
              } else {
                errDetails.rawError = String(outlookErr);
              }
              logger.warn("Outlook Calendar on-demand fetch failed (resilient isolation)", errDetails);
            }
          })()
        );
      }

      if (externalPromises.length > 0) {
        await Promise.allSettled(externalPromises);
      }
    }
  } catch (err) {
    logger.warn("Could not fetch external calendar events", { error: err });
  }

  // 4. Attach company connections (relations)
  const allEventIds = Array.from(
    new Set(
      aggregatedEvents
        .flatMap((e) => [e.id, e.entityId, e.externalEventId])
        .filter((id): id is string => !!id && id.trim() !== "")
    )
  );

  if (allEventIds.length > 0) {
    try {
      const { data: connections } = await supabase
        .from("company_connections")
        .select("source_id, source_type, source_title, target_id, target_type, target_title, relationship_type")
        .eq("organization_id", orgId)
        .in("source_id", allEventIds.slice(0, 150));

      if (connections && connections.length > 0) {
        const relationsMap = new Map<string, CalendarItemRelation[]>();
        for (const conn of connections) {
          const list = relationsMap.get(conn.source_id) || [];
          list.push({
            targetType: conn.target_type,
            targetId: conn.target_id,
            targetTitle: conn.target_title,
            relationshipType: conn.relationship_type,
          });
          relationsMap.set(conn.source_id, list);
        }

        for (const event of aggregatedEvents) {
          const matchingRelations =
            relationsMap.get(event.id) ||
            (event.entityId ? relationsMap.get(event.entityId) : undefined) ||
            (event.externalEventId ? relationsMap.get(event.externalEventId) : undefined);

          if (matchingRelations) {
            event.relations = matchingRelations;
          }
        }
      }
    } catch (err) {
      logger.warn("Could not load company_connections for calendar", { error: err });
    }
  }

  // 5. Apply deterministic filters
  let filtered = aggregatedEvents;

  if (options.pageId) {
    filtered = filtered.filter((e) =>
      e.relations?.some((r) => r.targetType === "page" && r.targetId === options.pageId)
    );
  }

  if (options.tagFilter && options.tagFilter.trim() !== "" && options.tagFilter.toLowerCase() !== "all") {
    const targetTag = options.tagFilter.trim().toLowerCase();
    filtered = filtered.filter((e) => e.tag.toLowerCase() === targetTag);
  }

  if (options.entityType && options.entityType !== "all") {
    filtered = filtered.filter((e) => e.entityType === options.entityType);
  }

  if (options.source && options.source !== "all") {
    filtered = filtered.filter((e) => e.source === options.source);
  }

  if (options.projectId) {
    filtered = filtered.filter((e) =>
      e.relations?.some(
        (r) => r.targetType === "project" && r.targetId === options.projectId
      )
    );
  }

  // Sort ascending by start time
  return filtered.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

/**
 * Creates a new calendar item (Event, Meeting, Task, Goal, or Project).
 * Saves to the canonical table matching its entity type.
 */
export async function createCalendarItemAction(
  input: CreateCalendarEventInput
): Promise<CalendarEventItem> {
  const user = await getCurrentUser();
  const activeOrg = await getActiveOrganization();
  const orgId = input.organizationId || activeOrg?.id;

  if (!orgId) {
    throw new Error("No active organization found to create calendar item.");
  }

  const destination = input.destination || "company";
  const entityType: CalendarEntityType = input.entityType || "event";
  const newId = crypto.randomUUID();
  const supabase = await createClient();

  let createdItem: CalendarEventItem;

  if (destination === "google") {
    // 1. CREATE ON GOOGLE CALENDAR (Source of Truth is Google)
    // ZERO insertion in organization_calendar_events!
    const adapter = getCalendarAdapter("google_calendar");
    const isMeeting = entityType === "meeting";
    const res = await adapter.createEvent(orgId, user?.id, {
      summary: input.title.trim() || (isMeeting ? "Nova Reunião" : "Novo Evento"),
      description: input.description?.trim(),
      location: input.location?.trim(),
      startTime: input.startTime,
      endTime: input.endTime || input.startTime,
      allDay: input.allDay,
      attendees: input.attendees,
      createMeetingLink: isMeeting || !input.meetingLink,
    });

    const eventId = `gcal-${res.id}`;

    createdItem = {
      id: eventId,
      organizationId: orgId,
      title: input.title.trim() || (isMeeting ? "Nova Reunião" : "Novo Evento"),
      description: input.description?.trim() || null,
      startTime: input.startTime,
      endTime: input.endTime || input.startTime,
      allDay: !!input.allDay,
      tag: input.tag?.trim() || (isMeeting ? "Meeting" : "General"),
      color: input.color || "purple",
      location: input.location?.trim() || null,
      meetingLink: res.meetingLink || input.meetingLink?.trim() || null,
      attendees: input.attendees || [],
      source: "google_calendar",
      externalEventId: res.id,
      entityType: isMeeting ? "meeting" : "event",
      entityId: eventId,
      relations: input.relations || [],
    };
  } else if (destination === "outlook") {
    // 2. CREATE ON OUTLOOK CALENDAR (Source of Truth is Microsoft)
    // ZERO insertion in organization_calendar_events!
    const adapter = getCalendarAdapter("outlook_calendar");
    const isMeeting = entityType === "meeting";
    const res = await adapter.createEvent(orgId, user?.id, {
      summary: input.title.trim() || (isMeeting ? "Nova Reunião" : "Novo Evento"),
      description: input.description?.trim(),
      location: input.location?.trim(),
      startTime: input.startTime,
      endTime: input.endTime || input.startTime,
      allDay: input.allDay,
      attendees: input.attendees,
      createMeetingLink: isMeeting || !input.meetingLink,
    });

    const eventId = `outlook-${res.id}`;

    createdItem = {
      id: eventId,
      organizationId: orgId,
      title: input.title.trim() || (isMeeting ? "Nova Reunião" : "Novo Evento"),
      description: input.description?.trim() || null,
      startTime: input.startTime,
      endTime: input.endTime || input.startTime,
      allDay: !!input.allDay,
      tag: input.tag?.trim() || (isMeeting ? "Meeting" : "General"),
      color: input.color || "blue",
      location: input.location?.trim() || null,
      meetingLink: res.meetingLink || input.meetingLink?.trim() || null,
      attendees: input.attendees || [],
      source: "outlook_calendar",
      externalEventId: res.id,
      entityType: isMeeting ? "meeting" : "event",
      entityId: eventId,
      relations: input.relations || [],
    };
  } else {
    // 3. CREATE NATIVE COMPANY OBJECT (Source of Truth is BusinessBrain/Supabase)
    if (entityType === "task") {
      const metadata: Record<string, unknown> = {
        due_date: input.startTime,
        priority: input.priority || "medium",
        status: input.status || "todo",
        tag: input.tag?.trim() || "Task",
        color: input.color || "indigo",
      };
      if (input.projectId) {
        metadata.project_id = input.projectId;
      }

      const { error } = await supabase.from("company_entities").insert({
        id: newId,
        organization_id: orgId,
        type: "task",
        title: input.title.trim() || "Nova Tarefa",
        content: input.description?.trim() || "",
        metadata,
        created_by: user?.id || null,
      });

      if (error) {
        logger.error("Failed to insert task company_entity", { error: error.message });
      }

      createdItem = {
        id: `ent-task-${newId}`,
        organizationId: orgId,
        title: input.title.trim() || "Nova Tarefa",
        description: input.description?.trim() || null,
        startTime: input.startTime,
        endTime: input.endTime || input.startTime,
        allDay: !!input.allDay,
        tag: input.tag?.trim() || "Task",
        color: input.color || "indigo",
        source: "internal",
        entityType: "task",
        entityId: newId,
        status: input.status || "todo",
        priority: input.priority || "medium",
        relations: input.relations || [],
      };
    } else if (entityType === "goal") {
      const metadata: Record<string, unknown> = {
        target_date: input.startTime,
        status: input.status || "active",
        tag: input.tag?.trim() || "Goal",
        color: input.color || "amber",
      };

      const { error } = await supabase.from("company_entities").insert({
        id: newId,
        organization_id: orgId,
        type: "goal",
        title: input.title.trim() || "Nova Meta",
        content: input.description?.trim() || "",
        metadata,
        created_by: user?.id || null,
      });

      if (error) {
        logger.error("Failed to insert goal company_entity", { error: error.message });
      }

      createdItem = {
        id: `ent-goal-${newId}`,
        organizationId: orgId,
        title: input.title.trim() || "Nova Meta",
        description: input.description?.trim() || null,
        startTime: input.startTime,
        endTime: input.endTime || input.startTime,
        allDay: true,
        tag: input.tag?.trim() || "Goal",
        color: input.color || "amber",
        source: "internal",
        entityType: "goal",
        entityId: newId,
        status: input.status || "active",
        relations: input.relations || [],
      };
    } else {
      const isMeeting = entityType === "meeting";
      const record = {
        id: newId,
        organization_id: orgId,
        created_by_user_id: user?.id || null,
        title: input.title.trim() || (isMeeting ? "Nova Reunião" : "Novo Evento"),
        description: input.description?.trim() || null,
        start_time: input.startTime,
        end_time: input.endTime || input.startTime,
        all_day: !!input.allDay,
        tag: input.tag?.trim() || (isMeeting ? "Meeting" : "General"),
        color: input.color || (isMeeting ? "purple" : "blue"),
        location: input.location?.trim() || null,
        meeting_link: input.meetingLink?.trim() || null,
        attendees: input.attendees || [],
        source: "internal",
      };

      const { error } = await supabase.from("organization_calendar_events").insert(record);
      if (error) {
        logger.error("Failed to insert organization_calendar_event", { error: error.message });
      }

      createdItem = {
        id: newId,
        organizationId: orgId,
        title: record.title,
        description: record.description,
        startTime: record.start_time,
        endTime: record.end_time,
        allDay: record.all_day,
        tag: record.tag,
        color: record.color,
        location: record.location,
        meetingLink: record.meeting_link,
        attendees: record.attendees,
        source: "internal",
        entityType: isMeeting ? "meeting" : "event",
        entityId: newId,
        relations: input.relations || [],
      };
    }
  }

  // Relations layer: Persist linked relations deterministically in company_connections
  const allRelations = [...(input.relations || [])];
  if (input.pageId && !allRelations.some((r) => r.targetType === "page" && r.targetId === input.pageId)) {
    allRelations.push({
      targetType: "page",
      targetId: input.pageId,
      targetTitle: "Página",
      relationshipType: "discussed_in",
    });
  }
  if (input.projectId && !allRelations.some((r) => r.targetType === "project" && r.targetId === input.projectId)) {
    allRelations.push({
      targetType: "project",
      targetId: input.projectId,
      targetTitle: "Projeto",
      relationshipType: "related_to",
    });
  }

  if (allRelations.length > 0) {
    for (const rel of allRelations) {
      await supabase.from("company_connections").upsert({
        organization_id: orgId,
        source_type: entityType === "task" || entityType === "goal" ? entityType : (entityType === "meeting" ? "meeting" : "block"),
        source_id: createdItem.id,
        source_title: createdItem.title,
        target_type: rel.targetType,
        target_id: rel.targetId,
        target_title: rel.targetTitle,
        relationship_type: rel.relationshipType || "related_to",
        created_by: user?.id || null,
      });
    }
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/pages");

  return createdItem;
}

/**
 * Backwards compatible alias for createCalendarItemAction
 */
export async function createCalendarEventAction(
  input: CreateCalendarEventInput
): Promise<CalendarEventItem> {
  return createCalendarItemAction(input);
}

/**
 * Updates an existing calendar item (in either organization_calendar_events or company_entities).
 */
export async function updateCalendarEventAction(
  eventId: string,
  input: UpdateCalendarEventInput
): Promise<void> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return;

  const supabase = await createClient();

  // Check if it's a company_entities record
  const cleanId = eventId.replace(/^ent-(meeting|task|project|goal)-/, "");

  if (isValidUuid(cleanId)) {
    const { data: entity } = await supabase
      .from("company_entities")
      .select("id, metadata, type")
      .eq("id", cleanId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (entity) {
      const existingMeta = (entity.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...existingMeta };

      if (input.startTime !== undefined) {
        if (entity.type === "task") updatedMeta.due_date = input.startTime;
        else if (entity.type === "goal" || entity.type === "project") updatedMeta.target_date = input.startTime;
        else updatedMeta.start_time = input.startTime;
      }
      if (input.endTime !== undefined) updatedMeta.end_time = input.endTime;
      if (input.tag !== undefined) updatedMeta.tag = input.tag.trim();
      if (input.color !== undefined) updatedMeta.color = input.color;
      if (input.status !== undefined) updatedMeta.status = input.status;
      if (input.priority !== undefined) updatedMeta.priority = input.priority;
      if (input.location !== undefined) updatedMeta.location = input.location.trim();
      if (input.meetingLink !== undefined) updatedMeta.meeting_link = input.meetingLink.trim();

      await supabase
        .from("company_entities")
        .update({
          title: input.title !== undefined ? input.title.trim() : undefined,
          content: input.description !== undefined ? input.description.trim() : undefined,
          metadata: updatedMeta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cleanId)
        .eq("organization_id", activeOrg.id);

      revalidatePath("/dashboard/calendar");
      revalidatePath("/dashboard/pages");
      return;
    }
  }

  // Update in organization_calendar_events
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.startTime !== undefined) updates.start_time = input.startTime;
  if (input.endTime !== undefined) updates.end_time = input.endTime;
  if (input.allDay !== undefined) updates.all_day = input.allDay;
  if (input.tag !== undefined) updates.tag = input.tag.trim();
  if (input.color !== undefined) updates.color = input.color;
  if (input.location !== undefined) updates.location = input.location?.trim() || null;
  if (input.meetingLink !== undefined) updates.meeting_link = input.meetingLink?.trim() || null;
  if (input.attendees !== undefined) updates.attendees = input.attendees;

  await supabase
    .from("organization_calendar_events")
    .update(updates)
    .eq("id", cleanId)
    .eq("organization_id", activeOrg.id);

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/pages");
}

/**
 * Deletes a calendar item from its respective table or external provider.
 */
export async function deleteCalendarEventAction(eventId: string): Promise<void> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return;

  const user = await getCurrentUser();
  const supabase = await createClient();

  // 1. If it's a direct Google Calendar event (e.g. gcal-...)
  if (eventId.startsWith("gcal-")) {
    const gcalId = eventId.replace(/^gcal-/, "");
    try {
      const adapter = getCalendarAdapter("google_calendar");
      await adapter.deleteEvent(activeOrg.id, user?.id, gcalId);
    } catch (gcalErr) {
      logger.warn("Could not delete from Google Calendar", { error: gcalErr });
    }

    // Clean up relations
    await supabase
      .from("company_connections")
      .delete()
      .eq("organization_id", activeOrg.id)
      .or(`source_id.eq.${eventId},target_id.eq.${eventId}`);

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/pages");
    return;
  }

  // 2. If it's a direct Outlook Calendar event (e.g. outlook-...)
  if (eventId.startsWith("outlook-")) {
    const outlookId = eventId.replace(/^outlook-/, "");
    try {
      const adapter = getCalendarAdapter("outlook_calendar");
      await adapter.deleteEvent(activeOrg.id, user?.id, outlookId);
    } catch (outlookErr) {
      logger.warn("Could not delete from Outlook Calendar", { error: outlookErr });
    }

    // Clean up relations
    await supabase
      .from("company_connections")
      .delete()
      .eq("organization_id", activeOrg.id)
      .or(`source_id.eq.${eventId},target_id.eq.${eventId}`);

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/pages");
    return;
  }

  const cleanId = eventId.replace(/^ent-(meeting|task|project|goal)-/, "");

  if (isValidUuid(cleanId)) {
    // If the local event was mirrored from/to an external provider, delete remotely as well
    const { data: calRow } = await supabase
      .from("organization_calendar_events")
      .select("external_event_id, source")
      .eq("id", cleanId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (calRow?.external_event_id) {
      if (calRow.source === "google_calendar") {
        try {
          const adapter = getCalendarAdapter("google_calendar");
          await adapter.deleteEvent(activeOrg.id, user?.id, calRow.external_event_id);
        } catch (gcalErr) {
          logger.warn("Could not delete external Google event", { error: gcalErr });
        }
      } else if (calRow.source === "outlook_calendar") {
        try {
          const adapter = getCalendarAdapter("outlook_calendar");
          await adapter.deleteEvent(activeOrg.id, user?.id, calRow.external_event_id);
        } catch (outlookErr) {
          logger.warn("Could not delete external Outlook event", { error: outlookErr });
        }
      }
    }

    await supabase
      .from("organization_calendar_events")
      .delete()
      .eq("id", cleanId)
      .eq("organization_id", activeOrg.id);

    await supabase
      .from("company_entities")
      .delete()
      .eq("id", cleanId)
      .eq("organization_id", activeOrg.id);

    await supabase
      .from("company_connections")
      .delete()
      .eq("organization_id", activeOrg.id)
      .or(`source_id.eq.${cleanId},target_id.eq.${cleanId},source_id.eq.${eventId},target_id.eq.${eventId}`);
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/pages");
}

/**
 * Returns available calendar destinations for the current user and active organization.
 */
export async function getConnectedCalendarDestinationsAction(): Promise<{
  hasCompany: boolean;
  hasGoogle: boolean;
  hasOutlook: boolean;
}> {
  const user = await getCurrentUser();
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return { hasCompany: true, hasGoogle: false, hasOutlook: false };

  const integrations = await getOrganizationIntegrations(activeOrg.id);
  const hasGoogle = integrations.some(
    (i) =>
      (i.provider === "google_calendar" || (i.provider === "google" && i.scopes?.some((s) => s.includes("calendar")))) &&
      i.status === "connected" &&
      (!i.connectedByUserId || i.connectedByUserId === user?.id)
  );
  const hasOutlook = integrations.some(
    (i) =>
      (i.provider === "outlook_calendar" || (i.provider === "outlook" && i.scopes?.some((s) => s.toLowerCase().includes("calendar")))) &&
      i.status === "connected" &&
      (!i.connectedByUserId || i.connectedByUserId === user?.id)
  );

  return {
    hasCompany: true,
    hasGoogle,
    hasOutlook,
  };
}

/**
 * Retrieves projects and pages for linking in the calendar relations picker.
 */
export async function getWorkspaceProjectsAndPagesAction(): Promise<{
  projects: Array<{ id: string; title: string }>;
  pages: Array<{ id: string; title: string; icon?: string }>;
}> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return { projects: [], pages: [] };

  const supabase = await createClient();

  const [projectsRes, pagesRes] = await Promise.all([
    supabase
      .from("company_entities")
      .select("id, title")
      .eq("organization_id", activeOrg.id)
      .eq("type", "project")
      .order("title", { ascending: true })
      .limit(50),
    supabase
      .from("pages")
      .select("id, title, icon")
      .eq("organization_id", activeOrg.id)
      .order("title", { ascending: true })
      .limit(50),
  ]);

  return {
    projects: (projectsRes.data || []) as Array<{ id: string; title: string }>,
    pages: (pagesRes.data || []) as Array<{ id: string; title: string; icon?: string }>,
  };
}

/**
 * Bridge function: creates a meeting or task deterministically from an email.
 * Preserves messageId and threadId in metadata without AI calls.
 */
export async function createMeetingOrTaskFromEmailAction(params: {
  messageId: string;
  threadId?: string;
  subject: string;
  sender?: string;
  date?: string;
  targetType: "meeting" | "task";
  description?: string;
  projectId?: string;
}): Promise<CalendarEventItem> {
  const now = new Date();
  const startTime = params.date || now.toISOString();
  const endTime = new Date(new Date(startTime).getTime() + 45 * 60000).toISOString();

  const relations: CalendarItemRelation[] = [];
  if (params.projectId) {
    relations.push({
      targetType: "project",
      targetId: params.projectId,
      targetTitle: "Associated Project",
      relationshipType: "related_to",
    });
  }

  return createCalendarItemAction({
    title: params.subject.trim() || (params.targetType === "meeting" ? "Reunião de Email" : "Tarefa de Email"),
    description: `${params.description ? `${params.description}\n\n` : ""}Origem: Email de ${params.sender || "remetente desconhecido"}\nMessage-ID: ${params.messageId}`,
    startTime,
    endTime,
    tag: params.targetType === "meeting" ? "Meeting" : "Task",
    color: params.targetType === "meeting" ? "purple" : "indigo",
    entityType: params.targetType,
    relations,
  });
}
