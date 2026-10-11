"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization, isValidUuid, assertValidUuid } from "@/lib/security/authorization";
import { validateFileMetadata, sanitizeFilename } from "@/lib/storage/validation";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";
import { assertStorageQuotaAvailable } from "./quotas";
import { getFileProvider } from "./providers/registry";
import { CompanyBrainStorageProvider } from "./providers/company-brain";
import { generateAndPersistImageVariants } from "@/lib/storage/image-service";
import {
  StorageProvider,
  OrganizationFileRecord,
  PageFileRecord,
  UploadAuthorizationRequest,
  UploadAuthorizationResponse,
  FilePreviewInfo,
  ExternalFileListResult,
} from "./types";
import { ListFilesOptions } from "./providers/base";

const companyBrainProvider = new CompanyBrainStorageProvider();

/**
 * 1. Authorizes a direct-to-storage file upload.
 * Validates metadata, checks organization storage quota, creates a pending database entry,
 * and generates a short-lived Supabase Storage signed upload URL.
 */
export async function requestUploadAuthorizationAction(
  input: UploadAuthorizationRequest
): Promise<UploadAuthorizationResponse> {
  const { user, activeOrg } = await requireActiveOrganization();

  const canUpload = await hasPermission(user.id, activeOrg.id, "files.upload");
  if (!canUpload) {
    throw new Error("Forbidden: You do not have permission to upload files.");
  }

  // Rate limit upload requests per user
  const rl = await rateLimit("upload-auth", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many upload requests. Please wait a moment.");
  }

  // Validate filename, MIME type, and size
  const validation = validateFileMetadata(input.filename, input.mimeType, input.sizeBytes);
  if (!validation.isValid || !validation.sanitizedFilename) {
    throw new Error(validation.error || "Invalid file.");
  }

  // Assert storage quota is available
  await assertStorageQuotaAvailable(activeOrg.id, input.sizeBytes);

  const supabase = await createClient();

  // Create pending organization_files record
  const { data: fileRecord, error: insertError } = await supabase
    .from("organization_files")
    .insert({
      organization_id: activeOrg.id,
      uploaded_by: user.id,
      name: validation.sanitizedFilename,
      original_name: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_provider: "company_brain",
      status: "pending_upload",
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !fileRecord) {
    logger.error("Failed to create pending file record", insertError, {
      orgId: activeOrg.id,
      filename: validation.sanitizedFilename,
    });
    throw new Error("Could not initialize upload session.");
  }

  // Generate storage path: {organization_id}/{file_id}/{sanitized_filename}
  const storagePath = `${activeOrg.id}/${fileRecord.id}/${validation.sanitizedFilename}`;

  // Update storage_path on the record
  await supabase
    .from("organization_files")
    .update({ storage_path: storagePath })
    .eq("id", fileRecord.id);

  // Generate signed upload URL from Supabase Storage
  const signed = await companyBrainProvider.createSignedUploadUrl(storagePath);

  logger.info("Upload authorization granted", {
    fileId: fileRecord.id,
    orgId: activeOrg.id,
    userId: user.id,
    sizeBytes: input.sizeBytes,
  });

  return {
    fileId: fileRecord.id,
    signedUploadUrl: signed.signedUrl,
    storagePath,
    token: signed.token,
  };
}

/**
 * 2. Confirms a completed upload, marks file as ready, and optionally links it to a page.
 */
export async function confirmFileUploadAction(
  fileId: string,
  pageId?: string
): Promise<OrganizationFileRecord> {
  assertValidUuid(fileId, "File ID");
  const { user, activeOrg } = await requireActiveOrganization();

  const supabase = await createClient();

  const { data: file, error: fetchError } = await supabase
    .from("organization_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (fetchError || !file) {
    throw new Error("File not found or organization mismatch.");
  }

  // Mark status as ready
  const { data: updated, error: updateError } = await supabase
    .from("organization_files")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error("Failed to activate file record.");
  }

  // Optionally link to page
  if (pageId && isValidUuid(pageId)) {
    await supabase.from("page_files").upsert(
      {
        organization_id: activeOrg.id,
        page_id: pageId,
        file_id: fileId,
        created_by: user.id,
      },
      { onConflict: "organization_id, page_id, file_id" }
    );

    revalidatePath(`/dashboard/pages/${pageId}`);
  }

  // Generate optimized WebP thumbnail & display variants (with EXIF/GPS stripped) for raster images
  if (updated.storage_provider === "company_brain" && updated.mime_type.startsWith("image/")) {
    try {
      await generateAndPersistImageVariants(fileId, activeOrg.id);
    } catch (variantErr) {
      logger.warn("Image variant generation deferred or failed", {
        fileId,
        error: variantErr instanceof Error ? variantErr.message : String(variantErr),
      });
    }
  }

  logger.info("File upload confirmed", {
    fileId,
    orgId: activeOrg.id,
    pageId,
  });

  return updated as OrganizationFileRecord;
}

