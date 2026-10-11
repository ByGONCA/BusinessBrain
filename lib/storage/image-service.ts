import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import {
  processImageVariants,
  ImageVariantRecordInfo,
} from "./image-processor";
import { COMPANY_BRAIN_STORAGE_BUCKET } from "@/lib/files/providers/company-brain";

/**
 * Downloads an uploaded image from Supabase Storage, processes WebP thumbnail
 * and display variants (with EXIF/GPS stripped), uploads the variants, and records
 * variant metadata in the organization_files table.
 *
 * Safe and non-blocking: if image processing fails, the original file remains intact and ready.
 */
export async function generateAndPersistImageVariants(
  fileId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // 1. Fetch file record
    const { data: file, error: fetchErr } = await supabase
      .from("organization_files")
      .select("id, name, mime_type, storage_path, storage_provider, metadata")
      .eq("id", fileId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchErr || !file || !file.storage_path) {
      return false;
    }

    // Only process internal raster images
    if (
      file.storage_provider !== "company_brain" ||
      !file.mime_type.startsWith("image/") ||
      file.mime_type.includes("svg")
    ) {
      return false;
    }

    // Skip if variants already exist (idempotent)
    const existingMeta = (file.metadata || {}) as Record<string, unknown>;
    if (existingMeta.variants) {
      return true;
    }

    // 2. Download original file from Supabase Storage
    const { data: blob, error: downloadErr } = await supabase.storage
      .from(COMPANY_BRAIN_STORAGE_BUCKET)
      .download(file.storage_path);

    if (downloadErr || !blob) {
      logger.warn("Could not download file for image processing", {
        fileId,
        error: downloadErr?.message,
      });
      return false;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Process variants (WebP, auto-rotate, EXIF/GPS stripped)
    const processingResult = await processImageVariants(buffer);
    if (!processingResult.success || processingResult.variants.length === 0) {
      logger.warn("Image variant generation yielded no output", {
        fileId,
        error: processingResult.error,
      });
      return false;
    }

    // 4. Upload each variant to storage and build metadata record
    const variantsMap: Record<string, ImageVariantRecordInfo> = {};
    const sanitizedBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-]/g, "_");

    for (const variant of processingResult.variants) {
      const variantStoragePath = `${organizationId}/${fileId}/variants/${variant.purpose}_${sanitizedBase}.webp`;

      const { error: uploadErr } = await supabase.storage
        .from(COMPANY_BRAIN_STORAGE_BUCKET)
        .upload(variantStoragePath, variant.buffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (!uploadErr) {
        variantsMap[variant.purpose] = {
          storagePath: variantStoragePath,
          width: variant.width,
          height: variant.height,
          format: "webp",
          sizeBytes: variant.sizeBytes,
          purpose: variant.purpose,
          strippedMetadata: true,
          createdAt: new Date().toISOString(),
        };
      } else {
        logger.warn("Failed to upload image variant to storage", {
          fileId,
          variant: variant.purpose,
          error: uploadErr.message,
        });
      }
    }

    // 5. Update database record with variant metadata
    if (Object.keys(variantsMap).length > 0) {
      await supabase
        .from("organization_files")
        .update({
          metadata: {
            ...existingMeta,
            originalWidth: processingResult.originalWidth,
            originalHeight: processingResult.originalHeight,
            originalFormat: processingResult.originalFormat,
            hasAlpha: processingResult.hasAlpha,
            variants: variantsMap,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", fileId);

      logger.info("Generated and stored image variants successfully", {
        fileId,
        variants: Object.keys(variantsMap),
      });
      return true;
    }

    return false;
  } catch (err: unknown) {
    logger.warn("Non-blocking error during image variant generation", {
      fileId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
