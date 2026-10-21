/**
 * Pure utility functions for invitation parsing and normalization.
 * Safe to import in both Server Actions and Client Components.
 */

/**
 * Safely extracts raw invitation token from either a raw string or full URL (e.g. /invite/<token>).
 */
export function extractTokenFromInput(tokenOrLink: string): string {
  const trimmed = tokenOrLink.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/invite\/([a-f0-9]+)/i);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }
  return trimmed.toLowerCase();
}
