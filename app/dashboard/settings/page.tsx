import { redirect } from "next/navigation";

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      query.set(key, value[0]);
    }
  }

  const rawTab = query.get("tab") || query.get("settings");
  let targetTab = "preferences";

  if (rawTab) {
    const lower = rawTab.toLowerCase().trim();
    if (lower === "general") targetTab = "workspace";
    else if (lower === "audit" || lower === "audit-log") targetTab = "audit_log";
    else if (lower === "billing-usage" || lower === "plans") targetTab = "billing";
    else if (lower === "members" || lower === "teams") targetTab = "people";
    else if (lower === "roles") targetTab = "permissions";
    else targetTab = lower;
  }

  query.set("settings", targetTab);
  query.delete("tab");

  redirect(`/dashboard?${query.toString()}`);
}
