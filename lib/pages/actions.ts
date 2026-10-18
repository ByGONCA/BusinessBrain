"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import {
  EditorBlock,
  PageRecord,
  CompanyEntityRecord,
  PageConnectionRecord,
  EntityType,
  RelationType,
  PageBreadcrumbItem,
  PageActivityAction,
  PageActivityRecord,
  PageCommentRecord,
  PageVersionRecord,
} from "./types";
import { RelationshipType } from "@/lib/connections/types";
import { PAGE_TEMPLATES } from "./templates";
import {
  getArchivedPages,
  getPageBreadcrumbs,
  getPageActivity,
  getPageVersions,
  getPageComments,
} from "./queries";
import { hasPermission } from "@/lib/permissions/resolver";

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
  initialBlocks?: EditorBlock[];
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

    const canCreate = await hasPermission(user.id, activeOrg.id, "pages.create");
    if (!canCreate) {
      return { success: false, error: "Forbidden: You do not have permission to create pages." };
    }

    let initialBlocks: EditorBlock[] = params?.initialBlocks && Array.isArray(params.initialBlocks) && params.initialBlocks.length > 0
      ? params.initialBlocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
      : [{
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
        last_edited_by: user.id,
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

    // Record creation activity & initial version 1 (non-blocking)
    try {
      await supabase.from("page_activity").insert({
        organization_id: activeOrg.id,
        page_id: data.id,
        actor_id: user.id,
        action: "page_created",
        metadata: { title: initialTitle },
      });

      await supabase.from("page_versions").insert({
        organization_id: activeOrg.id,
        page_id: data.id,
        version_number: 1,
        title: initialTitle,
        content: initialBlocks,
        content_text: contentText,
        created_by: user.id,
      });
    } catch {
      // Activity logging does not block page creation
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
  iconFileId?: string | null;
  blocks: EditorBlock[];
  expectedRevision?: number;
}): Promise<{
  success: boolean;
  newRevision?: number;
  code?: string;
  error?: string;
}> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, code: "INVALID_PAGE_ID", error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, code: "UNAUTHORIZED", error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, code: "NO_WORKSPACE", error: "No active organization" };
    }

    const canEdit = await hasPermission(user.id, activeOrg.id, "pages.edit");
    if (!canEdit) {
      return { success: false, code: "FORBIDDEN", error: "Forbidden: You do not have permission to edit pages." };
    }

    const contentText = extractPlainText(params.blocks);

    // Try executing through atomic save_page_content RPC when expectedRevision is provided
    if (params.expectedRevision !== undefined) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("save_page_content", {
        p_page_id: params.pageId,
        p_expected_revision: params.expectedRevision,
        p_title: typeof params.title === "string" ? params.title : null,
        p_icon: typeof params.icon === "string" ? params.icon : null,
        p_icon_file_id: params.iconFileId && isValidUuid(params.iconFileId) ? params.iconFileId : null,
        p_content: params.blocks,
        p_content_text: contentText,
      });

      if (!rpcErr && rpcData && typeof rpcData === "object" && (rpcData as { success?: boolean }).success) {
        return {
          success: true,
          newRevision: Number((rpcData as { revision_id: number }).revision_id),
        };
      }

      if (rpcErr) {
        const msg = rpcErr.message || "";
        if (msg.includes("STALE_WRITE")) {
          return {
            success: false,
            code: "STALE_WRITE",
            error: "A página foi modificada por outro utilizador ou noutro separador.",
          };
        }
        if (msg.includes("MISSING_OCC_TOKEN")) {
          return {
            success: false,
            code: "MISSING_OCC_TOKEN",
            error: "Token de revisão ausente ou inválido.",
          };
        }
        if (msg.includes("FORBIDDEN") || (rpcErr as { code?: string }).code === "42501") {
          return {
            success: false,
            code: "FORBIDDEN",
            error: "Forbidden: You do not have permission to edit pages.",
          };
        }
        if (msg.includes("NOT_FOUND") || (rpcErr as { code?: string }).code === "P0002") {
          return {
            success: false,
            code: "NOT_FOUND",
            error: "Página não encontrada no workspace.",
          };
        }
        if ((rpcErr as { code?: string }).code === "40P01" || msg.includes("deadlock")) {
          return {
            success: false,
            code: "DEADLOCK",
            error: "Conflito temporário de bloqueio no servidor.",
          };
        }

        // If the RPC does not exist yet (PGRST202), proceed with resilient fallback below
        if ((rpcErr as { code?: string }).code !== "PGRST202" && !msg.includes("function public.save_page_content")) {
          logger.error("RPC save_page_content failed", rpcErr, { pageId: params.pageId });
          return { success: false, code: "RPC_ERROR", error: rpcErr.message };
        }
      }
    }

    // Resilient fallback: direct update path (used during initial migration / local dev)
    const updates: Record<string, unknown> = {
      content: params.blocks,
      content_text: contentText,
      last_edited_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (params.expectedRevision !== undefined) {
      updates.revision_id = params.expectedRevision + 1;
    }

    if (typeof params.title === "string") {
      const parsedTitle = pageTitleSchema.safeParse(params.title);
      if (parsedTitle.success) {
        updates.title = parsedTitle.data || "Untitled";
      }
    }

    if (params.iconFileId !== undefined) {
      if (params.iconFileId === null) {
        updates.icon_file_id = null;
      } else if (isValidUuid(params.iconFileId)) {
        const { data: fileRecord } = await supabase
          .from("organization_files")
          .select("id")
          .eq("id", params.iconFileId)
          .eq("organization_id", activeOrg.id)
          .maybeSingle();

        if (fileRecord) {
          updates.icon_file_id = params.iconFileId;
        }
      }
    }

    if (typeof params.icon === "string") {
      const parsedIcon = pageIconSchema.safeParse(params.icon);
      if (parsedIcon.success) {
        updates.icon = parsedIcon.data || "📄";
      }
    }

    let { error } = await supabase
      .from("pages")
      .update(updates)
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    // Resilience fallback: If the database does not have revision_id or last_edited_by column yet
    if (error && (error.message?.includes("revision_id") || error.message?.includes("last_edited_by") || (error as { code?: string }).code === "PGRST204")) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.revision_id;
      delete fallbackUpdates.last_edited_by;
      const retryResult = await supabase
        .from("pages")
        .update(fallbackUpdates)
        .eq("id", params.pageId)
        .eq("organization_id", activeOrg.id);
      error = retryResult.error;
    }

    if (error) {
      logger.error("Failed to save page content in fallback path", error, { pageId: params.pageId });
      return { success: false, code: "UPDATE_FAILED", error: error.message };
    }

    // Throttle content_edited activity & version snapshotting (at most once every 5 minutes per user)
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentActivity } = await supabase
        .from("page_activity")
        .select("id")
        .eq("page_id", params.pageId)
        .eq("actor_id", user.id)
        .eq("action", "content_edited")
        .gte("created_at", fiveMinutesAgo)
        .limit(1);

      if (!recentActivity || recentActivity.length === 0) {
        await supabase.from("page_activity").insert({
          organization_id: activeOrg.id,
          page_id: params.pageId,
          actor_id: user.id,
          action: "content_edited",
          metadata: {
            block_count: params.blocks.length,
          },
        });

        const { data: latestVersion } = await supabase
          .from("page_versions")
          .select("version_number")
          .eq("page_id", params.pageId)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersionNum = (latestVersion?.version_number || 0) + 1;

        await supabase.from("page_versions").insert({
          organization_id: activeOrg.id,
          page_id: params.pageId,
          version_number: nextVersionNum,
          title: (updates.title as string) || "Untitled",
          content: params.blocks,
          content_text: (updates.content_text as string) || "",
          created_by: user.id,
        });
      }
    } catch {
      // Activity logging does not block autosave
    }

    const calculatedNewRevision = params.expectedRevision !== undefined ? params.expectedRevision + 1 : undefined;
    return { success: true, newRevision: calculatedNewRevision };
  } catch (err: unknown) {
    logger.error("Unexpected error in savePageContentAction", err);
    return { success: false, code: "UNEXPECTED_ERROR", error: "Failed to save page" };
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const canEdit = await hasPermission(user.id, activeOrg.id, "pages.edit");
    if (!canEdit) {
      return { success: false, error: "Forbidden: You do not have permission to edit pages." };
    }

    const { data: currentPage } = await supabase
      .from("pages")
      .select("title")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    const previousTitle = currentPage?.title || "Untitled";
    const nextTitle = parsed.data || "Untitled";

    let { error } = await supabase
      .from("pages")
      .update({
        title: nextTitle,
        last_edited_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error && (error.message?.includes("last_edited_by") || (error as { code?: string }).code === "PGRST204")) {
      const retry = await supabase
        .from("pages")
        .update({
          title: nextTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.pageId)
        .eq("organization_id", activeOrg.id);
      error = retry.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (previousTitle !== nextTitle && user?.id) {
      try {
        await supabase.from("page_activity").insert({
          organization_id: activeOrg.id,
          page_id: params.pageId,
          actor_id: user.id,
          action: "page_renamed",
          metadata: {
            previous_title: previousTitle,
            new_title: nextTitle,
          },
        });
      } catch {
        // Activity logging does not block title update
      }
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error updating page title", err);
    return { success: false, error: "Failed to update title" };
  }
}

/**
 * Updates the page icon emoji or links an uploaded organization file.
 */
export async function updatePageIconAction(params: {
  pageId: string;
  icon?: string | null;
  iconFileId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.iconFileId) {
      if (!isValidUuid(params.iconFileId)) {
        return { success: false, error: "Invalid icon file ID" };
      }

      // Cross-tenant validation: ensure file belongs to active organization
      const { data: fileRecord, error: fileErr } = await supabase
        .from("organization_files")
        .select("id, organization_id")
        .eq("id", params.iconFileId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();

      if (fileErr || !fileRecord) {
        return { success: false, error: "Icon file not found in your workspace" };
      }

      updates.icon_file_id = params.iconFileId;
      updates.icon = params.icon || "";
    } else {
      if (typeof params.icon === "string") {
        const parsed = pageIconSchema.safeParse(params.icon);
        if (!parsed.success) {
          return { success: false, error: "Invalid icon" };
        }
        updates.icon = parsed.data;
      }
      updates.icon_file_id = null;
    }

    const { error } = await supabase
      .from("pages")
      .update(updates)
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const canArchive = await hasPermission(user.id, activeOrg.id, "pages.delete");
    if (!canArchive) {
      return { success: false, error: "Forbidden: You do not have permission to archive pages." };
    }

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const canRestore = await hasPermission(user.id, activeOrg.id, "pages.edit");
    if (!canRestore) {
      return { success: false, error: "Forbidden: You do not have permission to restore pages." };
    }

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active organization" };

    const canDelete = await hasPermission(user.id, activeOrg.id, "pages.delete");
    if (!canDelete) {
      return { success: false, error: "Forbidden: You do not have permission to delete pages." };
    }

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
export async function searchPagesAction(searchTerm: string = ""): Promise<PageRecord[]> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return [];
    }

    const supabase = await createClient();

    // Sanitize: strip PostgREST filter-injection characters before interpolating into .or()
    // Characters , ( ) " \ have special meaning in PostgREST filter syntax
    const term = (searchTerm || "").trim().replace(/[,()"\\\[\]{}]/g, "");

    let query = supabase
      .from("pages")
      .select("id, organization_id, parent_page_id, title, icon, content_text, position, is_archived, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false);

    if (term) {
      // 1. Try multilingual full-text search RPC first
      try {
        const { data: searchResults, error: searchError } = await supabase.rpc("global_workspace_search", {
          p_query: term,
          p_limit: 20,
          p_organization_id: activeOrg.id,
        });

        if (!searchError && searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
          const pageIds = searchResults
            .filter((r: { result_type: string }) => r.result_type === "page")
            .map((r: { result_id: string }) => r.result_id);

          if (pageIds.length > 0) {
            const { data: pageRows } = await supabase
              .from("pages")
              .select("id, organization_id, parent_page_id, title, icon, content_text, position, is_archived, archived_at, created_by, created_at, updated_at, revision_id")
              .in("id", pageIds)
              .eq("organization_id", activeOrg.id)
              .eq("is_archived", false);

            if (pageRows && pageRows.length > 0) {
              const orderMap = new Map(pageIds.map((id: string, idx: number) => [id, idx]));
              pageRows.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
              return pageRows as PageRecord[];
            }
          }
        }
      } catch {
        // Fall back to standard query below
      }

      query = query.or(`title.ilike.%${term}%,content_text.ilike.%${term}%`);
    }

    const { data, error } = await query
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
}): Promise<{ success: boolean; code?: string; error?: string }> {
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

      // Condition 4.3: Plan favorite updates and sort by id ASC for deterministic lock acquisition
      const plannedFavoriteUpdates = filtered.map((item, i) => ({
        id: item.id,
        favorite_position: (i + 1) * 10,
      }));
      plannedFavoriteUpdates.sort((a, b) => a.id.localeCompare(b.id));

      let favoriteAttempt = 0;
      while (favoriteAttempt < 2) {
        try {
          for (const item of plannedFavoriteUpdates) {
            const { error: updErr } = await supabase
              .from("pages")
              .update({ favorite_position: item.favorite_position })
              .eq("id", item.id)
              .eq("organization_id", activeOrg.id);
            if (updErr) throw updErr;
          }
          revalidatePath("/dashboard/pages");
          return { success: true };
        } catch (err: unknown) {
          favoriteAttempt++;
          const errObj = err as { code?: string; message?: string };
          if (favoriteAttempt < 2 && (errObj?.code === "40P01" || errObj?.message?.includes("deadlock"))) {
            await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
            continue;
          }
          logger.error("Error updating favorite positions", err);
          return {
            success: false,
            code: errObj?.code === "40P01" ? "DEADLOCK" : "UPDATE_FAILED",
            error: "Falha ao reordenar favoritos devido a conflito de concorrência.",
          };
        }
      }
      return { success: false, code: "DEADLOCK", error: "Deadlock ao reordenar favoritos." };
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

    // Condition 4.3: Plan tree updates and sort by id ASC for deterministic lock acquisition
    const plannedTreeUpdates = filtered.map((item, i) => {
      const updates: Record<string, unknown> = { position: (i + 1) * 10 };
      if (item.id === params.activePageId) {
        updates.parent_page_id = parentId;
      }
      return { id: item.id, updates };
    });
    plannedTreeUpdates.sort((a, b) => a.id.localeCompare(b.id));

    let treeAttempt = 0;
    while (treeAttempt < 2) {
      try {
        for (const item of plannedTreeUpdates) {
          const { error: updErr } = await supabase
            .from("pages")
            .update(item.updates)
            .eq("id", item.id)
            .eq("organization_id", activeOrg.id);
          if (updErr) throw updErr;
        }
        revalidatePath("/dashboard/pages");
        return { success: true };
      } catch (err: unknown) {
        treeAttempt++;
        const errObj = err as { code?: string; message?: string };
        if (treeAttempt < 2 && (errObj?.code === "40P01" || errObj?.message?.includes("deadlock"))) {
          await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
          continue;
        }
        logger.error("Error updating page positions", err);
        return {
          success: false,
          code: errObj?.code === "40P01" ? "DEADLOCK" : "UPDATE_FAILED",
          error: "Falha ao reordenar páginas devido a conflito de concorrência.",
        };
      }
    }
    return { success: false, code: "DEADLOCK", error: "Deadlock ao reordenar páginas." };
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

    const canView = await hasPermission(user.id, activeOrg.id, "pages.view");
    if (!canView) {
      return { success: false, error: "Forbidden: You do not have permission to view pages." };
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

/**
 * Records a page activity event (e.g. link copied, page connected, file added).
 */
export async function recordPageActivityAction(params: {
  pageId: string;
  action: PageActivityAction;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
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
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { error } = await supabase.from("page_activity").insert({
      organization_id: activeOrg.id,
      page_id: params.pageId,
      actor_id: user.id,
      action: params.action,
      metadata: params.metadata || {},
    });

    if (error) {
      logger.error("Failed to record page activity", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in recordPageActivityAction", err);
    return { success: false, error: "Failed to record activity" };
  }
}

/**
 * Creates a comment on a page.
 */
export async function createPageCommentAction(params: {
  pageId: string;
  content: string;
}): Promise<{ success: boolean; comment?: PageCommentRecord; error?: string }> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, error: "Invalid page ID" };
    }

    const cleanContent = params.content?.trim();
    if (!cleanContent) {
      return { success: false, error: "Comment content cannot be empty" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { data, error } = await supabase
      .from("page_comments")
      .insert({
        organization_id: activeOrg.id,
        page_id: params.pageId,
        author_id: user.id,
        content: cleanContent,
      })
      .select("*")
      .single();

    if (error || !data) {
      logger.error("Failed to insert page comment", error);
      return { success: false, error: error?.message || "Failed to create comment" };
    }

    // Record activity for comment creation
    try {
      await supabase.from("page_activity").insert({
        organization_id: activeOrg.id,
        page_id: params.pageId,
        actor_id: user.id,
        action: "comment_added",
        metadata: {
          comment_preview: cleanContent.slice(0, 100),
        },
      });
    } catch {
      // Activity logging is non-blocking
    }

    // Fetch author profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const commentRecord: PageCommentRecord = {
      ...(data as PageCommentRecord),
      author_profile: profile || null,
    };

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true, comment: commentRecord };
  } catch (err: unknown) {
    logger.error("Unexpected error in createPageCommentAction", err);
    return { success: false, error: "Failed to post comment" };
  }
}

/**
 * Resolves or unresolves a comment.
 */
export async function resolvePageCommentAction(params: {
  pageId: string;
  commentId: string;
  isResolved: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId) || !isValidUuid(params.commentId)) {
      return { success: false, error: "Invalid parameters" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { error } = await supabase
      .from("page_comments")
      .update({
        is_resolved: params.isResolved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.commentId)
      .eq("page_id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    if (params.isResolved) {
      try {
        await supabase.from("page_activity").insert({
          organization_id: activeOrg.id,
          page_id: params.pageId,
          actor_id: user.id,
          action: "comment_resolved",
          metadata: { comment_id: params.commentId },
        });
      } catch {
        // Non-blocking
      }
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in resolvePageCommentAction", err);
    return { success: false, error: "Failed to update comment" };
  }
}

/**
 * Deletes a comment.
 */
export async function deletePageCommentAction(params: {
  pageId: string;
  commentId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.pageId) || !isValidUuid(params.commentId)) {
      return { success: false, error: "Invalid parameters" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    // Verify authorship or owner/admin role before deleting
    const { data: comment, error: fetchError } = await supabase
      .from("page_comments")
      .select("author_id")
      .eq("id", params.commentId)
      .eq("page_id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (fetchError || !comment) {
      return { success: false, error: "Comment not found" };
    }

    const isOwnerOrAdmin = activeOrg.role === "owner" || activeOrg.role === "admin";
    if (comment.author_id !== user.id && !isOwnerOrAdmin) {
      return { success: false, error: "You can only delete your own comments." };
    }

    const { error } = await supabase
      .from("page_comments")
      .delete()
      .eq("id", params.commentId)
      .eq("page_id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in deletePageCommentAction", err);
    return { success: false, error: "Failed to delete comment" };
  }
}

/**
 * Restores a historical version of a page.
 */
export async function restorePageVersionAction(params: {
  pageId: string;
  versionId: string;
}): Promise<{
  success: boolean;
  newRevision?: number;
  title?: string;
  content?: EditorBlock[];
  code?: string;
  error?: string;
}> {
  try {
    if (!isValidUuid(params.pageId) || !isValidUuid(params.versionId)) {
      return { success: false, error: "Invalid parameters" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    // Try executing through atomic restore_page_version RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc("restore_page_version", {
      p_page_id: params.pageId,
      p_version_id: params.versionId,
    });

    if (!rpcErr && rpcData && typeof rpcData === "object" && (rpcData as { success?: boolean }).success) {
      revalidatePath(`/dashboard/pages/${params.pageId}`);
      return {
        success: true,
        newRevision: Number((rpcData as { revision_id: number }).revision_id),
        title: (rpcData as { title?: string }).title,
        content: (rpcData as { content?: EditorBlock[] }).content,
      };
    }

    if (rpcErr && (rpcErr as { code?: string }).code !== "PGRST202" && !rpcErr.message?.includes("function public.restore_page_version")) {
      logger.error("RPC restore_page_version failed", rpcErr);
      return { success: false, code: "RPC_ERROR", error: rpcErr.message };
    }

    // Fallback path: manual restore with revision increment
    const { data: version, error: verErr } = await supabase
      .from("page_versions")
      .select("*")
      .eq("id", params.versionId)
      .eq("page_id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (verErr || !version) {
      return { success: false, code: "VERSION_NOT_FOUND", error: "Version not found" };
    }

    // Fetch current revision to increment
    const { data: curPage } = await supabase
      .from("pages")
      .select("revision_id")
      .eq("id", params.pageId)
      .single();

    const nextRev = (curPage?.revision_id ?? 1) + 1;

    // Update active page content
    const { error: updateErr } = await supabase
      .from("pages")
      .update({
        title: version.title,
        content: version.content,
        content_text: version.content_text,
        revision_id: nextRev,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (updateErr) {
      return { success: false, code: "UPDATE_FAILED", error: updateErr.message };
    }

    // Record activity for restoration
    try {
      await supabase.from("page_activity").insert({
        organization_id: activeOrg.id,
        page_id: params.pageId,
        actor_id: user.id,
        action: "version_restored",
        metadata: {
          restored_version_number: version.version_number,
          version_id: version.id,
          new_revision_id: nextRev,
        },
      });
    } catch {
      // Non-blocking
    }

    revalidatePath(`/dashboard/pages/${params.pageId}`);
    return {
      success: true,
      newRevision: nextRev,
      title: version.title,
      content: version.content as EditorBlock[],
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in restorePageVersionAction", err);
    return { success: false, code: "UNEXPECTED_ERROR", error: "Failed to restore version" };
  }
}

/**
 * Fetches latest revision token, title, and blocks for optimistic concurrency resolution.
 */
export async function getPageLatestRevisionAction(pageId: string): Promise<{
  success: boolean;
  revisionId?: number;
  title?: string;
  blocks?: EditorBlock[];
  error?: string;
}> {
  try {
    if (!isValidUuid(pageId)) return { success: false, error: "Invalid page ID" };
    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { data: page, error } = await supabase
      .from("pages")
      .select("id, title, content, revision_id")
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (error || !page) return { success: false, error: "Page not found" };
    return {
      success: true,
      revisionId: page.revision_id ?? 1,
      title: page.title,
      blocks: Array.isArray(page.content) ? (page.content as EditorBlock[]) : [],
    };
  } catch (err: unknown) {
    logger.error("Error fetching page latest revision", err);
    return { success: false, error: "Failed to fetch page revision" };
  }
}

/**
 * Fetches page activity records for the active organization.
 */
export async function getPageActivityAction(
  pageId: string,
  limit = 50
): Promise<{ success: boolean; activities: PageActivityRecord[]; error?: string }> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, activities: [], error: "Invalid page ID" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, activities: [], error: "No active workspace" };
    }

    const activities = await getPageActivity(pageId, activeOrg.id, limit);
    return { success: true, activities };
  } catch (err: unknown) {
    logger.error("Error in getPageActivityAction", err);
    return { success: false, activities: [], error: "Failed to load activity" };
  }
}

/**
 * Fetches saved page versions for the active organization.
 */
export async function getPageVersionsAction(
  pageId: string
): Promise<{ success: boolean; versions: PageVersionRecord[]; error?: string }> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, versions: [], error: "Invalid page ID" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, versions: [], error: "No active workspace" };
    }

    const versions = await getPageVersions(pageId, activeOrg.id);
    return { success: true, versions };
  } catch (err: unknown) {
    logger.error("Error in getPageVersionsAction", err);
    return { success: false, versions: [], error: "Failed to load versions" };
  }
}

/**
 * Fetches comments for a page within the active organization.
 */
export async function getPageCommentsAction(
  pageId: string
): Promise<{ success: boolean; comments: PageCommentRecord[]; error?: string }> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, comments: [], error: "Invalid page ID" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, comments: [], error: "No active workspace" };
    }

    const comments = await getPageComments(pageId, activeOrg.id);
    return { success: true, comments };
  } catch (err: unknown) {
    logger.error("Error in getPageCommentsAction", err);
    return { success: false, comments: [], error: "Failed to load comments" };
  }
}

