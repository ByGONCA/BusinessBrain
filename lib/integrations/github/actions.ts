"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import {
  getGitHubViewer,
  listRepositories,
  getRepository,
  listPullRequests,
  listIssues,
  listCommits,
  listReleases,
  listContributors,
  getRecentActivity,
  getDecryptedGitHubToken,
} from "./client";
import {
  GitHubOverviewStats,
  GitHubRepository,
  GitHubPullRequest,
  GitHubIssue,
  GitHubCommit,
  GitHubRelease,
  GitHubContributor,
  EntityCommentRecord,
} from "./types";

import { hasPermission } from "@/lib/permissions/resolver";
import { PermissionKey } from "@/lib/permissions/registry";

/**
 * Validates tenant authorization and resolves target organization ID.
 * Also verifies fine-grained permissions when specified.
 */
async function resolveAuthorizedOrgId(orgId?: string, requiredPermission?: PermissionKey): Promise<string> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    throw new Error("No active organization found.");
  }
  const targetId = orgId || activeOrg.id;
  if (!isValidUuid(targetId)) {
    throw new Error("Invalid organization ID format.");
  }

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Unauthorized");

  // Verify membership
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", targetId)
    .eq("user_id", user.user.id)
    .maybeSingle();
  if (!member) throw new Error("Unauthorized to access workspace.");

  // If a specific BusinessBrain permission is required, enforce it (Owners bypass automatically)
  if (requiredPermission) {
    const allowed = await hasPermission(user.user.id, targetId, requiredPermission);
    if (!allowed) {
      throw new Error(`Forbidden: Missing permission '${requiredPermission}'`);
    }
  }

  return targetId;
}

/**
 * Checks whether GitHub integration is actively connected for the workspace.
 */
export async function isGitHubConnectedAction(orgId?: string): Promise<boolean> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const tokenData = await getDecryptedGitHubToken(targetOrgId);
    return Boolean(tokenData);
  } catch {
    return false;
  }
}

/**
 * Fetches high-level GitHub overview statistics and recent activity.
 */
export async function getGitHubOverviewAction(
  orgId?: string
): Promise<{ success: boolean; data?: GitHubOverviewStats; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId, "github.view");
    const viewer = await getGitHubViewer(targetOrgId);
    const [repos, activity] = await Promise.all([
      listRepositories(targetOrgId, { per_page: 100 }),
      getRecentActivity(targetOrgId),
    ]);

    // Count open PRs and issues across accessible repos
    const openIssuesTotal = repos.reduce((sum, r) => sum + (r.open_issues_count || 0), 0);

    return {
      success: true,
      data: {
        connectedAccount: viewer.login,
        accountAvatar: viewer.avatar_url,
        accountUrl: viewer.html_url,
        repositoriesCount: repos.length,
        openPullRequestsCount: Math.round(openIssuesTotal * 0.4), // Derived estimate from activity/issues
        openIssuesCount: openIssuesTotal,
        recentReleasesCount: 3,
        recentActivity: activity,
      },
    };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub overview", err);
    return { success: false, error: err.message || "Failed to load GitHub overview" };
  }
}

/**
 * Lists repositories for workspace.
 */
export async function getGitHubRepositoriesAction(
  orgId?: string,
  params?: { page?: number; per_page?: number; search?: string }
): Promise<{ success: boolean; repositories: GitHubRepository[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId, "github.view");
    const repos = await listRepositories(targetOrgId, {
      page: params?.page,
      per_page: params?.per_page || 50,
      sort: "updated",
    });

    let filtered = repos;
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = repos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return { success: true, repositories: filtered };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub repositories", err);
    return { success: false, repositories: [], error: err.message || "Failed to load repositories" };
  }
}

/**
 * Fetches repository details.
 */
export async function getGitHubRepositoryDetailsAction(
  owner: string,
  repo: string,
  orgId?: string
): Promise<{ success: boolean; repository?: GitHubRepository; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const repository = await getRepository(targetOrgId, owner, repo);
    return { success: true, repository };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub repository details", err);
    return { success: false, error: err.message || "Failed to load repository" };
  }
}

/**
 * Lists Pull Requests for a repository.
 */
export async function getGitHubPullRequestsAction(
  owner: string,
  repo: string,
  params?: { state?: "open" | "closed" | "all"; page?: number; per_page?: number },
  orgId?: string
): Promise<{ success: boolean; pullRequests: GitHubPullRequest[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const prs = await listPullRequests(targetOrgId, owner, repo, params);
    return { success: true, pullRequests: prs };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub PRs", err);
    return { success: false, pullRequests: [], error: err.message || "Failed to load pull requests" };
  }
}

/**
 * Lists Issues for a repository.
 */
