import { redirect } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPagesForOrg } from "@/lib/pages/queries";
import { createPageAction } from "@/lib/pages/actions";
import { PagesHub } from "@/components/dashboard/pages/pages-hub";

export default async function PagesIndexPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  if (!activeOrg) {
    redirect("/dashboard");
  }

  let pages = await getPagesForOrg(activeOrg.id);

  // If no pages exist yet in the organization, create the initial Getting Started page
  if (pages.length === 0) {
    const result = await createPageAction({
      title: "Getting Started",
      icon: "🚀",
    });

    if (result.success && result.page) {
      pages = [result.page];
    }
  }

  return <PagesHub initialPages={pages} organizationId={activeOrg.id} />;
}