export interface PageHeadingItem {
  id: string;
  text: string;
  type: "heading_1" | "heading_2" | "heading_3";
}

/**
 * Fetches page outline headings for section positioning.
 */
export async function getPageHeadingsAction(
  pageId: string
): Promise<{ success: boolean; headings: PageHeadingItem[]; error?: string }> {
  try {
    if (!isValidUuid(pageId)) {
      return { success: false, headings: [], error: "Invalid page ID" };
    }
    const supabase = await createClient();
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, headings: [], error: "No active workspace" };

    const { data: page, error } = await supabase
      .from("pages")
      .select("content")
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (error || !page) {
      return { success: false, headings: [], error: "Page not found" };
    }

    const blocks: EditorBlock[] = Array.isArray(page.content) ? (page.content as EditorBlock[]) : [];
    const headings: PageHeadingItem[] = blocks
      .filter((b) => b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3")
      .map((b) => ({
        id: b.id,
        text: (b.content || "").replace(/<[^>]*>?/gm, "").trim() || "Untitled section",
        type: b.type as "heading_1" | "heading_2" | "heading_3",
      }));

    return { success: true, headings };
  } catch (err: unknown) {
    logger.error("Error in getPageHeadingsAction", err);
    return { success: false, headings: [], error: "Failed to load headings" };
  }
}

