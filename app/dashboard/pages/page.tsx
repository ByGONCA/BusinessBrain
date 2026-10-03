import { redirect } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPagesForOrg } from "@/lib/pages/queries";
import { createPageAction } from "@/lib/pages/actions";

export default async function PagesIndexPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  if (!activeOrg) {
    redirect("/dashboard");
  }

  const pages = await getPagesForOrg(activeOrg.id);

  if (pages.length > 0) {
    redirect(`/dashboard/pages/${pages[0].id}`);
  }

  // If no pages exist yet in the organization, create the initial page
  const result = await createPageAction({
    title: "Getting Started",
    icon: "🚀",
  });

  if (result.success && result.page) {
    redirect(`/dashboard/pages/${result.page.id}`);
  }

  redirect("/dashboard");
}
