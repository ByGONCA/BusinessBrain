import { redirect } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyGraphData } from "@/lib/connections/queries";
import { CompanyMapWorkspace } from "@/components/dashboard/connections/company-map-workspace";
import { EntityType } from "@/lib/connections/types";

interface ConnectionsPageProps {
  searchParams: Promise<{
    node?: string;
    focus?: string;
  }>;
}

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const { activeOrg } = await verifyAccessOrRedirect();

  if (!activeOrg) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;
  const initialSelectedNodeId = resolvedParams.node;
  const initialFocusDepth = resolvedParams.focus ? parseInt(resolvedParams.focus, 10) : undefined;

  // Fetch unified graph data (cached & organization-scoped)
  const graphData = await getCompanyGraphData(activeOrg.id);

  // Derive pages and entities directly from graphData nodes without redundant roundtrips
  const pages = graphData.nodes
    .filter((n) => n.type === "page")
    .map((p) => ({
      id: p.id,
      title: p.title || "Untitled Page",
      icon: p.icon || "📄",
      parent_page_id: p.parentId || null,
    }));

  const entities = graphData.nodes
    .filter((n) => n.type !== "page")
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type as EntityType,
    }));

  return (
    <CompanyMapWorkspace
      initialGraph={graphData}
      pages={pages}
      entities={entities}
      initialSelectedNodeId={initialSelectedNodeId}
      initialFocusDepth={initialFocusDepth}
    />
  );
}
