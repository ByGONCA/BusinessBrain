"use server";

// ==============================================================================
// KogSync: Sentry Integration Server Actions (Multi-Tenant Authorization & UI)
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { decryptToken } from "@/lib/crypto/encryption";
import { SentryClient, SentryApiError } from "./client";
import { revokeSentryToken } from "./oauth";
import {
  SentryWorkspaceSnapshot,
  SentryProject,
  SentryIssue,
  SentryEventDetail,
  SentryIntegrationMetadata,
} from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Retrieves the full operational snapshot for Sentry in the active workspace.
 */
export async function getSentryWorkspaceSnapshotAction(
  targetOrgId?: string
): Promise<{ success: boolean; data?: SentryWorkspaceSnapshot; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    const organizationId = targetOrgId || activeOrg?.id;
    if (!organizationId) {
      return { success: false, error: "No active organization" };
    }

    // Verify tenant membership
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return { success: false, error: "Forbidden: Not an organization member" };
    }

    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("id, status, account_email, metadata, last_sync_at, created_at")
      .eq("organization_id", organizationId)
      .eq("provider", "sentry")
      .maybeSingle();

    if (!integration || integration.status === "disconnected") {
      return {
        success: true,
        data: {
          status: "disconnected",
          projects: [],
          recentIssues: [],
          totalUnresolvedCount: 0,
        },
      };
    }

    if (integration.status === "needs_reauth" || integration.status === "error") {
      return {
        success: true,
        data: {
          status: integration.status as any,
          connectedAccount: {
            email: integration.account_email || undefined,
            connectedAt: integration.created_at,
          },
          projects: [],
          recentIssues: [],
          totalUnresolvedCount: 0,
        },
      };
    }

    const metadata = (integration.metadata || {}) as SentryIntegrationMetadata;
    const orgSlug = metadata.sentry_org_slug;

    if (!orgSlug) {
      return {
        success: true,
        data: {
          status: "connected",
          connectedAccount: {
            email: integration.account_email || undefined,
            connectedAt: integration.created_at,
          },
          projects: [],
          recentIssues: [],
          totalUnresolvedCount: 0,
        },
      };
    }

    try {
      const client = await SentryClient.forOrganization(organizationId);
      const projects = await client.getProjects(orgSlug);

      const selectedProjectSlug = metadata.selected_project_slug || projects[0]?.slug;

      let recentIssues: SentryIssue[] = [];
      if (selectedProjectSlug) {
        const issuesRes = await client.getIssues({
          orgSlug,
          projectSlug: selectedProjectSlug,
          query: "is:unresolved",
          limit: 15,
        });
        recentIssues = issuesRes.issues;
      }

      return {
        success: true,
        data: {
          status: "connected",
          connectedAccount: {
            email: integration.account_email || undefined,
            organizationSlug: orgSlug,
            organizationName: metadata.sentry_org_name || orgSlug,
            connectedAt: integration.created_at,
          },
          projects,
          recentIssues,
          selectedProjectSlug,
          totalUnresolvedCount: recentIssues.length,
          lastSyncAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      if (err instanceof SentryApiError && (err.status === 401 || err.status === 403)) {
        await supabase
          .from("organization_integrations")
          .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
          .eq("id", integration.id);

        return {
          success: true,
          data: {
            status: "needs_reauth",
            connectedAccount: {
              email: integration.account_email || undefined,
              organizationSlug: orgSlug,
              connectedAt: integration.created_at,
            },
            projects: [],
            recentIssues: [],
            totalUnresolvedCount: 0,
          },
        };
      }

      logger.warn("Sentry snapshot fetch returned API warning", { error: String(err) });
      return {
        success: true,
        data: {
          status: "connected",
          connectedAccount: {
            email: integration.account_email || undefined,
            organizationSlug: orgSlug,
            organizationName: metadata.sentry_org_name || orgSlug,
            connectedAt: integration.created_at,
          },
          projects: [],
          recentIssues: [],
          totalUnresolvedCount: 0,
        },
      };
    }
  } catch (err: unknown) {
    logger.error("Failed to load Sentry workspace snapshot", err);
    return { success: false, error: "Failed to load Sentry snapshot." };
  }
}

