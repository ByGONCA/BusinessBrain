import { notFound } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPageById, getPageBreadcrumbs } from "@/lib/pages/queries";
import { BlockEditor } from "@/components/dashboard/pages/block-editor";
import { PageBreadcrumbs } from "@/components/dashboard/pages/page-breadcrumbs";

interface PageDetailProps {
  params: Promise<{ id: string }>;
}

export default async function PageDetailPage({ params }: PageDetailProps) {
  const { id } = await params;
  const { activeOrg, user } = await verifyAccessOrRedirect();

  if (!activeOrg) {
    notFound();
  }

  const page = await getPageById(id, activeOrg.id);

  if (!page || page.is_archived) {
    notFound();
  }

  const breadcrumbs = await getPageBreadcrumbs(page.id, activeOrg.id);
  const fullBreadcrumbs =
    breadcrumbs.length > 0
      ? breadcrumbs
      : [{ id: page.id, title: page.title, icon: page.icon }];

  const currentUser = {
    id: user.id,
    email: user.email || "",
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "You",
    avatar_url: user.user_metadata?.avatar_url || null,
  };

  return (
    <div className="relative min-h-full flex flex-col -mt-6 md:-mt-8 -mx-6 md:-mx-8">
      {/* Top VS Code-Style Breadcrumbs Path Bar */}
      <PageBreadcrumbs
        breadcrumbs={fullBreadcrumbs}
        isFavorite={page.is_favorite}
        showSidePeekAction={true}
      />

      {/* Editor Content Canvas */}
      <div className="flex-1 w-full p-6 md:p-8 flex flex-col min-h-full">
        <BlockEditor page={page} currentUser={currentUser} />
      </div>
    </div>
  );
}
