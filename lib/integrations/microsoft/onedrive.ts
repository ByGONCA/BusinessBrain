// ==============================================================================
// KogSync: Microsoft OneDrive Client & Knowledge Importer
// Fetches Files, computes SHA-256 hashes, and syncs into imported_documents
// ==============================================================================

import crypto from "crypto";
import { getAuthenticatedMicrosoftClient } from "./client";
import { logger } from "@/lib/security/logger";
import { createServiceClient } from "@/lib/supabase/server";

export interface OneDriveFile {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  mimeType?: string;
  modifiedTime?: string;
  parentReference?: { id?: string; path?: string };
  isFolder?: boolean;
}

export interface OneDriveListResponse {
  files: OneDriveFile[];
  nextPageToken?: string;
}

/**
 * Lists files from OneDrive root or specific folder.
 */
export async function listOneDriveFiles(
  organizationId: string,
  options?: {
    pageSize?: number;
    pageToken?: string;
    query?: string;
    accountEmail?: string;
  }
): Promise<OneDriveListResponse> {
  const client = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail: options?.accountEmail,
    service: "onedrive",
  });

  const top = options?.pageSize || 50;
  let endpoint = `/me/drive/root/children?$top=${top}&$select=id,name,size,webUrl,file,folder,lastModifiedDateTime,parentReference`;

  if (options?.query && options.query.trim().length > 0) {
    endpoint = `/me/drive/root/search(q='${encodeURIComponent(options.query.trim())}')?$top=${top}&$select=id,name,size,webUrl,file,folder,lastModifiedDateTime,parentReference`;
  }

  const res = await client.microsoftFetch(endpoint);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    logger.error("Failed to list OneDrive files", { status: res.status, errorText });
    throw new Error(`OneDrive API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      name: string;
      size?: number;
      webUrl?: string;
      file?: { mimeType?: string };
      folder?: Record<string, unknown>;
      lastModifiedDateTime?: string;
      parentReference?: { id?: string; path?: string };
    }>;
    "@odata.nextLink"?: string;
  };

  const rawList = data.value || [];
  const files: OneDriveFile[] = rawList.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    webUrl: f.webUrl,
    mimeType: f.file?.mimeType || (f.folder ? "application/vnd.folder" : "application/octet-stream"),
    modifiedTime: f.lastModifiedDateTime,
    parentReference: f.parentReference,
    isFolder: !!f.folder,
  }));

  let nextPageToken: string | undefined;
  if (data["@odata.nextLink"]) {
    try {
      const url = new URL(data["@odata.nextLink"]);
      nextPageToken = url.searchParams.get("$skiptoken") || undefined;
    } catch {
      // ignore
    }
  }

  return { files, nextPageToken };
}

/**
 * Fetches content of a OneDrive file as text/plain or downloads content.
 */
export async function exportOneDriveFileContent(
  organizationId: string,
  fileId: string,
  mimeType?: string,
  accountEmail?: string
): Promise<string> {
  const client = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail,
    service: "onedrive",
  });

  const res = await client.microsoftFetch(`/me/drive/items/${encodeURIComponent(fileId)}/content`);
  if (!res.ok) {
    throw new Error(`Failed to download OneDrive file ${fileId}: ${res.status}`);
  }

  // If text, markdown, CSV, or json
  const m = (mimeType || "").toLowerCase();
  if (
    m.startsWith("text/") ||
    m.includes("markdown") ||
    m.includes("json") ||
    m.includes("csv")
  ) {
    return await res.text();
  }

  // Attempt text extraction
  try {
    const rawText = await res.text();
    // Verify if mostly printable ASCII/UTF-8
    if (/^[\x20-\x7E\r\n\t\u00A0-\uFFFF]*$/.test(rawText.slice(0, 500))) {
      return rawText;
    }
  } catch {
    // binary fallback
  }

  return `[Binary file: ${mimeType || "application/octet-stream"}]`;
}

/**
 * Synchronizes files from OneDrive into public.imported_documents.
 */
export async function syncOneDriveFiles(
  organizationId: string,
  accountEmail?: string
): Promise<{ syncedCount: number; failedCount: number; error?: string }> {
  const supabase = createServiceClient();
  const startTime = new Date();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "microsoft",
      sync_type: "onedrive_documents",
      status: "in_progress",
      details: { accountEmail },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const listRes = await listOneDriveFiles(organizationId, {
      pageSize: 30,
      accountEmail,
    });

    const candidateFiles = listRes.files.filter((f) => !f.isFolder);

    for (const file of candidateFiles) {
      try {
        const textContent = await exportOneDriveFileContent(
          organizationId,
          file.id,
          file.mimeType,
          accountEmail
        );

        const contentHash = crypto.createHash("sha256").update(textContent, "utf8").digest("hex");

        await supabase.from("imported_documents").upsert(
          {
            organization_id: organizationId,
            source_platform: "onedrive",
            source_id: file.id,
            source_url: file.webUrl || null,
            parent_source_id: file.parentReference?.id || null,
            title: file.name,
            content_format: "markdown",
            content_payload: textContent,
            content_hash: contentHash,
            sync_status: "imported",
            metadata: {
              mimeType: file.mimeType,
              modifiedTime: file.modifiedTime,
              size: file.size,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id, source_platform, source_id" }
        );
        syncedCount++;
      } catch (fileErr: any) {
        logger.warn("Failed to sync OneDrive file", { fileId: file.id, error: fileErr.message });
        failedCount++;
      }
    }

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: failedCount > 0 ? "partial" : "completed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          details: { durationMs: Date.now() - startTime.getTime() },
        })
        .eq("id", logId);
    }

    return { syncedCount, failedCount };
  } catch (err: any) {
    logger.error("Failed OneDrive sync job", err, { organizationId });

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({
          status: "failed",
          items_synced: syncedCount,
          items_failed: failedCount,
          completed_at: new Date().toISOString(),
          error_message: err.message,
        })
        .eq("id", logId);
    }

    return { syncedCount, failedCount, error: err.message };
  }
}
