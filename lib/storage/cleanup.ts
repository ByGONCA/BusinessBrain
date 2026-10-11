import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import { requireActiveOrganization, requireOrganizationRole } from "@/lib/security/authorization";
import { CompanyBrainStorageProvider } from "@/lib/files/providers/company-brain";

export interface CleanupReport {
  scannedCount: number;
  cleanedAbandonedCount: number;
  reclaimedBytes: number;
  errorsCount: number;
  details: Array<{
    fileId: string;
    organizationId: string;
    status: string;
    storagePath: string | null;
  }>;
}

const companyBrainProvider = new CompanyBrainStorageProvider();

/**
 * Identifies and removes abandoned pending uploads that were never confirmed.
 *
 * Rules & Safety:
 * 1. Only targets records where status = 'pending_upload'.
 * 2. Enforces threshold: created_at must be older than `olderThanHours` (default 2h).
 * 3. Never deletes files referenced by pages in page_files.
 * 4. Strictly scoped to organizationId if provided, or runs as authorized system maintenance.
 * 5. Idempotent: safe to run repeatedly; handles already deleted objects gracefully.
 */
export async function cleanupAbandonedUploads(options?: {
  organizationId?: string;
  olderThanHours?: number;
  useServiceClient?: boolean;
}): Promise<CleanupReport> {
  const olderThanHours = options?.olderThanHours ?? 2;
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

  const report: CleanupReport = {
    scannedCount: 0,
    cleanedAbandonedCount: 0,
    reclaimedBytes: 0,
    errorsCount: 0,
    details: [],
  };

  try {
    // Use scoped user client or service client for background maintenance
    const supabase = options?.useServiceClient ? createServiceClient() : await createClient();
    // 1. Query candidates matching pending_upload created before cutoff
    let query = supabase
      .from("organization_files")
      .select("id, organization_id, storage_path, size_bytes, metadata")
      .eq("status", "pending_upload")
      .eq("storage_provider", "company_brain")
      .lt("created_at", cutoffTime);

    if (options?.organizationId) {
      query = query.eq("organization_id", options.organizationId);
    }

    const { data: candidates, error: queryErr } = await query;

    if (queryErr || !candidates) {
      logger.error("Failed to query abandoned uploads for cleanup", queryErr);
      return report;
    }

    report.scannedCount = candidates.length;
    if (candidates.length === 0) {
      return report;
    }

    // 2. Filter out any candidate that is referenced in page_files
    const candidateIds = candidates.map((c) => c.id);
    const { data: activeReferences } = await supabase
      .from("page_files")
      .select("file_id")
      .in("file_id", candidateIds);

    const referencedIds = new Set((activeReferences || []).map((r) => r.file_id));

    // 3. Delete physical storage objects and unconfirmed database records
    for (const candidate of candidates) {
      if (referencedIds.has(candidate.id)) {
        // Skip files that have active references
        continue;
      }

      try {
        const pathsToDelete: string[] = [];
        if (candidate.storage_path) {
          pathsToDelete.push(candidate.storage_path);
        }

        const variants = (candidate.metadata as Record<string, unknown> | undefined)?.variants as
          | Record<string, { storagePath: string }>
          | undefined;
        if (variants) {
          if (variants.thumbnail?.storagePath) pathsToDelete.push(variants.thumbnail.storagePath);
          if (variants.display?.storagePath) pathsToDelete.push(variants.display.storagePath);
        }

        if (pathsToDelete.length > 0) {
          await companyBrainProvider.deleteFileObjects(pathsToDelete);
        }

        // Delete from organization_files
        const { error: deleteErr } = await supabase
          .from("organization_files")
          .delete()
          .eq("id", candidate.id)
          .eq("organization_id", candidate.organization_id);

        if (!deleteErr) {
          report.cleanedAbandonedCount += 1;
          report.reclaimedBytes += Number(candidate.size_bytes) || 0;
          report.details.push({
            fileId: candidate.id,
            organizationId: candidate.organization_id,
            status: "purged",
            storagePath: candidate.storage_path,
          });
        } else {
          report.errorsCount += 1;
        }
      } catch (err: unknown) {
        report.errorsCount += 1;
        logger.warn("Error cleaning individual abandoned upload", {
          fileId: candidate.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Abandoned upload cleanup complete", {
      cleanedCount: report.cleanedAbandonedCount,
      reclaimedBytes: report.reclaimedBytes,
    });

    return report;
  } catch (err: unknown) {
    logger.error("Cleanup execution failure", err);
    return report;
  }
}

/**
 * Server action to trigger organization-scoped cleanup of abandoned uploads.
 * Requires Owner or Admin role.
 */
export async function triggerOrganizationCleanupAction(
  olderThanHours = 2
): Promise<CleanupReport> {
  const { activeOrg } = await requireOrganizationRole(["owner", "admin"]);
  return cleanupAbandonedUploads({
    organizationId: activeOrg.id,
    olderThanHours,
    useServiceClient: false,
  });
}
