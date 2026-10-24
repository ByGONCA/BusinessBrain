"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { isValidUuid } from "@/lib/security/authorization";
import { importConfluenceSpace } from "./confluence";
import { importNotionDatabase } from "./notion";
import { ImportBatchResult, ImportSourcePlatform } from "./types";
import { logger } from "@/lib/security/logger";

export async function importConfluenceSpaceAction(params: {
  domain: string;
  email: string;
  apiToken: string;
  spaceKey: string;
}): Promise<ImportBatchResult> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const canManage = await hasPermission(user.id, activeOrg.id, "integrations.connect");
  if (!canManage) throw new Error("Forbidden: Missing permissions to import content.");

  try {
    const result = await importConfluenceSpace(activeOrg.id, params);
    revalidatePath("/dashboard");
    return result;
  } catch (err: any) {
    logger.error("Confluence space import failed", err);
    return {
      success: false,
      platform: "confluence",
      totalFound: 0,
      importedCount: 0,
      skippedDuplicates: 0,
      failedCount: 1,
      durationMs: 0,
      errors: [err.message || "Failed to import Confluence space."],
    };
  }
}

export async function importNotionDatabaseAction(params: {
  integrationToken: string;
  databaseId: string;
}): Promise<ImportBatchResult> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const canManage = await hasPermission(user.id, activeOrg.id, "integrations.connect");
  if (!canManage) throw new Error("Forbidden: Missing permissions to import content.");

  try {
    const result = await importNotionDatabase(activeOrg.id, params);
    revalidatePath("/dashboard");
    return result;
  } catch (err: any) {
    logger.error("Notion database import failed", err);
    return {
      success: false,
      platform: "notion",
      totalFound: 0,
      importedCount: 0,
      skippedDuplicates: 0,
      failedCount: 1,
      durationMs: 0,
      errors: [err.message || "Failed to import Notion database."],
    };
  }
}

export async function getImportedDocumentsAction(platform?: ImportSourcePlatform) {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return [];

  const supabase = await createClient();
  let query = supabase
    .from("imported_documents")
    .select("id, source_platform, source_id, source_url, parent_source_id, title, sync_status, metadata, imported_at, updated_at")
    .eq("organization_id", activeOrg.id)
    .order("imported_at", { ascending: false });

  if (platform) {
    query = query.eq("source_platform", platform);
  }

  const { data, error } = await query.limit(100);
  if (error || !data) return [];
  return data;
}
