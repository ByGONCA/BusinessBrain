import { createClient } from "@/lib/supabase/server";
import { FileProvider, ProviderAccessCheck } from "./base";
import {
  StorageProvider,
  OrganizationFileRecord,
  FilePreviewInfo,
  ExternalFileMetadata,
} from "../types";

export const COMPANY_BRAIN_STORAGE_BUCKET = "organization_files";
const SIGNED_URL_PREVIEW_EXPIRY_SECONDS = 300; // 5 minutes
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
    const { data, error } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, SIGNED_URL_PREVIEW_EXPIRY_SECONDS);

    const previewUrl = error ? null : data?.signedUrl || null;
    const mime = file.mime_type.toLowerCase();

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
      thumbnailUrl: previewType === "image" ? previewUrl : null,
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
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn("Supabase storage deletion warning:", error.message);
    }
  }
}
