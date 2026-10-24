// ==============================================================================
// Company Brain: GitHub Continuous Sync & Webhook Processor
// Scoped to organization_id with external_discussions and integration_sync_logs
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { listPullRequests, listIssues, listRepositories } from "./client";
import { logger } from "@/lib/security/logger";

export interface SyncRepositoryResult {
  success: boolean;
  repoFullName: string;
  prsSynced: number;
  issuesSynced: number;
  failedCount: number;
  error?: string;
}

/**
 * Cryptographically verifies GitHub webhook HMAC SHA-256 signature using constant-time comparison.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  // GitHub sends "sha256=<hex_digest>"
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedDigest = parts[1];
  const calculatedDigest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (calculatedDigest.length !== expectedDigest.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedDigest, "hex"),
      Buffer.from(expectedDigest, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Synchronizes pull requests and issues for a specific repository into public.external_discussions.
 */
export async function syncGitHubRepository(
  organizationId: string,
  repoFullName: string,
  integrationId?: string
): Promise<SyncRepositoryResult> {
  const supabase = createServiceClient();
  const startTime = new Date();

  // 1. Create in-progress sync log
  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      integration_id: integrationId || null,
      provider: "github",
      sync_type: "repository_discussions",
      status: "in_progress",
      details: { repository: repoFullName },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let prsSynced = 0;
  let issuesSynced = 0;
  let failedCount = 0;

  try {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repository full name format: "${repoFullName}". Expected "owner/repo".`);
    }

    // Fetch PRs (recent 50) and Issues (recent 50)
    const [prs, issues] = await Promise.all([
      listPullRequests(organizationId, owner, repo, { per_page: 50, state: "all" }).catch((err) => {
        logger.warn("Failed to fetch PRs during GitHub sync", { repoFullName, error: err.message });
        return [];
      }),
      listIssues(organizationId, owner, repo, { per_page: 50, state: "all" }).catch((err) => {
        logger.warn("Failed to fetch issues during GitHub sync", { repoFullName, error: err.message });
        return [];
      }),
    ]);

    // Upsert PRs into external_discussions
    for (const pr of prs) {
      try {
        const externalId = `pr_${pr.number}`;
        const { error: upsertErr } = await supabase
          .from("external_discussions")
          .upsert(
            {
              organization_id: organizationId,
              provider: "github",
              external_id: externalId,
              channel_or_repo: repoFullName,
              title: pr.title,
              body: pr.body || null,
              author_name: pr.user?.login || "Unknown",
              author_avatar: pr.user?.avatar_url || null,
              external_url: pr.html_url,
              metadata: {
                type: "pull_request",
                number: pr.number,
                state: pr.state,
                draft: pr.draft,
                merged_at: pr.merged_at,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id, provider, external_id" }
          );

        if (upsertErr) {
          failedCount++;
        } else {
          prsSynced++;
        }
      } catch {
        failedCount++;
      }
    }

    // Upsert Issues into external_discussions
    for (const issue of issues) {
      try {
        const externalId = `issue_${issue.number}`;
        const { error: upsertErr } = await supabase
          .from("external_discussions")
          .upsert(
            {
              organization_id: organizationId,
              provider: "github",
              external_id: externalId,
              channel_or_repo: repoFullName,
              title: issue.title,
              body: issue.body || null,
              author_name: issue.user?.login || "Unknown",
              author_avatar: issue.user?.avatar_url || null,
              external_url: issue.html_url,
              metadata: {
                type: "issue",
                number: issue.number,
                state: issue.state,
                labels: issue.labels?.map((l) => (typeof l === "string" ? l : l.name)) || [],
                comments_count: (issue as any).comments || 0,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id, provider, external_id" }
          );

        if (upsertErr) {
          failedCount++;
        } else {
          issuesSynced++;
        }
      } catch {
        failedCount++;
      }
    }

    // Update sync log to completed
    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: failedCount > 0 ? "partial" : "completed",
          items_synced: prsSynced + issuesSynced,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          details: {
            repository: repoFullName,
            prsSynced,
            issuesSynced,
            durationMs: Date.now() - startTime.getTime(),
          },
        })
        .eq("id", logId);
    }

    return {
      success: true,
      repoFullName,
      prsSynced,
      issuesSynced,
      failedCount,
    };
  } catch (err: any) {
    logger.error("GitHub sync failed for repository", err, { organizationId, repoFullName });

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: "failed",
          items_synced: prsSynced + issuesSynced,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          error_message: err.message || "Unknown error during sync",
        })
        .eq("id", logId);
    }

    return {
      success: false,
      repoFullName,
      prsSynced,
      issuesSynced,
      failedCount,
      error: err.message,
    };
  }
}

/**
 * Synchronizes all accessible repositories for an organization.
 */
export async function syncAllConnectedGitHubRepositories(
  organizationId: string
): Promise<{ totalRepos: number; successfulRepos: number; totalEntities: number }> {
  const supabase = createServiceClient();

  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("provider", "github")
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) {
    throw new Error("GitHub integration is not connected for this organization.");
  }

  // Get repositories to sync
  const repos = await listRepositories(organizationId, { per_page: 20 });
  let successfulRepos = 0;
  let totalEntities = 0;

  for (const repo of repos.slice(0, 5)) {
    const res = await syncGitHubRepository(organizationId, repo.full_name, integration.id);
    if (res.success) {
      successfulRepos++;
      totalEntities += res.prsSynced + res.issuesSynced;
    }
  }

  // Update integration last_sync_at
  await supabase
    .from("organization_integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integration.id);

  return {
    totalRepos: repos.length,
    successfulRepos,
    totalEntities,
  };
}

/**
 * Handles incoming real-time GitHub webhook events (pull_request, issues, push).
 */
export async function processGitHubWebhookEvent(
  event: string,
  payload: any
): Promise<{ processed: boolean; reason?: string }> {
  const supabase = createServiceClient();
  const repoFullName = payload.repository?.full_name;

  if (!repoFullName) {
    return { processed: false, reason: "No repository full_name in payload." };
  }

  // Find all organizations that have connected GitHub
  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("id, organization_id, provider_account_id, metadata")
    .eq("provider", "github")
    .eq("status", "connected");

  if (!integrations || integrations.length === 0) {
    return { processed: false, reason: "No connected GitHub integrations found." };
  }

  const repoOwner = repoFullName.split("/")[0]?.toLowerCase();

  // Match organization strictly by selected_repositories or matching account login/id
  const matchingOrgs = integrations.filter((integ) => {
    const meta = (integ.metadata as any) || {};
    if (meta.selected_repositories && Array.isArray(meta.selected_repositories)) {
      return meta.selected_repositories.includes(repoFullName);
    }
    const accountLogin = (meta.github_login || meta.account_login || integ.provider_account_id || "").toLowerCase();
    return Boolean(repoOwner && accountLogin && accountLogin === repoOwner);
  });

  if (matchingOrgs.length === 0) {
    return { processed: false, reason: "No organization matched repository." };
  }

  let processedCount = 0;

  for (const org of matchingOrgs) {
    const orgId = org.organization_id;

    if (event === "pull_request") {
      const pr = payload.pull_request;
      if (pr) {
        await supabase.from("external_discussions").upsert(
          {
            organization_id: orgId,
            provider: "github",
            external_id: `pr_${pr.number}`,
            channel_or_repo: repoFullName,
            title: pr.title,
            body: pr.body || null,
            author_name: pr.user?.login || "Unknown",
            author_avatar: pr.user?.avatar_url || null,
            external_url: pr.html_url,
            metadata: {
              type: "pull_request",
              action: payload.action,
              number: pr.number,
              state: pr.state,
              draft: pr.draft,
              merged: pr.merged,
              updated_at: pr.updated_at,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, provider, external_id" }
        );
        processedCount++;
      }
    } else if (event === "issues") {
      const issue = payload.issue;
      if (issue) {
        await supabase.from("external_discussions").upsert(
          {
            organization_id: orgId,
            provider: "github",
            external_id: `issue_${issue.number}`,
            channel_or_repo: repoFullName,
            title: issue.title,
            body: issue.body || null,
            author_name: issue.user?.login || "Unknown",
            author_avatar: issue.user?.avatar_url || null,
            external_url: issue.html_url,
            metadata: {
              type: "issue",
              action: payload.action,
              number: issue.number,
              state: issue.state,
              updated_at: issue.updated_at,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, provider, external_id" }
        );
        processedCount++;
      }
    }
  }

  return { processed: processedCount > 0, reason: `Processed for ${processedCount} entities.` };
}