/**
 * Queries issues for a specific Sentry project with pagination.
 */
export async function getSentryIssuesAction(params: {
  projectSlug?: string;
  query?: string;
  cursor?: string;
  targetOrgId?: string;
}): Promise<{ success: boolean; data?: { issues: SentryIssue[]; nextCursor?: string }; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    const organizationId = params.targetOrgId || activeOrg?.id;
    if (!organizationId) return { success: false, error: "No active organization" };

    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("metadata, status")
      .eq("organization_id", organizationId)
      .eq("provider", "sentry")
      .single();

    if (!integration || integration.status !== "connected") {
      return { success: false, error: "Sentry integration not connected." };
    }

    const metadata = (integration.metadata || {}) as SentryIntegrationMetadata;
    const orgSlug = metadata.sentry_org_slug;
    if (!orgSlug) return { success: false, error: "Sentry organization not configured." };

    const client = await SentryClient.forOrganization(organizationId);
    const result = await client.getIssues({
      orgSlug,
      projectSlug: params.projectSlug,
      query: params.query,
      cursor: params.cursor,
      limit: 25,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    logger.error("Failed to fetch Sentry issues", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Retrieves issue details and the latest event occurrence (stack traces, tags).
 */
export async function getSentryIssueDetailAction(
  issueId: string,
  targetOrgId?: string
): Promise<{ success: boolean; data?: { issue: SentryIssue; event: SentryEventDetail | null }; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    const organizationId = targetOrgId || activeOrg?.id;
    if (!organizationId) return { success: false, error: "No active organization" };

    const client = await SentryClient.forOrganization(organizationId);
    const [issue, event] = await Promise.all([
      client.getIssue(issueId),
      client.getLatestEvent(issueId),
    ]);

    return { success: true, data: { issue, event } };
  } catch (err: unknown) {
    logger.error("Failed to fetch Sentry issue detail", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Updates selected Sentry project in workspace metadata.
 */
export async function setSelectedSentryProjectAction(
  projectSlug: string,
  targetOrgId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    const organizationId = targetOrgId || activeOrg?.id;
    if (!organizationId) return { success: false, error: "No active organization" };

    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("id, metadata")
      .eq("organization_id", organizationId)
      .eq("provider", "sentry")
      .single();

    if (!integration) return { success: false, error: "Sentry integration not found." };

    const updatedMetadata = {
      ...(integration.metadata || {}),
      selected_project_slug: projectSlug,
    };

    await supabase
      .from("organization_integrations")
      .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
      .eq("id", integration.id);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Failed to update selected Sentry project", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Disconnects the Sentry integration: revokes tokens and updates status to 'disconnected'.
 */
export async function disconnectSentryAction(
  targetOrgId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    const organizationId = targetOrgId || activeOrg?.id;
    if (!organizationId) return { success: false, error: "No active organization" };

    const canDisconnect =
      activeOrg?.role === "owner" ||
      activeOrg?.role === "admin" ||
      (await hasPermission(user.id, organizationId, "integrations.disconnect"));

    if (!canDisconnect) {
      return { success: false, error: "Forbidden: Insufficient permissions to disconnect integrations." };
    }

    const rl = await rateLimit("disconnect-sentry", organizationId, RATE_LIMIT_PRESETS.MUTATIONS);
    if (!rl.success) {
      return { success: false, error: "Too many mutation attempts. Please try again shortly." };
    }

    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("id, encrypted_access_token, encrypted_refresh_token")
      .eq("organization_id", organizationId)
      .eq("provider", "sentry")
      .single();

    if (integration) {
      // Attempt token revocation with Sentry
      if (integration.encrypted_access_token) {
        try {
          const accessToken = decryptToken(integration.encrypted_access_token);
          await revokeSentryToken(accessToken);
        } catch {
          // Fall through
        }
      }

      await supabase
        .from("organization_integrations")
        .update({
          status: "disconnected",
          encrypted_access_token: null,
          encrypted_refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Failed to disconnect Sentry", err);
    return { success: false, error: "Failed to disconnect Sentry." };
  }
}