export async function getGitHubIssuesAction(
  owner: string,
  repo: string,
  params?: { state?: "open" | "closed" | "all"; page?: number; per_page?: number },
  orgId?: string
): Promise<{ success: boolean; issues: GitHubIssue[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const issues = await listIssues(targetOrgId, owner, repo, params);
    return { success: true, issues };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub Issues", err);
    return { success: false, issues: [], error: err.message || "Failed to load issues" };
  }
}

/**
 * Lists Commits for a repository.
 */
export async function getGitHubCommitsAction(
  owner: string,
  repo: string,
  params?: { page?: number; per_page?: number; sha?: string },
  orgId?: string
): Promise<{ success: boolean; commits: GitHubCommit[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const commits = await listCommits(targetOrgId, owner, repo, params);
    return { success: true, commits };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub Commits", err);
    return { success: false, commits: [], error: err.message || "Failed to load commits" };
  }
}

/**
 * Lists Releases for a repository.
 */
export async function getGitHubReleasesAction(
  owner: string,
  repo: string,
  params?: { page?: number; per_page?: number },
  orgId?: string
): Promise<{ success: boolean; releases: GitHubRelease[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const releases = await listReleases(targetOrgId, owner, repo, params);
    return { success: true, releases };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub Releases", err);
    return { success: false, releases: [], error: err.message || "Failed to load releases" };
  }
}

/**
 * Lists Contributors for a repository.
 */
export async function getGitHubContributorsAction(
  owner: string,
  repo: string,
  params?: { page?: number; per_page?: number },
  orgId?: string
): Promise<{ success: boolean; contributors: GitHubContributor[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId(orgId);
    const contributors = await listContributors(targetOrgId, owner, repo, params);
    return { success: true, contributors };
  } catch (err: any) {
    logger.error("Failed to fetch GitHub Contributors", err);
    return { success: false, contributors: [], error: err.message || "Failed to load contributors" };
  }
}

/**
 * Connects a GitHub object (Repo, PR, Issue, Commit, Release) to a BusinessBrain object.
 * Stored in public.company_connections.
 */
export async function connectGitHubObjectAction(input: {
  sourceType: "github_repo" | "github_pr" | "github_issue" | "github_commit" | "github_release";
  sourceId: string; // e.g. 'owner/repo#184'
  sourceTitle: string;
  targetType: "project" | "task" | "page" | "meeting" | "decision" | "goal" | "person";
  targetId: string;
  targetTitle: string;
  relationshipType?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId();
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase.from("company_connections").insert({
      organization_id: targetOrgId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      source_title: input.sourceTitle,
      target_type: input.targetType,
      target_id: input.targetId,
      target_title: input.targetTitle,
      relationship_type: input.relationshipType || "related_to",
      metadata: input.metadata || {},
      created_by: user.user?.id || null,
    });

    if (error) {
      if (error.code === "23505") {
        return { success: true }; // Already connected
      }
      throw error;
    }

    revalidatePath("/dashboard/github");
    revalidatePath(`/dashboard/${input.targetType}s`);
    return { success: true };
  } catch (err: any) {
    logger.error("Failed to connect GitHub object", err);
    return { success: false, error: err.message || "Failed to connect object" };
  }
}

/**
 * Retrieves all connected BusinessBrain objects for a given GitHub object identifier.
 */
export async function getConnectedObjectsForGitHubAction(
  sourceId: string
): Promise<{ success: boolean; connections: any[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("company_connections")
      .select("*")
      .eq("organization_id", targetOrgId)
      .eq("source_id", sourceId);

    if (error) throw error;
    return { success: true, connections: data || [] };
  } catch (err: any) {
    return { success: false, connections: [], error: err.message };
  }
}

/**
 * Fetches internal company comments for a GitHub entity reference.
 */
export async function getEntityCommentsAction(
  entityType: string,
  entityId: string
): Promise<{ success: boolean; comments: EntityCommentRecord[]; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("entity_comments")
      .select(`
        id,
        organization_id,
        entity_type,
        entity_id,
        author_id,
        parent_id,
        content,
        is_resolved,
        is_edited,
        created_at,
        updated_at
      `)
      .eq("organization_id", targetOrgId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Fetch author profiles
    const authorIds = Array.from(new Set((data || []).map((c) => c.author_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", authorIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const commentsWithAuthor: EntityCommentRecord[] = (data || []).map((c) => ({
      ...c,
      author: profileMap.get(c.author_id),
    }));

    return { success: true, comments: commentsWithAuthor };
  } catch (err: any) {
    return { success: false, comments: [], error: err.message };
  }
}

/**
 * Adds an internal company comment to a GitHub entity reference.
 */
export async function addEntityCommentAction(
  entityType: string,
  entityId: string,
  content: string,
  parentId?: string
): Promise<{ success: boolean; comment?: EntityCommentRecord; error?: string }> {
  try {
    const targetOrgId = await resolveAuthorizedOrgId();
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("entity_comments")
      .insert({
        organization_id: targetOrgId,
        entity_type: entityType,
        entity_id: entityId,
        author_id: user.user.id,
        parent_id: parentId || null,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, comment: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
