import sharp from "sharp";
import { logger } from "@/lib/security/logger";

export interface ImageVariantSpec {
  purpose: "thumbnail" | "display";
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: "webp";
}

export interface ProcessedVariant {
  purpose: "thumbnail" | "display";
  buffer: Buffer;
  format: "webp";
  width: number;
  height: number;
  sizeBytes: number;
  strippedMetadata: boolean;
}

export interface ImageVariantRecordInfo {
  storagePath: string;
  width: number;
  height: number;
  format: "webp";
  sizeBytes: number;
  purpose: "thumbnail" | "display";
  strippedMetadata: boolean;
  createdAt: string;
}

export interface ImageProcessingResult {
  success: boolean;
  originalWidth?: number;
  originalHeight?: number;
  originalFormat?: string;
  hasAlpha?: boolean;
  variants: ProcessedVariant[];
  error?: string;
}

export const VARIANT_SPECS: ImageVariantSpec[] = [
  {
    purpose: "thumbnail",
    maxWidth: 320,
    maxHeight: 320,
    quality: 80,
    format: "webp",
  },
  {
    purpose: "display",
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 85,
    format: "webp",
  },
];

// Safety boundaries to prevent decompression bombs and memory exhaustion
export const MAX_IMAGE_PIXELS = 8192 * 8192; // 67 megapixels max
export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB max

/**
 * Validates the true file header (magic bytes) to prevent disguised non-image files.
 */
export function detectImageMagicBytes(buffer: Buffer): {
  isImage: boolean;
  format?: "jpeg" | "png" | "webp" | "gif";
  isAnimated?: boolean;
} {
  if (!buffer || buffer.length < 12) {
    return { isImage: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isImage: true, format: "jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isImage: true, format: "png" };
  }

  // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isImage: true, format: "webp" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { isImage: true, format: "gif", isAnimated: true };
  }

  return { isImage: false };
}

/**
 * Strips EXIF, GPS, and sensitive privacy metadata while preserving orientation and transparency.
 * Generates thumbnail (320px) and display (1280px) WebP variants.
 */
export async function processImageVariants(
  inputBuffer: Buffer
): Promise<ImageProcessingResult> {
  if (inputBuffer.length > MAX_IMAGE_INPUT_BYTES) {
    return {
      success: false,
      variants: [],
      error: `Input image exceeds maximum allowed size of ${MAX_IMAGE_INPUT_BYTES / (1024 * 1024)}MB.`,
    };
  }

  const magic = detectImageMagicBytes(inputBuffer);
  if (!magic.isImage) {
    return {
      success: false,
      variants: [],
      error: "Invalid or unsupported image file header.",
    };
  }

  try {
    const baseSharp = sharp(inputBuffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
    });

    const meta = await baseSharp.metadata();

    if (!meta.width || !meta.height) {
      return {
        success: false,
        variants: [],
        error: "Unable to read image dimensions.",
      };
    }

    if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
      return {
        success: false,
        variants: [],
        error: "Image resolution exceeds safety threshold (max 67MP).",
      };
    }

    const hasAlpha = Boolean(meta.hasAlpha);
    const variants: ProcessedVariant[] = [];

    for (const spec of VARIANT_SPECS) {
      // 1. .rotate(): Automatically orientates based on EXIF Orientation tag before stripping.
      // 2. .resize(): Scales down inside max bounding box without upscaling.
      // 3. .webp(): Converts to WebP. Omission of .withMetadata() guarantees all EXIF, GPS,
      //    and camera tags are completely stripped from the output.
      const pipeline = sharp(inputBuffer, {
        limitInputPixels: MAX_IMAGE_PIXELS,
      })
        .rotate()
        .resize({
          width: spec.maxWidth,
          height: spec.maxHeight,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: spec.quality,
          alphaQuality: hasAlpha ? 90 : 80,
          effort: 4,
        });

      const variantBuffer = await pipeline.toBuffer();
      const variantMeta = await sharp(variantBuffer).metadata();

      variants.push({
        purpose: spec.purpose,
        buffer: variantBuffer,
        format: "webp",
        width: variantMeta.width || spec.maxWidth,
        height: variantMeta.height || spec.maxHeight,
        sizeBytes: variantBuffer.length,
        strippedMetadata: true,
      });
    }

    return {
      success: true,
      originalWidth: meta.width,
      originalHeight: meta.height,
      originalFormat: meta.format || magic.format,
      hasAlpha,
      variants,
    };
  } catch (err: unknown) {
    logger.error("Image processing error", err);
    return {
      success: false,
      variants: [],
      error: err instanceof Error ? err.message : "Image processing failed",
    };
  }
}
