import { redirect } from "next/navigation";

interface IntegrationsPageProps {
  searchParams: Promise<{ status?: string; error?: string; open?: string }>;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const { status, error, open } = await searchParams;
  const query = new URLSearchParams();
  query.set("settings", "integrations");
  if (status) query.set("status", status);
  if (error) query.set("error", error);
  if (open) query.set("open", open);

  redirect(`/dashboard?${query.toString()}`);
}
