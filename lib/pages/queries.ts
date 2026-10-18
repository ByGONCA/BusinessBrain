// ==============================================================================
// Company Brain: Pages Workspace Database Queries
// ==============================================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  PageRecord,
  PageTreeNode,
  PageBreadcrumbItem,
  PageActivityRecord,
  PageVersionRecord,
  PageCommentRecord,
  PageAuthorProfile,
} from "./types";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";

export const PAGE_METADATA_COLUMNS =
  "id, organization_id, parent_page_id, title, icon, icon_file_id, position, is_favorite, favorite_position, is_archived, archived_at, created_by, last_edited_by, created_at, updated_at, revision_id";

/**
 * Retrieves all active (non-archived) pages for an organization, ordered by position and creation.
 * Omits heavy JSONB content column to prevent over-fetching on dashboard and sidebar queries.
 */
export const getPagesForOrg = cache(async (organizationId: string): Promise<PageRecord[]> => {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pages")
    .select(PAGE_METADATA_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("is_favorite", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error && typeof error === "object" && (error as { code?: string }).code === "PGRST205") {
      logger.warn("Pages table does not exist in Supabase yet. Run database/migrations/00006_pages_workspace.sql in the Supabase SQL Editor.");
      return [];
    }
    logger.error("Error fetching pages for org", error, { organizationId });
    return [];
  }

  return ((data as unknown as Omit<PageRecord, "content" | "content_text">[]) || []).map((page) => ({
    ...page,
    content: [],
    content_text: "",
  })) as PageRecord[];
});

/**
 * Retrieves a nested tree structure of all active pages for the sidebar.
 */
export const getPageTree = cache(async (organizationId: string): Promise<PageTreeNode[]> => {
  const pages = await getPagesForOrg(organizationId);
  return buildPageTree(pages);
});

/**
 * Retrieves all favorite active pages for an organization, ordered by favorite_position.
 */
export const getFavoritePagesForOrg = cache(async (organizationId: string): Promise<PageRecord[]> => {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const pages = await getPagesForOrg(organizationId);
  return pages
    .filter((p) => p.is_favorite === true)
    .sort((a, b) => (a.favorite_position || 0) - (b.favorite_position || 0));
});

