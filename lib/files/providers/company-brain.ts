import { createClient } from "@/lib/supabase/server";
import { FileProvider, ProviderAccessCheck } from "./base";
import {
  StorageProvider,
  OrganizationFileRecord,
  FilePreviewInfo,
  ExternalFileMetadata,
} from "../types";

export const COMPANY_BRAIN_STORAGE_BUCKET = "organization_files";
const SIGNED_URL_PREVIEW_EXPIRY_SECONDS = 3600; // 1 hour for resilient page editing and reading
const SIGNED_URL_DOWNLOAD_EXPIRY_SECONDS = 600; // 10 minutes

export class CompanyBrainStorageProvider implements FileProvider {
  readonly providerId: StorageProvider = "company_brain";

  async checkAccess(_organizationId: string): Promise<ProviderAccessCheck> {
    return { isConnected: true };
  }

  async getFileMetadata(
    _organizationId: string,
    _externalFileId: string
  ): Promise<ExternalFileMetadata> {
    throw new Error("Company Brain storage files are internal and do not have external file IDs.");
  }

  async getPreview(
    organizationId: string,
    file: OrganizationFileRecord
  ): Promise<FilePreviewInfo> {
    if (!file.storage_path) {
      return {
        previewType: "generic",
        previewUrl: null,
        isExternal: false,
        canEmbed: false,
        provider: this.providerId,
        status: file.status,
      };
    }

    const supabase = await createClient();
    const mime = file.mime_type.toLowerCase();

    // Check for optimized variants in metadata
    const metadataVariants = (file.metadata as Record<string, unknown> | undefined)?.variants as
      | Record<string, { storagePath: string }>
      | undefined;

    const displayVariantPath = metadataVariants?.display?.storagePath;
    const thumbnailVariantPath = metadataVariants?.thumbnail?.storagePath;

    // Use optimized display variant for preview if available, otherwise original
    const pathToPreview = displayVariantPath || file.storage_path;

    const { data: previewData, error: previewErr } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .createSignedUrl(pathToPreview, SIGNED_URL_PREVIEW_EXPIRY_SECONDS);

    const previewUrl = previewErr ? null : previewData?.signedUrl || null;

    // Resolve thumbnail signed URL if thumbnail variant exists
    let thumbnailUrl: string | null = null;
    if (thumbnailVariantPath) {
      const { data: thumbData } = await supabase.storage
        .from(COMPANY_BRAIN_STORAGE_BUCKET)
        .createSignedUrl(thumbnailVariantPath, SIGNED_URL_PREVIEW_EXPIRY_SECONDS);
      thumbnailUrl = thumbData?.signedUrl || previewUrl;
    } else if (mime.startsWith("image/")) {
      thumbnailUrl = previewUrl;
    }

    let previewType: FilePreviewInfo["previewType"] = "generic";
    let canEmbed = false;

    if (mime.startsWith("image/")) {
      previewType = "image";
      canEmbed = true;
    } else if (mime === "application/pdf") {
      previewType = "pdf";
      canEmbed = true;
    } else if (mime.startsWith("video/")) {
      previewType = "video";
      canEmbed = true;
    } else if (mime.startsWith("audio/")) {
      previewType = "audio";
      canEmbed = true;
    } else if (
      mime.includes("word") ||
      mime.includes("sheet") ||
      mime.includes("excel") ||
      mime.includes("presentation") ||
      mime.includes("powerpoint")
    ) {
      previewType = "office";
      canEmbed = false;
    }

    return {
      previewType,
      previewUrl,
      thumbnailUrl,
      isExternal: false,
      canEmbed,
      provider: this.providerId,
      status: file.status,
    };
  }

  async getDownloadUrl(
    _organizationId: string,
    file: OrganizationFileRecord
  ): Promise<string | null> {
    if (!file.storage_path) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, SIGNED_URL_DOWNLOAD_EXPIRY_SECONDS, {
        download: file.name,
      });

    if (error || !data) return null;
    return data.signedUrl;
  }

  /**
   * Generates a signed upload URL for direct browser-to-storage uploads.
   */
  async createSignedUploadUrl(
    storagePath: string
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(`Failed to generate signed upload URL: ${error?.message || "Storage error"}`);
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
  }

  /**
   * Deletes a physical file object from Supabase Storage.
   */
  async deleteFileObject(storagePath: string): Promise<void> {
    await this.deleteFileObjects([storagePath]);
  }

  /**
   * Deletes multiple storage paths in a single batch operation.
   */
  async deleteFileObjects(storagePaths: string[]): Promise<void> {
    if (!storagePaths || storagePaths.length === 0) return;
    const cleanPaths = storagePaths.filter(Boolean);
    if (cleanPaths.length === 0) return;

    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .remove(cleanPaths);

    if (error) {
      console.warn("Supabase storage deletion warning:", error.message);
    }
  }
}
