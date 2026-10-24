// ==============================================================================
// Company Brain: Google Drive API Client & Knowledge Importer
// Fetches Docs/Sheets/Files, computes SHA-256 content hashes, and syncs into imported_documents
// ==============================================================================

import crypto from "crypto";
import { getAuthenticatedGoogleClient } from "./client";
import { logger } from "@/lib/security/logger";
import { createServiceClient } from "@/lib/supabase/server";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

/**
 * Lists files from Google Drive with optional query and pagination.
 */
export async function listDriveFiles(
  organizationId: string,
  options?: {
    pageSize?: number;
    pageToken?: string;
    query?: string;
    accountEmail?: string;
  }
): Promise<GoogleDriveListResponse> {
  const client = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail: options?.accountEmail,
    service: "google_drive",
    requiredScope: "drive",
  });

  const params = new URLSearchParams({
    pageSize: String(options?.pageSize || 50),
    fields: "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size, parents)",
    q: options?.query || "trashed = false",
  });

  if (options?.pageToken) {
    params.set("pageToken", options.pageToken);
  }

  const res = await client.googleFetch(`/drive/v3/files?${params.toString()}`);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    logger.error("Failed to list Google Drive files", { status: res.status, errorText });
    throw new Error(`Google Drive API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Fetches content of a Google Doc as plain text or exports it.
 */
export async function exportDriveFileContent(
  organizationId: string,
  fileId: string,
  mimeType: string,
  accountEmail?: string
): Promise<string> {
  const client = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail,
    service: "google_drive",
    requiredScope: "drive",
  });

  // Google Docs format: export as text/plain
  if (mimeType === "application/vnd.google-apps.document") {
    const res = await client.googleFetch(
      `/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    );
    if (!res.ok) {
      throw new Error(`Failed to export Google Doc ${fileId}: ${res.status}`);
    }
    return await res.text();
  }

  // Plain text, Markdown, or CSV
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType.includes("markdown")
  ) {
    const res = await client.googleFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    if (!res.ok) {
      throw new Error(`Failed to download Drive file ${fileId}: ${res.status}`);
    }
    return await res.text();
  }

  return `[Binary file: ${mimeType}]`;
}

/**
 * Synchronizes files from Google Drive into public.imported_documents.
 */
export async function syncGoogleDriveFiles(
  organizationId: string,
  accountEmail?: string
): Promise<{ syncedCount: number; failedCount: number }> {
  const supabase = createServiceClient();
  const startTime = new Date();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "google",
      sync_type: "drive_documents",
      status: "in_progress",
      details: { accountEmail },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const listRes = await listDriveFiles(organizationId, {
      pageSize: 30,
      accountEmail,
      query: "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')",
    });

    for (const file of listRes.files) {
      try {
        const textContent = await exportDriveFileContent(
          organizationId,
          file.id,
          file.mimeType,
          accountEmail
        );
        const contentHash = crypto.createHash("sha256").update(textContent, "utf8").digest("hex");

        await supabase.from("imported_documents").upsert(
          {
            organization_id: organizationId,
            source_platform: "google_drive",
            source_id: file.id,
            source_url: file.webViewLink || null,
            parent_source_id: file.parents?.[0] || null,
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
        logger.warn("Failed to sync Drive file", { fileId: file.id, error: fileErr.message });
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
    logger.error("Failed Google Drive sync job", err, { organizationId });

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

    throw err;
  }
}
