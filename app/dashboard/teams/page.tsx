import { redirect } from "next/navigation";

/**
 * Unified Teams Entry Point:
 * Redirection to the real-time, multi-tenant Teams management hub within the People section.
 * Preserves existing URLs and bookmarks while eliminating legacy mock data.
 */
export default function TeamsPage() {
  redirect("/dashboard/people?tab=teams");
}
