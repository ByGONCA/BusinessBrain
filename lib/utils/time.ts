// ==============================================================================
// Company Brain: Relative Time & Date Formatting Utilities
// ==============================================================================

/**
 * Formats a timestamp into a human-readable relative time string.
 * Examples:
 * - "just now"
 * - "2 min ago"
 * - "15 min ago"
 * - "2 hours ago"
 * - "yesterday"
 * - "3 days ago"
 * - "2 weeks ago"
 * - "3 months ago"
 * - "1 year ago"
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "just now";

  const date = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // If time is in the future or within 45 seconds, display "just now"
  if (diffInSeconds < 45) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? "1 hour ago" : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? "1 week ago" : `${diffInWeeks} weeks ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30.44);
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? "1 month ago" : `${diffInMonths} months ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365.25);
  return diffInYears === 1 ? "1 year ago" : `${diffInYears} years ago`;
}

/**
 * Formats a timestamp into an exact, localized date and time string suitable for tooltips.
 * Example: "October 8, 2026 at 17:32"
 */
export function formatExactDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  try {
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

    const formattedTime = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

    return `${formattedDate} at ${formattedTime}`;
  } catch {
    return date.toLocaleString();
  }
}
