import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TimelineEvent, TimelineCategory, TimelineImportanceTier } from "./types";

/**
 * Deterministically queries actual company events from the database for the active organization.
 * Fetches organization foundation, subscriptions, team members, teams, integrations, decisions,
 * projects, goals, meetings, calendar events, pages, and key activity history.
 *
 * Implements a strict importance hierarchy:
 * - Major: Foundation, plan activations, owner/first member, all strategic decisions,
 *          all projects, goals, teams established, and primary integrations.
 * - Normal: Additional team members, standard documents, meetings, calendar events.
 * - Minor: Tasks and routine entity status updates.
 *
 * Queries are partitioned to ensure high-value strategic milestones are never truncated
 * by high-volume routine tasks or activities.
 *
 * Memoized per request using React.cache().
 */
export const getCompanyTimelineEvents = cache(
  async (organizationId: string): Promise<TimelineEvent[]> => {
    const supabase = await createClient();
    const events: TimelineEvent[] = [];

    // Query all relevant tenant data concurrently in a single roundtrip.
    // Partition company_entities so strategic items (decisions, projects, goals)
    // are never displaced by routine tasks.
    const [
      { data: org },
      { data: members },
      { data: sub },
      { data: integrations },
      { data: teams },
      { data: calendarEvents },
      { data: strategicEntities },
      { data: operationalEntities },
      { data: pages },
      { data: activities },
    ] = await Promise.all([
      // 1. Organization info & foundation
      supabase
        .from("organizations")
        .select("id, name, slug, created_at, created_by")
        .eq("id", organizationId)
        .single(),

      // 2. Members joining
      supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),

      // 3. Billing & subscription milestones
      supabase
        .from("subscriptions")
        .select("id, plan, status, trial_start, trial_end, created_at")
        .eq("organization_id", organizationId)
        .maybeSingle(),

      // 4. Connected integrations (all entries for complete history)
      supabase
        .from("organization_integrations")
        .select("id, provider, account_email, created_at, status")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),

      // 5. Teams created
      supabase
        .from("organization_teams")
        .select("id, name, description, created_by, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),

      // 6. Organization calendar events
      supabase
        .from("organization_calendar_events")
        .select("id, title, description, start_time, tag, created_by_user_id, created_at")
        .eq("organization_id", organizationId)
        .order("start_time", { ascending: false })
        .limit(150),

      // 7. Strategic entities (decisions, projects, goals, milestones) — high limit so none are lost
      supabase
        .from("company_entities")
        .select("id, type, title, content, metadata, created_by, created_at, updated_at")
        .eq("organization_id", organizationId)
        .in("type", ["decision", "project", "goal", "milestone"])
        .order("created_at", { ascending: false })
        .limit(500),

      // 8. Operational entities (meetings, documents, tasks)
      supabase
        .from("company_entities")
        .select("id, type, title, content, metadata, created_by, created_at, updated_at")
        .eq("organization_id", organizationId)
        .in("type", ["meeting", "document", "task"])
        .order("created_at", { ascending: false })
        .limit(300),

      // 9. Notion-like workspace knowledge pages
      supabase
        .from("pages")
        .select("id, title, icon, is_favorite, created_by, created_at")
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200),

      // 10. Meaningful entity activities
      supabase
        .from("entity_activity")
        .select("id, entity_id, actor_id, actor_name, action, changes, metadata, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(150),
    ]);

    // Gather all user IDs to resolve author profiles in a single query
    const userIds = new Set<string>();
    if (org?.created_by) userIds.add(org.created_by);
    if (members) {
      for (const m of members) {
        if (m.user_id) userIds.add(m.user_id);
      }
    }
    if (teams) {
      for (const t of teams) {
        if (t.created_by) userIds.add(t.created_by);
      }
    }
    if (calendarEvents) {
      for (const ce of calendarEvents) {
        if (ce.created_by_user_id) userIds.add(ce.created_by_user_id);
      }
    }
    if (strategicEntities) {
      for (const e of strategicEntities) {
        if (e.created_by) userIds.add(e.created_by);
      }
    }
    if (operationalEntities) {
      for (const e of operationalEntities) {
        if (e.created_by) userIds.add(e.created_by);
      }
    }
    if (pages) {
      for (const p of pages) {
        if (p.created_by) userIds.add(p.created_by);
      }
    }
    if (activities) {
      for (const a of activities) {
        if (a.actor_id) userIds.add(a.actor_id);
      }
    }

    const profileMap = new Map<
      string,
      { id: string; email?: string; full_name?: string; avatar_url?: string }
    >();

    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", Array.from(userIds));

      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, p);
        }
      }
    }

    const resolveAuthor = (userId?: string | null, fallbackName?: string) => {
      if (!userId) {
        return fallbackName ? { name: fallbackName } : undefined;
      }
      const profile = profileMap.get(userId);
      const name =
        profile?.full_name ||
        fallbackName ||
        (profile?.email ? profile.email.split("@")[0] : "Team Member");
      return {
        id: userId,
        name,
        email: profile?.email,
        avatarUrl: profile?.avatar_url,
      };
    };

    // 1. Organization Foundation Milestone (Tier: major)
    if (org) {
      events.push({
        id: `org-founded-${org.id}`,
        type: "company_founded",
        category: "milestone",
        importance: "major",
        title: `${org.name} founded`,
        description: `Company workspace established with slug /${org.slug}.`,
        timestamp: org.created_at,
        author: resolveAuthor(org.created_by, "Founder"),
        metadata: {
          slug: org.slug,
          organizationId: org.id,
        },
        link: {
          label: "Workspace Settings",
          href: "/dashboard?settings=workspace",
        },
      });
    }

    // 2. Subscription & Trial Milestones (Tier: major)
    if (sub) {
      const isTrial = sub.status === "trialing" || !!sub.trial_start;
      const planName = sub.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : "Starter";

      events.push({
        id: `sub-activated-${sub.id}`,
        type: "plan_activated",
        category: "billing",
        importance: "major",
        title: isTrial
          ? `Free Trial Activated (${planName} Plan)`
          : `Subscribed to ${planName} Plan`,
        description: isTrial
          ? `Started free access trial for ${org?.name || "workspace"}.`
          : `Active subscription on the ${planName} plan.`,
        timestamp: sub.trial_start || sub.created_at,
        metadata: {
          plan: sub.plan,
          status: sub.status,
          trialEnd: sub.trial_end,
        },
        link: {
          label: "Manage Billing",
          href: "/dashboard?settings=billing",
        },
      });
    }

    // 3. Team Member Join Events (Tier: major for owner/first member, normal for others)
    if (members && members.length > 0) {
      members.forEach((m, idx) => {
        const isFirstOrOwner = idx === 0 || m.role === "owner" || m.role === "admin";
        const author = resolveAuthor(m.user_id) || { name: "Team Member" };
        const memberName = author.name || "Team Member";

        events.push({
          id: `member-joined-${m.id}`,
          type: "member_joined",
          category: "team",
          importance: isFirstOrOwner ? "major" : "normal",
          title: `${memberName} joined as ${m.role}`,
          description: `Added to ${org?.name || "the company"} workspace with ${m.role} permissions.`,
          timestamp: m.created_at,
          author: {
            ...author,
            role: m.role,
          },
          metadata: {
            role: m.role,
            email: author?.email,
          },
          link: {
            label: "Team Members",
            href: "/dashboard/people",
          },
        });
      });
    }

    // 4. Teams Created in Workspace (Tier: major)
    if (teams && teams.length > 0) {
      for (const t of teams) {
        events.push({
          id: `team-created-${t.id}`,
          type: "team_created",
          category: "team",
          importance: "major",
          title: `Team: ${t.name}`,
          description: t.description || `Organizational team "${t.name}" established in workspace.`,
          timestamp: t.created_at,
          author: resolveAuthor(t.created_by),
          metadata: {
            teamId: t.id,
            teamName: t.name,
          },
          link: {
            label: "View Teams",
            href: "/dashboard/people?tab=teams",
          },
        });
      }
    }

    // 5. Connected Integrations (Tier: major for core services, normal for standard)
    if (integrations && integrations.length > 0) {
      const providerNames: Record<string, string> = {
        gmail: "Gmail",
        google_calendar: "Google Calendar",
        google: "Google Workspace",
        outlook: "Microsoft Outlook",
        outlook_calendar: "Outlook Calendar",
        github: "GitHub",
        linear: "Linear",
        vercel: "Vercel",
        sentry: "Sentry",
        stripe: "Stripe",
        shopify: "Shopify",
        slack: "Slack",
      };

      const primaryProviders = new Set(["stripe", "github", "google", "linear", "vercel", "slack"]);

      for (const item of integrations) {
        const providerName =
          providerNames[item.provider] ||
          item.provider.charAt(0).toUpperCase() + item.provider.slice(1);

        const isPrimary = primaryProviders.has(item.provider.toLowerCase());

        events.push({
          id: `integration-${item.id}`,
          type: "integration_connected",
          category: "milestone",
          importance: isPrimary ? "major" : "normal",
          title: `Connected ${providerName}`,
          description: `Integration active for ${item.account_email || org?.name || "organization"}.`,
          timestamp: item.created_at,
          metadata: {
            provider: item.provider,
            accountEmail: item.account_email,
            status: item.status,
          },
          link: {
            label: "Integrations Settings",
            href: "/dashboard?settings=integrations",
          },
        });
      }
    }

    // 6. Strategic Company Entities (Decisions, Projects, Goals, Milestones) — Tier: major
    if (strategicEntities && strategicEntities.length > 0) {
      for (const entity of strategicEntities) {
        const author = resolveAuthor(entity.created_by);
        const meta = (entity.metadata || {}) as Record<string, unknown>;

        if (entity.type === "decision") {
          events.push({
            id: `entity-decision-${entity.id}`,
            type: "decision_recorded",
            category: "decision",
            importance: "major",
            title: `Decision: ${entity.title}`,
            description:
              entity.content ||
              "Strategic decision recorded in organizational memory.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "decision",
            metadata: meta,
            link: {
              label: "View Decision",
              href: "/dashboard/decisions",
            },
          });
        } else if (entity.type === "project") {
          events.push({
            id: `entity-project-${entity.id}`,
            type: "project_created",
            category: "project",
            importance: "major",
            title: `Project: ${entity.title}`,
            description: entity.content || "Key company project initiative established.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "project",
            metadata: meta,
            link: {
              label: "View Project",
              href: "/dashboard/projects",
            },
          });
        } else if (entity.type === "goal") {
          events.push({
            id: `entity-goal-${entity.id}`,
            type: "goal_created",
            category: "milestone",
            importance: "major",
            title: `Goal: ${entity.title}`,
            description: entity.content || "Strategic company goal established.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "goal",
            metadata: meta,
            link: {
              label: "View Goals",
              href: "/dashboard/goals",
            },
          });
        } else if (entity.type === "milestone") {
          events.push({
            id: `entity-milestone-${entity.id}`,
            type: "goal_created",
            category: "milestone",
            importance: "major",
            title: `Milestone: ${entity.title}`,
            description: entity.content || "Significant company milestone recorded.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "milestone",
            metadata: meta,
            link: {
              label: "View Milestones",
              href: "/dashboard",
            },
          });
        }
      }
    }

    // 7. Operational Company Entities (Meetings, Documents, Tasks) — Tier: normal / minor
    if (operationalEntities && operationalEntities.length > 0) {
      for (const entity of operationalEntities) {
        const author = resolveAuthor(entity.created_by);
        const meta = (entity.metadata || {}) as Record<string, unknown>;

        if (entity.type === "meeting") {
          events.push({
            id: `entity-meeting-${entity.id}`,
            type: "meeting_held",
            category: "work",
            importance: "normal",
            title: `Meeting: ${entity.title}`,
            description: entity.content || "Meeting recorded with team stakeholders.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "meeting",
            metadata: meta,
            link: {
              label: "View Calendar",
              href: "/dashboard/calendar",
            },
          });
        } else if (entity.type === "document") {
          const rawDocTitle = entity.title?.trim() || "";
          const isUntitledDoc =
            !rawDocTitle ||
            rawDocTitle.toLowerCase() === "untitled" ||
            rawDocTitle.toLowerCase() === "untitled document" ||
            rawDocTitle.toLowerCase() === "sem título";

          events.push({
            id: `entity-doc-${entity.id}`,
            type: "document_created",
            category: "memory",
            importance: isUntitledDoc ? "minor" : "normal",
            title: `Document: ${rawDocTitle || "Untitled Document"}`,
            description: entity.content || "Company documentation created.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "document",
            metadata: meta,
            link: {
              label: "View Document",
              href: "/dashboard/pages",
            },
          });
        } else if (entity.type === "task") {
          events.push({
            id: `entity-task-${entity.id}`,
            type: "task_completed",
            category: "work",
            importance: "minor",
            title: `Task: ${entity.title}`,
            description: entity.content || "Operational task recorded in workspace.",
            timestamp: entity.created_at,
            author,
            entityId: entity.id,
            entityType: "task",
            metadata: meta,
            link: {
              label: "View Tasks",
              href: "/dashboard/tasks",
            },
          });
        }
      }
    }

    // 8. Organization Calendar Events (Tier: major for Milestone tag, normal otherwise)
    if (calendarEvents && calendarEvents.length > 0) {
      for (const ce of calendarEvents) {
        const isMilestone = ce.tag?.toLowerCase() === "milestone" || ce.tag?.toLowerCase() === "all-hands";
        events.push({
          id: `calendar-event-${ce.id}`,
          type: "meeting_held",
          category: isMilestone ? "milestone" : "work",
          importance: isMilestone ? "major" : "normal",
          title: ce.title,
          description: ce.description || `Scheduled calendar event (${ce.tag || "General"}).`,
          timestamp: ce.start_time || ce.created_at,
          author: resolveAuthor(ce.created_by_user_id),
          entityId: ce.id,
          entityType: "calendar_event",
          metadata: {
            tag: ce.tag,
          },
          link: {
            label: "View Calendar",
            href: "/dashboard/calendar",
          },
        });
      }
    }

    // 9. Notion-like Workspace Pages (Tier: major for favorites, normal for standard named, minor for untitled)
    if (pages && pages.length > 0) {
      for (const page of pages) {
        const author = resolveAuthor(page.created_by);
        const icon = page.icon || "📄";
        const rawTitle = page.title?.trim() || "";
        const isUntitled =
          !rawTitle ||
          rawTitle.toLowerCase() === "untitled" ||
          rawTitle.toLowerCase() === "untitled document" ||
          rawTitle.toLowerCase() === "sem título";
        const pageTitle = rawTitle || "Untitled Document";

        events.push({
          id: `page-${page.id}`,
          type: "document_created",
          category: "memory",
          importance: isUntitled
            ? "minor"
            : page.is_favorite
            ? "major"
            : "normal",
          title: `${icon} ${pageTitle}`,
          description: "Workspace knowledge page established in KogSync memory.",
          timestamp: page.created_at,
          author,
          entityId: page.id,
          entityType: "page",
          metadata: {
            icon: page.icon,
            isFavorite: page.is_favorite,
            isUntitled,
          },
          link: {
            label: "Open Page",
            href: `/dashboard/pages/${page.id}`,
          },
        });
      }
    }

    // 10. Meaningful Entity Activity History (Tier: minor / routine)
    if (activities && activities.length > 0) {
      for (const act of activities) {
        const changes = (act.changes || {}) as Record<string, any>;
        const isStatusChange = act.action === "status_changed";
        const newStatus = changes.status?.new;

        // Capture completed/done actions, entity creations, or major status changes
        if (
          (isStatusChange && (newStatus === "completed" || newStatus === "done" || newStatus === "launched")) ||
          act.action === "entity_created"
        ) {
          const author = resolveAuthor(act.actor_id, act.actor_name || undefined);
          const actionLabel = isStatusChange
            ? `Status changed to ${newStatus}`
            : "Created an item";

          events.push({
            id: `activity-${act.id}`,
            type: "activity_recorded",
            category: "work",
            importance: "minor",
            title: `${act.actor_name || "Team member"}: ${actionLabel}`,
            description: `Activity recorded on workspace entity.`,
            timestamp: act.created_at,
            author,
            entityId: act.entity_id,
            entityType: "activity",
            metadata: {
              action: act.action,
              changes: act.changes,
            },
            link: {
              label: "View Timeline",
              href: "/dashboard/timeline",
            },
          });
        }
      }
    }

    // Deterministic deduplication by unique ID
    const seenIds = new Set<string>();
    const uniqueEvents: TimelineEvent[] = [];

    for (const ev of events) {
      if (!seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        uniqueEvents.push(ev);
      }
    }

    // Sort chronologically descending (most recent first)
    return uniqueEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
);
