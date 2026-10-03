import { createClient } from "@/lib/supabase/server";
import { OrganizationFileRecord, PageFileRecord, StorageProvider } from "./types";

export interface GetFilesOptions {
  provider?: StorageProvider;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Retrieves all files belonging to an organization with optional filtering.
 */
export async function getOrganizationFiles(
  organizationId: string,
  options?: GetFilesOptions
): Promise<OrganizationFileRecord[]> {
  const supabase = await createClient();

  let query = supabase
    .from("organization_files")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (options?.provider) {
    query = query.eq("storage_provider", options.provider);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    query = query.ilike("name", `%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching organization files:", error);
    return [];
  }

  return (data || []) as OrganizationFileRecord[];
}

/**
 * Retrieves all files attached to a specific page via page_files.
 */
export async function getPageFiles(
  organizationId: string,
  pageId: string
): Promise<PageFileRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("page_files")
    .select(`
      id,
      organization_id,
      page_id,
      file_id,
      position,
      created_by,
      created_at,
      file:organization_files (
        id,
        organization_id,
        uploaded_by,
        name,
        original_name,
        mime_type,
        size_bytes,
        storage_provider,
        storage_path,
        external_file_id,
        external_parent_id,
        external_url,
        status,
        metadata,
        created_at,
        updated_at,
        deleted_at
      )
    `)
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching page files:", error);
    return [];
  }

  // Filter out any where referenced file is soft-deleted or null
  const results: PageFileRecord[] = [];
  for (const item of (data || []) as unknown as Record<string, unknown>[]) {
    const rawFile = item.file;
    const fileRecord = (Array.isArray(rawFile) ? rawFile[0] : rawFile) as OrganizationFileRecord | undefined;
    if (fileRecord && !fileRecord.deleted_at) {
      results.push({
        id: String(item.id),
        organization_id: String(item.organization_id),
        page_id: String(item.page_id),
        file_id: String(item.file_id),
        position: Number(item.position) || 0,
        created_by: item.created_by ? String(item.created_by) : null,
        created_at: String(item.created_at),
        file: fileRecord,
      });
    }
  }

  return results;
}

/**
 * Retrieves a single organization file by ID, enforcing organization boundary.
 */
export async function getFileById(
  organizationId: string,
  fileId: string
): Promise<OrganizationFileRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as OrganizationFileRecord;
}
