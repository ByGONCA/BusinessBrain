import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TimelineEvent } from "./types";

/**
 * Deterministically queries actual company events from the database for the active organization.
 * Memoized per request using React.cache().
 */
export const getCompanyTimelineEvents = cache(
  async (organizationId: string): Promise<TimelineEvent[]> => {
    const supabase = await createClient();
    const events: TimelineEvent[] = [];

    // Query foundation, members, subscription, and integrations concurrently in a single roundtrip
    const [
      { data: org },
      { data: members },
      { data: sub },
      { data: integrations },
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, created_at, created_by")
        .eq("id", organizationId)
        .single(),
      supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", organizationId),
      supabase
        .from("subscriptions")
        .select("id, plan, status, trial_start, trial_end, created_at")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_integrations")
        .select("id, provider, account_email, created_at, status")
        .eq("organization_id", organizationId)
        .eq("status", "connected"),
    ]);

    // 1. Organization Foundation Milestone
    if (org) {
      events.push({
        id: `org-founded-${org.id}`,
        type: "company_founded",
        category: "milestone",
        title: `${org.name} founded`,
        description: `Company workspace established with slug /${org.slug}.`,
        timestamp: org.created_at,
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

    // 2. Team Member Join Events
    if (members && members.length > 0) {
      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      for (const m of members) {
        const profile = profileMap.get(m.user_id);
        const memberName =
          profile?.full_name || profile?.email?.split("@")[0] || "Team Member";

        events.push({
          id: `member-joined-${m.id}`,
          type: "member_joined",
          category: "team",
          title: `${memberName} joined as ${m.role}`,
          description: `Added to ${org?.name || "the company"} workspace with ${m.role} permissions.`,
          timestamp: m.created_at,
          author: {
            id: m.user_id,
            name: memberName,
            email: profile?.email,
            role: m.role,
            avatarUrl: profile?.avatar_url,
          },
          metadata: {
            role: m.role,
            email: profile?.email,
          },
          link: {
            label: "Team Members",
            href: "/dashboard?settings=people",
          },
        });
      }
    }

    // 3. Subscription & Trial Milestones
    if (sub) {
      const isTrial = sub.status === "trialing" || !!sub.trial_start;
      const planName = sub.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : "Starter";

      events.push({
        id: `sub-activated-${sub.id}`,
        type: "plan_activated",
        category: "billing",
        title: isTrial
          ? `7-Day Free Trial Activated (${planName} Plan)`
          : `Subscribed to ${planName} Plan`,
        description: isTrial
          ? `Started 7-day full access trial for ${org?.name || "workspace"}.`
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

    // 4. Connected Integrations Milestones
    if (integrations && integrations.length > 0) {
      for (const item of integrations) {
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
        };
        const providerName =
          providerNames[item.provider] ||
          item.provider.charAt(0).toUpperCase() + item.provider.slice(1);

        events.push({
          id: `integration-${item.id}`,
          type: "integration_connected",
          category: "milestone",
          title: `Connected ${providerName}`,
          description: `Integration established for ${item.account_email || "organization"}.`,
          timestamp: item.created_at,
          metadata: {
            provider: item.provider,
            accountEmail: item.account_email,
          },
          link: {
            label: "Integrations Settings",
            href: "/dashboard?settings=integrations",
          },
        });
      }
    }

    // Sort chronologically ascending
    return events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
);
