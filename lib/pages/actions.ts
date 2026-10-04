"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { EditorBlock, PageRecord, CompanyEntityRecord, PageConnectionRecord, EntityType, RelationType, PageBreadcrumbItem } from "./types";
import { RelationshipType } from "@/lib/connections/types";
import { PAGE_TEMPLATES } from "./templates";
import { getArchivedPages, getPageBreadcrumbs } from "./queries";

const pageTitleSchema = z.string().trim().max(255, "Page title too long");
// Support Unicode emojis, custom image URLs, and compressed base64 data URIs (up to 500KB)
const pageIconSchema = z.string().trim().max(500_000, "Icon identifier too long");

/**
 * Helper to extract searchable plain text from blocks array.
 */
function extractPlainText(blocks: EditorBlock[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      // Remove any basic HTML marks if present
      const cleanContent = (b.content || "").replace(/<[^>]*>?/gm, " ").trim();
      return cleanContent;
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Creates a new page within the active organization.
 */
export async function createPageAction(params?: {
  parentPageId?: string | null;
  title?: string;
  icon?: string;
  templateId?: string;
}): Promise<{ success: boolean; page?: PageRecord; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active organization found" };
    }

    let initialBlocks: EditorBlock[] = [{
      id: crypto.randomUUID(),
      type: "paragraph",
      content: "",
    }];
    let initialTitle = params?.title?.trim() || "Untitled";
    let initialIcon = "📄";
    if (params?.icon) {
      const parsedIcon = pageIconSchema.safeParse(params.icon);
      if (parsedIcon.success && parsedIcon.data) {
        initialIcon = parsedIcon.data;
      }
    }

    if (params?.templateId) {
      const template = PAGE_TEMPLATES.find((t) => t.id === params.templateId);
      if (template) {
        initialBlocks = template.blocks.map((b) => ({
          ...b,
          id: crypto.randomUUID(),
        }));
        initialTitle = template.name;
        initialIcon = template.icon;
      }
    }

    // Determine position: find max position among siblings
    let newPosition = 0;
    const parentId = params?.parentPageId && isValidUuid(params.parentPageId) ? params.parentPageId : null;

    // Cross-tenant parent validation: verify the parent page belongs to the active organization
    if (parentId) {
      const { data: parentPage } = await supabase
        .from("pages")
        .select("id")
        .eq("id", parentId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (!parentPage) {
        return { success: false, error: "Parent page not found in your workspace" };
      }
    }

    const { data: siblings } = await supabase
      .from("pages")
      .select("position")
      .eq("organization_id", activeOrg.id)
      .eq(parentId ? "parent_page_id" : "parent_page_id", parentId)
      .order("position", { ascending: false })
      .limit(1);

    if (siblings && siblings.length > 0 && typeof siblings[0].position === "number") {
      newPosition = siblings[0].position + 1;
    }

    const contentText = extractPlainText(initialBlocks);

    const { data, error } = await supabase
      .from("pages")
      .insert({
        organization_id: activeOrg.id,
        parent_page_id: parentId,
        title: initialTitle,
        icon: initialIcon,
        content: initialBlocks,
        content_text: contentText,
        position: newPosition,
        is_archived: false,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "PGRST205") {
        return {
          success: false,
          error: "Database table 'pages' is not created yet. Please execute database/migrations/00006_pages_workspace.sql in your Supabase SQL editor.",
        };
      }
      logger.error("Failed to create page", error, { organizationId: activeOrg.id });
      return { success: false, error: error?.message || "Could not create page" };
    }

    revalidatePath("/dashboard/pages");
    return { success: true, page: data as PageRecord };
  } catch (err: unknown) {
    logger.error("Unexpected error in createPageAction", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Saves page content, title, and/or icon. Used by debounced autosave.
 */
export async function savePageContentAction(params: {
  pageId: string;
  title?: string;
  icon?: string;
  blocks: EditorBlock[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active organization" };
    }

    const updates: Record<string, unknown> = {
      content: params.blocks,
      content_text: extractPlainText(params.blocks),
      updated_at: new Date().toISOString(),
    };

    if (typeof params.title === "string") {
      const parsedTitle = pageTitleSchema.safeParse(params.title);
      if (parsedTitle.success) {
        updates.title = parsedTitle.data || "Untitled";
      }
    }

    if (typeof params.icon === "string") {
      const parsedIcon = pageIconSchema.safeParse(params.icon);
      if (parsedIcon.success) {
        updates.icon = parsedIcon.data || "📄";
      }
    }

    const { error } = await supabase
      .from("pages")
      .update(updates)
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      logger.error("Failed to save page content", error, { pageId: params.pageId });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in savePageContentAction", err);
    return { success: false, error: "Failed to save page" };
  }
}

/**
 * Updates just the page title.
 */
export async function updatePageTitleAction(params: {
  pageId: string;
  title: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const parsed = pageTitleSchema.safeParse(params.title);
    if (!parsed.success) {
      return { success: false, error: "Invalid title" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { error } = await supabase
      .from("pages")
      .update({
        title: parsed.data || "Untitled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error updating page title", err);
    return { success: false, error: "Failed to update title" };
  }
}

/**
 * Updates the page icon emoji.
 */
export async function updatePageIconAction(params: {
  pageId: string;
  icon: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const parsed = pageIconSchema.safeParse(params.icon);
    if (!parsed.success) {
      return { success: false, error: "Invalid icon" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { error } = await supabase
      .from("pages")
      .update({
        icon: parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error updating page icon", err);
    return { success: false, error: "Failed to update icon" };
  }
}

/**
 * Moves a page to a new parent and/or position in the tree.
 */
export async function movePageAction(params: {
  pageId: string;
  targetParentId: string | null;
  targetPosition?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    if (params.targetParentId && !isValidUuid(params.targetParentId)) {
      return { success: false, error: "Invalid parent page ID" };
    }

    // Guard against making a page its own parent
    if (params.pageId === params.targetParentId) {
      return { success: false, error: "A page cannot be its own parent" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    // Cross-tenant parent validation & cycle prevention
    if (params.targetParentId) {
      const { data: parentPage } = await supabase
        .from("pages")
        .select("id")
        .eq("id", params.targetParentId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (!parentPage) {
        return { success: false, error: "Target parent page not found in your workspace" };
      }

      // Prevent cycle: ensure targetParentId is not a descendant of pageId
      const { data: allPages } = await supabase
        .from("pages")
        .select("id, parent_page_id")
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false);

      if (allPages) {
        let currentParent: string | null = params.targetParentId;
        while (currentParent) {
          if (currentParent === params.pageId) {
            return { success: false, error: "Cannot move a page inside its own subpage" };
          }
          const parentRow = allPages.find((p) => p.id === currentParent);
          currentParent = parentRow ? parentRow.parent_page_id : null;
        }
      }
    }

    const updates: Record<string, unknown> = {
      parent_page_id: params.targetParentId,
      updated_at: new Date().toISOString(),
    };

    if (typeof params.targetPosition === "number") {
      updates.position = params.targetPosition;
    }

    const { error } = await supabase
      .from("pages")
      .update(updates)
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/pages");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error moving page", err);
    return { success: false, error: "Failed to move page" };
  }
}

/**
 * Archives a page (moves it to Trash).
 */
export async function archivePageAction(params: {
  pageId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { error } = await supabase
      .from("pages")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/pages");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error archiving page", err);
    return { success: false, error: "Failed to archive page" };
  }
}

/**
 * Restores an archived page from Trash.
 */
export async function restorePageAction(params: {
  pageId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { error } = await supabase
      .from("pages")
      .update({
        is_archived: false,
        archived_at: null,
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/pages");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error restoring page", err);
    return { success: false, error: "Failed to restore page" };
  }
}

/**
 * Permanently deletes a page.
 */
export async function deletePagePermanentlyAction(params: {
  pageId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { error } = await supabase
      .from("pages")
      .delete()
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/pages");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error permanently deleting page", err);
    return { success: false, error: "Failed to delete page" };
  }
}

/**
 * Duplicates a page and its blocks.
 */
export async function duplicatePageAction(params: {
  pageId: string;
}): Promise<{ success: boolean; page?: PageRecord; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { data: original, error: fetchError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (fetchError || !original) {
      return { success: false, error: "Page not found" };
    }

    const clonedBlocks = (original.content as EditorBlock[]).map((b) => ({
      ...b,
      id: crypto.randomUUID(),
    }));

    const { data: newPage, error: insertError } = await supabase
      .from("pages")
      .insert({
        organization_id: activeOrg.id,
        parent_page_id: original.parent_page_id,
        title: `${original.title} (Copy)`,
        icon: original.icon,
        content: clonedBlocks,
        content_text: original.content_text,
        position: (original.position || 0) + 0.5,
        is_archived: false,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError || !newPage) {
      return { success: false, error: insertError?.message || "Failed to duplicate page" };
    }

    revalidatePath("/dashboard/pages");
    return { success: true, page: newPage as PageRecord };
  } catch (err: unknown) {
    logger.error("Error duplicating page", err);
    return { success: false, error: "Failed to duplicate page" };
  }
}

/**
 * Searches active pages by title or content within the active organization.
 */
export async function searchPagesAction(searchTerm: string): Promise<PageRecord[]> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg || !searchTerm.trim()) {
      return [];
    }

    const supabase = await createClient();

    // Sanitize: strip PostgREST filter-injection characters before interpolating into .or()
    // Characters , ( ) " \ have special meaning in PostgREST filter syntax
    const term = searchTerm.trim().replace(/[,()"\\\[\]{}]/g, "");
    if (!term) return [];

    const { data, error } = await supabase
      .from("pages")
      .select("id, organization_id, parent_page_id, title, icon, content_text, position, is_archived, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false)
      .or(`title.ilike.%${term}%,content_text.ilike.%${term}%`)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error || !data) {
      logger.error("Error searching pages in searchPagesAction", error, { organizationId: activeOrg.id, searchTerm });
      return [];
    }

    return data as PageRecord[];
  } catch (err: unknown) {
    logger.error("Unexpected error in searchPagesAction", err);
    return [];
  }
}

/**
 * Toggles favorite state of a page.
 */
export async function togglePageFavoriteAction(params: {
  pageId: string;
}): Promise<{ success: boolean; isFavorite?: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const { data: page, error: fetchError } = await supabase
      .from("pages")
      .select("id, is_favorite, favorite_position, position")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (fetchError || !page) {
      return { success: false, error: "Page not found" };
    }

    const nextIsFavorite = !page.is_favorite;
    let nextPosition = page.position;
    if (nextIsFavorite) {
      // Find current min position to place newly favorited page at the top of pages
      const { data: minPos } = await supabase
        .from("pages")
        .select("position")
        .eq("organization_id", activeOrg.id)
        .eq("is_archived", false)
        .order("position", { ascending: true })
        .limit(1);

      if (minPos && minPos.length > 0 && typeof minPos[0].position === "number") {
        nextPosition = minPos[0].position - 1;
      } else {
        nextPosition = 0;
      }
    }

    const { error: updateError } = await supabase
      .from("pages")
      .update({
        is_favorite: nextIsFavorite,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (updateError) {
      logger.error("Failed to toggle favorite", updateError, { pageId: params.pageId });
      return { success: false, error: updateError.message };
    }

    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true, isFavorite: nextIsFavorite };
  } catch (err: unknown) {
    logger.error("Unexpected error in togglePageFavoriteAction", err);
    return { success: false, error: "Failed to toggle favorite" };
  }
}

/**
 * Reorders pages via drag-and-drop in the sidebar tree or favorites list.
 */
export async function reorderPagesAction(params: {
  activePageId: string;
  targetPageId: string;
  dropPosition: "before" | "after" | "inside";
  isFavoriteList?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.activePageId) || !isValidUuid(params.targetPageId)) {
      return { success: false, error: "Invalid IDs" };
    }

    if (params.activePageId === params.targetPageId) {
      return { success: true };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    if (params.isFavoriteList) {
      // Reordering within Favorites
      const { data: favorites, error: favError } = await supabase
        .from("pages")
        .select("id, favorite_position")
        .eq("organization_id", activeOrg.id)
        .eq("is_favorite", true)
        .eq("is_archived", false)
        .order("favorite_position", { ascending: true });

      if (favError || !favorites) {
        return { success: false, error: "Could not fetch favorites" };
      }

      const activeItem = favorites.find((f) => f.id === params.activePageId);
      if (!activeItem) return { success: false, error: "Active favorite item not found" };

      const filtered = favorites.filter((f) => f.id !== params.activePageId);
      const targetIdx = filtered.findIndex((f) => f.id === params.targetPageId);
      if (targetIdx === -1) return { success: false, error: "Target favorite item not found" };

      const insertIdx = params.dropPosition === "before" ? targetIdx : targetIdx + 1;
      filtered.splice(insertIdx, 0, activeItem);

      // Re-index favorite positions
      for (let i = 0; i < filtered.length; i++) {
        await supabase
          .from("pages")
          .update({ favorite_position: (i + 1) * 10 })
          .eq("id", filtered[i].id)
          .eq("organization_id", activeOrg.id);
      }

      revalidatePath("/dashboard/pages");
      return { success: true };
    }

    // Reordering within the general Pages tree
    const { data: targetPage, error: targetError } = await supabase
      .from("pages")
      .select("id, parent_page_id, position")
      .eq("id", params.targetPageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (targetError || !targetPage) {
      return { success: false, error: "Target page not found" };
    }

    if (params.dropPosition === "inside") {
      // Move activePage inside targetPage as a child
      const { data: children } = await supabase
        .from("pages")
        .select("position")
        .eq("organization_id", activeOrg.id)
        .eq("parent_page_id", targetPage.id)
        .order("position", { ascending: false })
        .limit(1);

      const newPos = (children && children[0]?.position !== undefined ? children[0].position : 0) + 10;

      await supabase
        .from("pages")
        .update({
          parent_page_id: targetPage.id,
          position: newPos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.activePageId)
        .eq("organization_id", activeOrg.id);

      revalidatePath("/dashboard/pages");
      return { success: true };
    }

    // Dropping before or after targetPage under targetPage's parent
    const parentId = targetPage.parent_page_id;

    let siblingQuery = supabase
      .from("pages")
      .select("id, position")
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false);

    if (parentId) {
      siblingQuery = siblingQuery.eq("parent_page_id", parentId);
    } else {
      siblingQuery = siblingQuery.is("parent_page_id", null);
    }

    const { data: siblings, error: sibError } = await siblingQuery.order("position", { ascending: true });

    if (sibError || !siblings) {
      return { success: false, error: "Could not fetch siblings" };
    }

    const activeItem = { id: params.activePageId, position: 0 };
    const filtered = siblings.filter((s) => s.id !== params.activePageId);
    const targetIdx = filtered.findIndex((s) => s.id === params.targetPageId);

    if (targetIdx === -1) {
      return { success: false, error: "Target sibling not found" };
    }

    const insertIdx = params.dropPosition === "before" ? targetIdx : targetIdx + 1;
    filtered.splice(insertIdx, 0, activeItem);

    // Re-index positions
    for (let i = 0; i < filtered.length; i++) {
      const updates: Record<string, unknown> = { position: (i + 1) * 10 };
      if (filtered[i].id === params.activePageId) {
        updates.parent_page_id = parentId;
      }
      await supabase
        .from("pages")
        .update(updates)
        .eq("id", filtered[i].id)
        .eq("organization_id", activeOrg.id);
    }

    revalidatePath("/dashboard/pages");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in reorderPagesAction", err);
    return { success: false, error: "Failed to reorder pages" };
  }
}

/**
 * Fetches archived pages on-demand for the trash modal.
 */
export async function getArchivedPagesAction(): Promise<{
  success: boolean;
  pages: PageRecord[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, pages: [], error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, pages: [], error: "No active workspace found" };
    }

    const pages = await getArchivedPages(activeOrg.id);
    return { success: true, pages };
  } catch (err: unknown) {
    logger.error("Error in getArchivedPagesAction", err);
    return { success: false, pages: [], error: "Failed to fetch archived pages" };
  }
}

/**
 * Fetches all connections for a specific page and its blocks within the active organization.
 */
export async function getPageConnectionsAction(pageId: string): Promise<{
  success: boolean;
  connections: PageConnectionRecord[];
  error?: string;
}> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, connections: [], error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, connections: [], error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, connections: [], error: "No active workspace found" };
    }

    const { data, error } = await supabase
      .from("page_connections")
      .select("*")
      .eq("organization_id", activeOrg.id)
      .eq("page_id", pageId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.warn("getPageConnectionsAction DB query warning/error", { error: error.message });
      return { success: true, connections: [] };
    }

    return { success: true, connections: (data || []) as PageConnectionRecord[] };
  } catch (err: unknown) {
    logger.error("Unexpected error in getPageConnectionsAction", err);
    return { success: true, connections: [] };
  }
}

/**
 * Fetches existing entities in the active organization, optionally filtered by type.
 */
export async function getOrganizationEntitiesAction(type?: EntityType): Promise<{
  success: boolean;
  entities: CompanyEntityRecord[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, entities: [], error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, entities: [], error: "No active workspace found" };
    }

    let query = supabase
      .from("company_entities")
      .select("*")
      .eq("organization_id", activeOrg.id);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);

    if (error) {
      logger.warn("getOrganizationEntitiesAction warning", { error: error.message });
      return { success: true, entities: [] };
    }

    return { success: true, entities: (data || []) as CompanyEntityRecord[] };
  } catch (err: unknown) {
    logger.error("Unexpected error in getOrganizationEntitiesAction", err);
    return { success: true, entities: [] };
  }
}

/**
 * Creates a new company entity and immediately establishes a connection to a page or block.
 */
export async function createEntityAndConnectAction(params: {
  pageId: string;
  sourceType: "page" | "block";
  sourceId: string;
  type: EntityType;
  title: string;
  content?: string;
  relationshipType?: RelationshipType;
  metadata?: Record<string, unknown>;
  relationType?: RelationType;
}): Promise<{
  success: boolean;
  entity?: CompanyEntityRecord;
  connection?: PageConnectionRecord;
  error?: string;
}> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }
    const cleanTitle = params.title.trim();
    if (!cleanTitle) {
      return { success: false, error: "Title is required" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace found" };
    }

    // Cross-tenant page validation: verify pageId belongs to the active organization
    const { data: pageCheck } = await supabase
      .from("pages")
      .select("id")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();
    if (!pageCheck) {
      return { success: false, error: "Page not found in your workspace" };
    }

    // 1. Insert entity
    const { data: entityData, error: entityError } = await supabase
      .from("company_entities")
      .insert({
        organization_id: activeOrg.id,
        type: params.type,
        title: cleanTitle,
        content: params.content?.trim() || "",
        metadata: params.metadata || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (entityError || !entityData) {
      logger.error("Error creating company entity", { error: entityError });
      return { success: false, error: "Failed to create company entity" };
    }

    const relType = params.relationshipType || params.relationType || "related_to";

    // 2. Insert into canonical company_connections
    await supabase.from("company_connections").insert({
      organization_id: activeOrg.id,
      source_type: params.sourceType,
      source_id: params.sourceId,
      source_title: (params.metadata?.sourceTitle as string) || "Page",
      target_type: params.type,
      target_id: entityData.id,
      target_title: cleanTitle,
      relationship_type: relType,
      metadata: params.metadata || {},
      created_by: user.id,
    });

    // 3. Insert page connection (legacy compatibility)
    const connMetadata = {
      ...(params.metadata || {}),
      relation_type: relType,
      relationship_type: relType,
    };

    const { data: connData, error: connError } = await supabase
      .from("page_connections")
      .insert({
        organization_id: activeOrg.id,
        page_id: params.pageId,
        source_type: params.sourceType,
        source_id: params.sourceId,
        target_type: params.type,
        target_id: entityData.id,
        target_title: cleanTitle,
        metadata: connMetadata,
        created_by: user.id,
      })
      .select()
      .single();

    revalidatePath("/dashboard/connections");
    revalidatePath(`/dashboard/pages/${params.pageId}`);

    if (connError || !connData) {
      return {
        success: true,
        entity: entityData as CompanyEntityRecord,
        error: "Entity created, but could not link connection record.",
      };
    }

    return {
      success: true,
      entity: entityData as CompanyEntityRecord,
      connection: {
        ...(connData as PageConnectionRecord),
        relationship_type: relType,
      },
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in createEntityAndConnectAction", err);
    return { success: false, error: "Failed to process entity creation" };
  }
}

/**
 * Connects an existing entity (or another page) to the target page/block.
 */
export async function connectEntityAction(params: {
  pageId: string;
  sourceType: "page" | "block";
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  targetTitle: string;
  relationshipType?: RelationshipType;
  metadata?: Record<string, unknown>;
  relationType?: RelationType;
}): Promise<{
  success: boolean;
  connection?: PageConnectionRecord;
  error?: string;
}> {
  try {
    if (!isValidUuid(params.pageId) || !isValidUuid(params.targetId)) {
      return { success: false, error: "Invalid ID parameters" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace found" };
    }

    const relType = params.relationshipType || params.relationType || "related_to";

    // Cross-tenant validation: verify pageId belongs to the active organization
    const { data: pageCheck } = await supabase
      .from("pages")
      .select("id")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();
    if (!pageCheck) {
      return { success: false, error: "Page not found in your workspace" };
    }

    // Cross-tenant validation: verify targetId belongs to the active organization (if entity type)
    if (params.targetType !== "page") {
      const { data: targetCheck } = await supabase
        .from("company_entities")
        .select("id")
        .eq("id", params.targetId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (!targetCheck) {
        return { success: false, error: "Target entity not found in your workspace" };
      }
    }

    // 1. Upsert into canonical company_connections
    await supabase.from("company_connections").upsert(
      {
        organization_id: activeOrg.id,
        source_type: params.sourceType,
        source_id: params.sourceId,
        source_title: (params.metadata?.sourceTitle as string) || "Page",
        target_type: params.targetType,
        target_id: params.targetId,
        target_title: params.targetTitle.trim(),
        relationship_type: relType,
        metadata: params.metadata || {},
        created_by: user.id,
      },
      { onConflict: "organization_id,source_type,source_id,target_type,target_id,relationship_type" }
    );

    // 2. Upsert into page_connections (legacy compatibility)
    const connMetadata = {
      ...(params.metadata || {}),
      relation_type: relType,
      relationship_type: relType,
    };

    const { data, error } = await supabase
      .from("page_connections")
      .upsert(
        {
          organization_id: activeOrg.id,
          page_id: params.pageId,
          source_type: params.sourceType,
          source_id: params.sourceId,
          target_type: params.targetType,
          target_id: params.targetId,
          target_title: params.targetTitle.trim(),
          metadata: connMetadata,
          created_by: user.id,
        },
        { onConflict: "organization_id,page_id,source_id,target_type,target_id" }
      )
      .select()
      .single();

    revalidatePath("/dashboard/connections");
    revalidatePath(`/dashboard/pages/${params.pageId}`);

    if (error || !data) {
      logger.error("Error in connectEntityAction", { error });
      return { success: false, error: "Failed to connect entity" };
    }

    return {
      success: true,
      connection: {
        ...(data as PageConnectionRecord),
        relationship_type: relType,
      },
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in connectEntityAction", err);
    return { success: false, error: "Failed to connect entity" };
  }
}

/**
 * Removes an existing connection reference.
 */
export async function removeConnectionAction(connectionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!isValidUuid(connectionId)) {
      return { success: false, error: "Invalid connection ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace found" };
    }

    // Delete from company_connections
    await supabase
      .from("company_connections")
      .delete()
      .eq("id", connectionId)
      .eq("organization_id", activeOrg.id);

    // Delete from page_connections
    const { error } = await supabase
      .from("page_connections")
      .delete()
      .eq("id", connectionId)
      .eq("organization_id", activeOrg.id);

    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/pages");

    if (error) {
      logger.error("Error removing connection", { error });
      return { success: false, error: "Failed to remove connection" };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in removeConnectionAction", err);
    return { success: false, error: "Failed to remove connection" };
  }
}

/**
 * Fetches an active page by ID within the active organization.
 * Used for dynamic side peek panel and fast client lookups.
 */
export async function getPageAction(pageId: string): Promise<{
  success: boolean;
  page?: PageRecord;
  error?: string;
}> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace found" };
    }

    const { data: page, error } = await supabase
      .from("pages")
      .select("*")
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false)
      .single();

    if (error || !page) {
      return { success: false, error: "Page not found" };
    }

    return { success: true, page: page as PageRecord };
  } catch (err: unknown) {
    logger.error("Unexpected error in getPageAction", err);
    return { success: false, error: "Failed to load page" };
  }
}

/**
 * Fetches the breadcrumb hierarchy path for a page within the active organization.
 */
export async function getPageBreadcrumbsAction(pageId: string): Promise<{
  success: boolean;
  breadcrumbs: PageBreadcrumbItem[];
  error?: string;
}> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, breadcrumbs: [], error: "Invalid page ID" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, breadcrumbs: [], error: "No active workspace found" };
    }

    const breadcrumbs = await getPageBreadcrumbs(pageId, activeOrg.id);
    return { success: true, breadcrumbs };
  } catch (err: unknown) {
    logger.error("Error in getPageBreadcrumbsAction", err);
    return { success: false, breadcrumbs: [], error: "Failed to load breadcrumbs" };
  }
}

