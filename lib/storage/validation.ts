/**
 * File upload validation and sanitization for Company Brain Storage.
 * Enforces strict MIME type whitelists, size limits, and filename sanitization.
 */

export const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  // Images (SVG excluded — not permitted by Storage bucket policy; see migration 00005)
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".php",
  ".phtml",
  ".pl",
  ".py",
  ".rb",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".jar",
  ".vbs",
  ".ps1",
  ".dll",
  ".so",
  ".bin",
  ".com",
  ".scr",
  ".hta",
];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

/**
 * Sanitizes a candidate filename to prevent directory traversal and script execution.
 */
export function sanitizeFilename(filename: string): string {
  // Strip path traversal sequences and separators
  let clean = filename
    .replace(/^.*[\\\/]/, "") // Remove paths
    .replace(/[\x00-\x1f\x7f]/g, "_") // Replace null bytes and control chars with underscore
    .replace(/\.\.+/g, ".") // Remove double dots
    .trim();

  // Normalize Unicode
  clean = clean.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Replace invalid characters with underscore
  clean = clean.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

  // If filename begins with dot, prepend underscore
  if (clean.startsWith(".")) {
    clean = `_${clean}`;
  }

  // Prevent excessively long filenames
  if (clean.length > 200) {
    const ext = clean.substring(clean.lastIndexOf("."));
    const base = clean.substring(0, 190);
    clean = `${base}${ext}`;
  }

  return clean || "unnamed_file";
}

/**
 * Validates file upload metadata before sending to storage.
 */
export function validateFileMetadata(
  filename: string,
  mimeType: string,
  sizeBytes: number,
  maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES
): FileValidationResult {
  if (!filename || typeof filename !== "string") {
    return { isValid: false, error: "Filename is required." };
  }

  const sanitized = sanitizeFilename(filename);

  // Check dangerous extensions
  const lowerName = sanitized.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return {
        isValid: false,
        error: `File type "${ext}" is not permitted for security reasons.`,
      };
    }
  }

  // Check MIME whitelist
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      isValid: false,
      error: `File format "${mimeType}" is not permitted.`,
    };
  }

  // Check size limit
  if (sizeBytes <= 0) {
    return { isValid: false, error: "File cannot be empty." };
  }

  if (sizeBytes > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      isValid: false,
      error: `File exceeds maximum allowed size of ${maxMb}MB.`,
    };
  }

  return {
    isValid: true,
    sanitizedFilename: sanitized,
  };
}
