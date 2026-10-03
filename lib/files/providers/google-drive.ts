import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedGoogleClient } from "@/lib/integrations/google/client";
import { FileProvider, ListFilesOptions, ProviderAccessCheck } from "./base";
import {
  StorageProvider,
  OrganizationFileRecord,
  FilePreviewInfo,
  ExternalFileMetadata,
  ExternalFileListResult,
} from "../types";

export class GoogleDriveStorageProvider implements FileProvider {
  readonly providerId: StorageProvider = "google_drive";

  async checkAccess(organizationId: string): Promise<ProviderAccessCheck> {
    try {
      const client = await getAuthenticatedGoogleClient(organizationId);
      return {
        isConnected: true,
        accountEmail: client.accountEmail,
      };
    } catch (err: unknown) {
      return {
        isConnected: false,
        error: err instanceof Error ? err.message : "Google Drive not connected.",
      };
    }
  }

  async listFiles(
    organizationId: string,
    options?: ListFilesOptions
  ): Promise<ExternalFileListResult> {
    const client = await getAuthenticatedGoogleClient(organizationId);

    const pageSize = options?.pageSize || 30;
    const queryParts = ["trashed = false"];

    if (options?.query) {
      // Escape single quotes for Google Drive search query
      const sanitizedQuery = options.query.replace(/'/g, "\\'");
      queryParts.push(`name contains '${sanitizedQuery}'`);
    }

    if (options?.folderId) {
      const sanitizedFolder = options.folderId.replace(/'/g, "\\'");
      queryParts.push(`'${sanitizedFolder}' in parents`);
    }

    const params = new URLSearchParams({
      pageSize: String(pageSize),
      fields: "nextPageToken, files(id, name, mimeType, size, iconLink, thumbnailLink, webViewLink, webContentLink, modifiedTime)",
      q: queryParts.join(" and "),
      orderBy: "modifiedTime desc",
    });

    if (options?.pageToken) {
      params.set("pageToken", options.pageToken);
    }

    const res = await client.googleFetch(`/drive/v3/files?${params.toString()}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const files: ExternalFileMetadata[] = (data.files || []).map((f: Record<string, unknown>) => ({
      id: String(f.id),
      name: String(f.name || "Untitled"),
      mimeType: String(f.mimeType || "application/octet-stream"),
      sizeBytes: f.size ? Number(f.size) : undefined,
      iconLink: f.iconLink ? String(f.iconLink) : undefined,
      thumbnailLink: f.thumbnailLink ? String(f.thumbnailLink) : undefined,
      webViewLink: f.webViewLink ? String(f.webViewLink) : undefined,
      webContentLink: f.webContentLink ? String(f.webContentLink) : undefined,
      modifiedTime: f.modifiedTime ? String(f.modifiedTime) : undefined,
    }));

    return {
      files,
      nextPageToken: data.nextPageToken || undefined,
    };
  }

  async getFileMetadata(
    organizationId: string,
    externalFileId: string
  ): Promise<ExternalFileMetadata> {
    const client = await getAuthenticatedGoogleClient(organizationId);

    const params = new URLSearchParams({
      fields: "id, name, mimeType, size, iconLink, thumbnailLink, webViewLink, webContentLink, modifiedTime",
    });

    const res = await client.googleFetch(
      `/drive/v3/files/${encodeURIComponent(externalFileId)}?${params.toString()}`
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch Google Drive file metadata (${res.status})`);
    }

    const f = await res.json();
    return {
      id: String(f.id),
      name: String(f.name || "Untitled"),
      mimeType: String(f.mimeType || "application/octet-stream"),
      sizeBytes: f.size ? Number(f.size) : undefined,
      iconLink: f.iconLink ? String(f.iconLink) : undefined,
      thumbnailLink: f.thumbnailLink ? String(f.thumbnailLink) : undefined,
      webViewLink: f.webViewLink ? String(f.webViewLink) : undefined,
      webContentLink: f.webContentLink ? String(f.webContentLink) : undefined,
      modifiedTime: f.modifiedTime ? String(f.modifiedTime) : undefined,
    };
  }

  async getPreview(
    organizationId: string,
    file: OrganizationFileRecord
  ): Promise<FilePreviewInfo> {
    const access = await this.checkAccess(organizationId);

    if (!access.isConnected) {
      return {
        previewType: "generic",
        previewUrl: null,
        isExternal: true,
        canEmbed: false,
        provider: this.providerId,
        status: "unavailable",
      };
    }

    const mime = file.mime_type.toLowerCase();
    let previewType: FilePreviewInfo["previewType"] = "generic";
    let canEmbed = true;

    if (mime.startsWith("image/")) {
      previewType = "image";
    } else if (mime === "application/pdf") {
      previewType = "pdf";
    } else if (mime.startsWith("video/")) {
      previewType = "video";
    } else if (mime.startsWith("audio/")) {
      previewType = "audio";
    } else if (
      mime.includes("document") ||
      mime.includes("spreadsheet") ||
      mime.includes("presentation") ||
      mime.includes("google-apps")
    ) {
      previewType = "office";
    }

    // Google Drive webViewLink is ideal for iframe embedding or external link
    const previewUrl =
      (file.metadata?.webViewLink as string) ||
      file.external_url ||
      null;

    const thumbnailUrl =
      (file.metadata?.thumbnailLink as string) || null;

    return {
      previewType,
      previewUrl,
      thumbnailUrl,
      isExternal: true,
      canEmbed,
      provider: this.providerId,
      status: file.status,
    };
  }

  async getDownloadUrl(
    _organizationId: string,
    file: OrganizationFileRecord
  ): Promise<string | null> {
    return (
      (file.metadata?.webContentLink as string) ||
      file.external_url ||
      null
    );
  }

  async disconnect(organizationId: string): Promise<void> {
    const supabase = await createClient();
    // Update all google_drive files in this org to unavailable status without deleting
    await supabase
      .from("organization_files")
      .update({
        status: "unavailable",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("storage_provider", "google_drive");
  }
}
