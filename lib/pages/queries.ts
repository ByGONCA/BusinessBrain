// ==============================================================================
// Company Brain: Pages Workspace Database Queries
// ==============================================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageRecord, PageTreeNode, PageBreadcrumbItem } from "./types";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";

/**
 * Retrieves all active (non-archived) pages for an organization, ordered by position and creation.
 */
export const getPagesForOrg = cache(async (organizationId: string): Promise<PageRecord[]> => {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pages")
    .select("*")
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

  return (data as PageRecord[]) || [];
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

  return data as PageRecord;
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
  const term = searchTerm.trim();

  const { data, error } = await supabase
    .from("pages")
    .select("id, organization_id, parent_page_id, title, icon, content_text, position, is_archived, archived_at, created_by, created_at, updated_at")
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
    .order("archived_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as PageRecord[]) || [];
}