/**
 * Adds a code snippet and reference link to an existing or new page in the active workspace.
 */
export async function addCodeSnippetToPageAction(params: {
  pageId: string;
  filePath: string;
  selectedCode: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  htmlUrl?: string;
  position?: "end" | "start" | "after_block";
  targetBlockId?: string;
  insertIndex?: number;
  expectedRevision?: number;
}): Promise<{
  success: boolean;
  pageId?: string;
  blocks?: EditorBlock[];
  newRevision?: number;
  code?: string;
  error?: string;
}> {
  try {
    if (!isValidUuid(params.pageId)) {
      return { success: false, code: "INVALID_PAGE_ID", error: "Invalid page ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, code: "UNAUTHORIZED", error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, code: "NO_WORKSPACE", error: "No active workspace" };
    }

    const canEdit = await hasPermission(user.id, activeOrg.id, "pages.edit");
    if (!canEdit) {
      return { success: false, code: "FORBIDDEN", error: "Forbidden: You do not have permission to edit pages." };
    }

    const { data: page, error: fetchErr } = await supabase
      .from("pages")
      .select("id, title, icon, content, content_text, revision_id")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .single();

    if (fetchErr || !page) {
      return { success: false, code: "NOT_FOUND", error: "Page not found in this workspace" };
    }

    // Condition 4.1: If expectedRevision was specified, verify it matches page's current revision
    if (params.expectedRevision !== undefined && page.revision_id !== undefined && page.revision_id !== params.expectedRevision) {
      return {
        success: false,
        code: "STALE_WRITE",
        error: "A página foi modificada noutro separador. Atualize a página antes de inserir o excerto de código.",
      };
    }

    const existingBlocks: EditorBlock[] = Array.isArray(page.content)
      ? (page.content as EditorBlock[])
      : [];

    const fileName = params.filePath.split("/").pop() || params.filePath;
    const lineLabel =
      params.startLine !== undefined
        ? params.endLine !== undefined && params.endLine !== params.startLine
          ? ` (L${params.startLine}–${params.endLine})`
          : ` (L${params.startLine})`
        : "";

    // Resolve direct GitHub URL with line numbers if available
    let targetHtmlUrl = params.htmlUrl;
    if (targetHtmlUrl && params.startLine !== undefined && !targetHtmlUrl.includes("#L")) {
      targetHtmlUrl = `${targetHtmlUrl}#L${params.startLine}${
        params.endLine !== undefined && params.endLine !== params.startLine
          ? `-L${params.endLine}`
          : ""
      }`;
    }

    // Extract repo full name from htmlUrl if available
    let repoFullName: string | undefined;
    if (params.htmlUrl) {
      const match = params.htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        repoFullName = `${match[1]}/${match[2]}`.replace(/\.git$/, "");
      }
    }

    // Unified specialized GitHub code block
    const codeBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type: "code",
      content: params.selectedCode,
      properties: {
        language: params.language || "text",
        filePath: params.filePath,
        startLine: params.startLine,
        endLine: params.endLine,
        htmlUrl: targetHtmlUrl,
        repoFullName,
        isGitHubSnippet: true,
        caption: `${fileName}${lineLabel}`,
      },
    };

    const trailingParagraph: EditorBlock = {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: "",
    };

    const snippetBlocks: EditorBlock[] = [codeBlock, trailingParagraph];

    let newBlocks: EditorBlock[];

    if (params.insertIndex !== undefined && params.insertIndex >= 0) {
      const clampedIndex = Math.min(params.insertIndex, existingBlocks.length);
      newBlocks = [
        ...existingBlocks.slice(0, clampedIndex),
        ...snippetBlocks,
        ...existingBlocks.slice(clampedIndex),
      ];
    } else if (params.position === "start") {
      newBlocks = [...snippetBlocks, ...existingBlocks];
    } else if (params.position === "after_block" && params.targetBlockId) {
      const idx = existingBlocks.findIndex((b) => b.id === params.targetBlockId);
      if (idx !== -1) {
        newBlocks = [
          ...existingBlocks.slice(0, idx + 1),
          ...snippetBlocks,
          ...existingBlocks.slice(idx + 1),
        ];
      } else {
        newBlocks = [...existingBlocks, ...snippetBlocks];
      }
    } else {
      // Default: append to end
      newBlocks = [...existingBlocks, ...snippetBlocks];
    }

    const contentText = extractPlainText(newBlocks);
    const targetRev = page.revision_id ?? 1;

    // Condition 4.1: Atomic update via save_page_content RPC to ensure concurrency safety
    const { data: rpcData, error: rpcErr } = await supabase.rpc("save_page_content", {
      p_page_id: params.pageId,
      p_expected_revision: targetRev,
      p_title: page.title,
      p_icon: page.icon,
      p_content: newBlocks,
      p_content_text: contentText,
    });

    if (!rpcErr && rpcData && typeof rpcData === "object" && (rpcData as { success?: boolean }).success) {
      revalidatePath(`/dashboard/pages/${params.pageId}`);
      return {
        success: true,
        pageId: params.pageId,
        blocks: newBlocks,
        newRevision: Number((rpcData as { revision_id: number }).revision_id),
      };
    }

    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (msg.includes("STALE_WRITE")) {
        return {
          success: false,
          code: "STALE_WRITE",
          error: "A página foi modificada concorrentemente. Atualize antes de adicionar o excerto.",
        };
      }
      if ((rpcErr as { code?: string }).code !== "PGRST202" && !msg.includes("function public.save_page_content")) {
        logger.error("RPC save_page_content failed in addCodeSnippetToPageAction", rpcErr);
        return { success: false, code: "RPC_ERROR", error: rpcErr.message };
      }
    }

    // Fallback: direct update with revision increment
    const nextRev = targetRev + 1;
    const { error: updateErr } = await supabase
      .from("pages")
      .update({
        content: newBlocks,
        content_text: contentText,
        revision_id: nextRev,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id);

    if (updateErr) {
      logger.error("Failed to update page with code snippet", updateErr);
      return { success: false, code: "UPDATE_FAILED", error: updateErr.message || "Could not update page" };
    }

    // Record activity non-blocking
    try {
      await supabase.from("page_activity").insert({
        organization_id: activeOrg.id,
        page_id: params.pageId,
        actor_id: user.id,
        action: "content_updated",
        metadata: {
          reason: "code_snippet_added",
          filePath: params.filePath,
        },
      });
    } catch {
      // Non-blocking
    }

    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${params.pageId}`);

    return { success: true, pageId: params.pageId, blocks: newBlocks };
  } catch (err: unknown) {
    logger.error("Unexpected error in addCodeSnippetToPageAction", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Exports a page document content. Enforces pages.share permission.
 */
export async function exportPageAction(params: {
  pageId: string;
  format?: "markdown" | "json";
}): Promise<{ success: boolean; data?: string; error?: string }> {
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

    const canShare = await hasPermission(user.id, activeOrg.id, "pages.share");
    if (!canShare) {
      return { success: false, error: "Forbidden: You do not have permission to share or export pages." };
    }

    const { data: page, error } = await supabase
      .from("pages")
      .select("id, title, content, content_text, created_at, updated_at")
      .eq("id", params.pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (error || !page) {
      return { success: false, error: "Page not found" };
    }

    if (params.format === "json") {
      return { success: true, data: JSON.stringify(page, null, 2) };
    }

    // Default to markdown
    const md = `# ${page.title}\n\n${page.content_text || ""}`;
    return { success: true, data: md };
  } catch (err: unknown) {
    logger.error("Error exporting page", err);
    return { success: false, error: "Failed to export page" };
  }
}