/**
 * 3. Links an external file (e.g. Google Drive) to the organization and attaches to a page.
 * Strictly creates a reference; never duplicates the physical file content.
 */
export async function linkExternalFileAction(input: {
  provider: StorageProvider;
  externalFileId: string;
  pageId?: string;
}): Promise<OrganizationFileRecord> {
  const { user, activeOrg } = await requireActiveOrganization();

  if (!input.externalFileId) {
    throw new Error("External file identifier is required.");
  }

  const provider = getFileProvider(input.provider);
  const metadata = await provider.getFileMetadata(activeOrg.id, input.externalFileId);

  const supabase = await createClient();

  // Upsert external file record
  const { data: fileRecord, error } = await supabase
    .from("organization_files")
    .upsert(
      {
        organization_id: activeOrg.id,
        uploaded_by: user.id,
        name: sanitizeFilename(metadata.name),
        original_name: metadata.name,
        mime_type: metadata.mimeType,
        size_bytes: metadata.sizeBytes || 0,
        storage_provider: input.provider,
        external_file_id: metadata.id,
        external_url: metadata.webViewLink || null,
        status: "ready",
        metadata: {
          iconLink: metadata.iconLink,
          thumbnailLink: metadata.thumbnailLink,
          webViewLink: metadata.webViewLink,
          webContentLink: metadata.webContentLink,
          modifiedTime: metadata.modifiedTime,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id, storage_provider, external_file_id",
      }
    )
    .select("*")
    .single();

  if (error || !fileRecord) {
    logger.error("Failed to link external file reference", error, {
      orgId: activeOrg.id,
      provider: input.provider,
      externalFileId: input.externalFileId,
    });
    throw new Error("Could not link external file reference.");
  }

  if (input.pageId && isValidUuid(input.pageId)) {
    await supabase.from("page_files").upsert(
      {
        organization_id: activeOrg.id,
        page_id: input.pageId,
        file_id: fileRecord.id,
        created_by: user.id,
      },
      { onConflict: "organization_id, page_id, file_id" }
    );

    revalidatePath(`/dashboard/pages/${input.pageId}`);
  }

  logger.info("External file linked", {
    fileId: fileRecord.id,
    orgId: activeOrg.id,
    provider: input.provider,
    pageId: input.pageId,
  });

  return fileRecord as OrganizationFileRecord;
}

/**
 * 4. Attaches an existing organization file to a page without duplicating it.
 */
export async function attachFileToPageAction(
  pageId: string,
  fileId: string
): Promise<void> {
  assertValidUuid(pageId, "Page ID");
  assertValidUuid(fileId, "File ID");

  const { user, activeOrg } = await requireActiveOrganization();
  const supabase = await createClient();

  // Verify file exists in this organization
  const { data: file } = await supabase
    .from("organization_files")
    .select("id")
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id)
    .maybeSingle();

  if (!file) {
    throw new Error("File not found in active organization.");
  }

  await supabase.from("page_files").upsert(
    {
      organization_id: activeOrg.id,
      page_id: pageId,
      file_id: fileId,
      created_by: user.id,
    },
    { onConflict: "organization_id, page_id, file_id" }
  );

  revalidatePath(`/dashboard/pages/${pageId}`);
}

/**
 * 5. Detaches a file from a page.
 * Preserves the file in organization_files. Only the relationship is removed.
 */
export async function detachFileFromPageAction(
  pageId: string,
  fileId: string
): Promise<void> {
  assertValidUuid(pageId, "Page ID");
  assertValidUuid(fileId, "File ID");

  const { activeOrg } = await requireActiveOrganization();
  const supabase = await createClient();

  await supabase
    .from("page_files")
    .delete()
    .eq("organization_id", activeOrg.id)
    .eq("page_id", pageId)
    .eq("file_id", fileId);

  revalidatePath(`/dashboard/pages/${pageId}`);
}

/**
 * 6. Deletes an organization file.
 * - For company_brain: Deletes storage object and database record, reclaiming quota.
 * - For external files: Deletes Company Brain reference; never deletes file on external cloud.
 */