export function buildPageTree(pages: PageRecord[]): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();
  const rootNodes: PageTreeNode[] = [];

  // Create nodes with empty children array
  pages.forEach((page) => {
    nodeMap.set(page.id, { ...page, children: [] });
  });

  // Attach each node to its parent or to rootNodes
  pages.forEach((page) => {
    const node = nodeMap.get(page.id);
    if (!node) return;

    if (page.parent_page_id && nodeMap.has(page.parent_page_id)) {
      nodeMap.get(page.parent_page_id)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
}

/**
 * Retrieves a single page by its ID, ensuring it belongs to the specified organization.
 * Resolves creator and last editor profiles.
 */
export const getPageById = cache(async (pageId: string, organizationId: string): Promise<PageRecord | null> => {
  if (!isValidUuid(pageId) || !isValidUuid(organizationId)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  const userIdsToFetch: string[] = [];
  if (data.created_by && isValidUuid(data.created_by)) userIdsToFetch.push(data.created_by);
  if (data.last_edited_by && isValidUuid(data.last_edited_by) && !userIdsToFetch.includes(data.last_edited_by)) {
    userIdsToFetch.push(data.last_edited_by);
  }

  let createdByProfile: PageAuthorProfile | null = null;
  let lastEditedByProfile: PageAuthorProfile | null = null;

  if (userIdsToFetch.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIdsToFetch);

    if (profiles && profiles.length > 0) {
      const pMap = new Map(profiles.map((p) => [p.id, p as PageAuthorProfile]));
      if (data.created_by && pMap.has(data.created_by)) {
        createdByProfile = pMap.get(data.created_by)!;
      }
      if (data.last_edited_by && pMap.has(data.last_edited_by)) {
        lastEditedByProfile = pMap.get(data.last_edited_by)!;
      }
    }
  }

  return {
    ...(data as PageRecord),
    created_by_profile: createdByProfile,
    last_edited_by_profile: lastEditedByProfile,
  };
});

/**
 * Computes breadcrumb hierarchy path from page up to root.
 */
export async function getPageBreadcrumbs(pageId: string, organizationId: string): Promise<PageBreadcrumbItem[]> {
  const pages = await getPagesForOrg(organizationId);
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const breadcrumbs: PageBreadcrumbItem[] = [];
  let currentId: string | null = pageId;

  // Maximum depth guard against potential cycles
  let depth = 0;
  while (currentId && depth < 20) {
    const page = pageMap.get(currentId);
    if (!page) break;

    breadcrumbs.unshift({
      id: page.id,
      title: page.title,
      icon: page.icon,
      icon_file_id: page.icon_file_id,
    });

    currentId = page.parent_page_id;
    depth++;
  }

  return breadcrumbs;
}

/**
 * Searches active pages by title and content within the organization.
 */
export async function searchPages(organizationId: string, searchTerm: string): Promise<PageRecord[]> {
  if (!isValidUuid(organizationId) || !searchTerm.trim()) {
    return [];
  }

  const supabase = await createClient();
  const term = searchTerm.trim().replace(/[,()"\\\[\]{}]/g, "");
  if (!term) {
    return [];
  }

  const { data, error } = await supabase
    .from("pages")
    .select("id, organization_id, parent_page_id, title, icon, icon_file_id, content_text, position, is_archived, archived_at, created_by, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .or(`title.ilike.%${term}%,content_text.ilike.%${term}%`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    logger.error("Error searching pages", error, { organizationId, searchTerm });
    return [];
  }

  return data as PageRecord[];
}

/**
 * Retrieves archived pages (trash) for an organization.
 */
export async function getArchivedPages(organizationId: string): Promise<PageRecord[]> {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_archived", true)
    .order("archived_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return [];
  }

  return (data as PageRecord[]) || [];
}

/**
 * Retrieves activity logs for a page with actor profiles.
 */
export async function getPageActivity(
  pageId: string,
  organizationId: string,
  limit = 50
): Promise<PageActivityRecord[]> {
  if (!isValidUuid(pageId) || !isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("page_activity")
    .select("*")
    .eq("page_id", pageId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  const records = data as PageActivityRecord[];
  const actorIds = Array.from(
    new Set(records.map((r) => r.actor_id).filter((id): id is string => Boolean(id && isValidUuid(id))))
  );

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", actorIds);

    if (profiles && profiles.length > 0) {
      const pMap = new Map(profiles.map((p) => [p.id, p as PageAuthorProfile]));
      return records.map((r) => ({
        ...r,
        actor_profile: r.actor_id ? pMap.get(r.actor_id) || null : null,
      }));
    }
  }

  return records;
}

/**
 * Retrieves saved versions for a page with creator profiles.
 */
export async function getPageVersions(
  pageId: string,
  organizationId: string
): Promise<PageVersionRecord[]> {
  if (!isValidUuid(pageId) || !isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("page_versions")
    .select("id, organization_id, page_id, version_number, title, created_by, created_at")
    .eq("page_id", pageId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false });

  if (error || !data) {
    return [];
  }

  const records = data as PageVersionRecord[];
  const creatorIds = Array.from(
    new Set(records.map((r) => r.created_by).filter((id): id is string => Boolean(id && isValidUuid(id))))
  );

  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", creatorIds);

    if (profiles && profiles.length > 0) {
      const pMap = new Map(profiles.map((p) => [p.id, p as PageAuthorProfile]));
      return records.map((r) => ({
        ...r,
        creator_profile: r.created_by ? pMap.get(r.created_by) || null : null,
      }));
    }
  }

  return records;
}

/**
 * Retrieves comments for a page with author profiles.
 */
export async function getPageComments(
  pageId: string,
  organizationId: string
): Promise<PageCommentRecord[]> {
  if (!isValidUuid(pageId) || !isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("page_comments")
    .select("*")
    .eq("page_id", pageId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const records = data as PageCommentRecord[];
  const authorIds = Array.from(
    new Set(records.map((r) => r.author_id).filter((id): id is string => Boolean(id && isValidUuid(id))))
  );

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", authorIds);

    if (profiles && profiles.length > 0) {
      const pMap = new Map(profiles.map((p) => [p.id, p as PageAuthorProfile]));
      return records.map((r) => ({
        ...r,
        author_profile: r.author_id ? pMap.get(r.author_id) || null : null,
      }));
    }
  }

  return records;
}
