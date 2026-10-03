import { notFound } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPageById } from "@/lib/pages/queries";
import { BlockEditor } from "@/components/dashboard/pages/block-editor";

interface PageDetailProps {
  params: Promise<{ id: string }>;
}

export default async function PageDetailPage({ params }: PageDetailProps) {
  const { id } = await params;
  const { activeOrg } = await verifyAccessOrRedirect();

  if (!activeOrg) {
    notFound();
  }

  const page = await getPageById(id, activeOrg.id);

  if (!page || page.is_archived) {
    notFound();
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col">
      {/* Fluid Block Canvas */}
      <div className="flex-1 w-full">
        <BlockEditor page={page} />
      </div>
    </div>
  );
}