export async function deleteOrganizationFileAction(fileId: string): Promise<void> {
  assertValidUuid(fileId, "File ID");
  const { user, activeOrg } = await requireActiveOrganization();

  const canDelete = await hasPermission(user.id, activeOrg.id, "files.delete");
  if (!canDelete) {
    throw new Error("Forbidden: You do not have permission to delete files.");
  }

  const supabase = await createClient();

  const { data: file, error } = await supabase
    .from("organization_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (error || !file) {
    throw new Error("File not found.");
  }

  // If internal file, delete from Supabase storage (including all generated variants)
  if (file.storage_provider === "company_brain" && file.storage_path) {
    try {
      const pathsToDelete = [file.storage_path];
      const variants = (file.metadata as Record<string, unknown> | undefined)?.variants as
        | Record<string, { storagePath: string }>
        | undefined;
      if (variants) {
        if (variants.thumbnail?.storagePath) pathsToDelete.push(variants.thumbnail.storagePath);
        if (variants.display?.storagePath) pathsToDelete.push(variants.display.storagePath);
      }
      await companyBrainProvider.deleteFileObjects(pathsToDelete);
    } catch (storageErr) {
      console.warn("Storage object deletion warning:", storageErr);
    }
  }

  // Delete database record (cascades to page_files)
  await supabase
    .from("organization_files")
    .delete()
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id);

  logger.info("File deleted from organization", {
    fileId,
    orgId: activeOrg.id,
    provider: file.storage_provider,
  });

  revalidatePath("/dashboard/pages");
}

/**
 * 7. Resolves preview information for a file (signed URL, provider embed, status).
 */
export async function getFilePreviewAction(
  fileId: string
): Promise<FilePreviewInfo> {
  assertValidUuid(fileId, "File ID");
  const { activeOrg } = await requireActiveOrganization();

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("organization_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (!file) {
    throw new Error("File not found.");
  }

  const provider = getFileProvider(file.storage_provider as StorageProvider);
  return provider.getPreview(activeOrg.id, file as OrganizationFileRecord);
}

/**
 * 8. Resolves an authorized download URL for a file.
 */
export async function getFileDownloadUrlAction(
  fileId: string
): Promise<string | null> {
  assertValidUuid(fileId, "File ID");
  const { activeOrg } = await requireActiveOrganization();

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("organization_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (!file) {
    throw new Error("File not found.");
  }

  const provider = getFileProvider(file.storage_provider as StorageProvider);
  return provider.getDownloadUrl(activeOrg.id, file as OrganizationFileRecord);
}

/**
 * 9. Lists external files from a provider (e.g. Google Drive) for the file picker.
 */
export async function listExternalFilesAction(
  providerKey: StorageProvider,
  options?: ListFilesOptions
): Promise<ExternalFileListResult> {
  const { activeOrg } = await requireActiveOrganization();
  const provider = getFileProvider(providerKey);

  if (!provider.listFiles) {
    throw new Error(`Provider ${providerKey} does not support file listing.`);
  }

  return provider.listFiles(activeOrg.id, options);
}

/**
 * 10. Fetches all files attached to a page.
 */
export async function getPageFilesAction(
  pageId: string
): Promise<PageFileRecord[]> {
  assertValidUuid(pageId, "Page ID");
  const { activeOrg } = await requireActiveOrganization();
  const { getPageFiles } = await import("./queries");
  return getPageFiles(activeOrg.id, pageId);
}

/**
 * 11. Batch resolves preview information (signed URLs, thumbnails, embeds) for multiple files.
 * Optimizes page load and editor blocks by querying multiple files in a single scoped request.
 */
export async function getFilePreviewsBatchAction(
  fileIds: string[]
): Promise<Record<string, FilePreviewInfo>> {
  if (!fileIds || fileIds.length === 0) return {};
  const validIds = Array.from(new Set(fileIds.filter((id) => isValidUuid(id))));
  if (validIds.length === 0) return {};

  const { activeOrg } = await requireActiveOrganization();
  const supabase = await createClient();

  const { data: files, error } = await supabase
    .from("organization_files")
    .select("*")
    .in("id", validIds)
    .eq("organization_id", activeOrg.id);

  if (error || !files) {
    logger.warn("Batch file preview query failed", { error: error?.message });
    return {};
  }

  const results: Record<string, FilePreviewInfo> = {};
  await Promise.all(
    files.map(async (file) => {
      try {
        const provider = getFileProvider(file.storage_provider as StorageProvider);
        results[file.id] = await provider.getPreview(activeOrg.id, file as OrganizationFileRecord);
      } catch (err) {
        logger.warn("Error resolving single preview in batch", {
          fileId: file.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  return results;
}

/**
 * 12. Lists files in the active organization for the file library picker.
 */
export async function getOrganizationFilesAction(options?: {
  provider?: StorageProvider;
  search?: string;
  limit?: number;
}): Promise<OrganizationFileRecord[]> {
  const { activeOrg } = await requireActiveOrganization();
  const { getOrganizationFiles } = await import("./queries");
  return getOrganizationFiles(activeOrg.id, options);
}


