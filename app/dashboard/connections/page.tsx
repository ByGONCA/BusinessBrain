import { redirect } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyGraphData } from "@/lib/connections/queries";
import { getPagesForOrg } from "@/lib/pages/queries";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  // Parallel data loading
  const [graphData, pages, entitiesRes] = await Promise.all([
    getCompanyGraphData(activeOrg.id),
    getPagesForOrg(activeOrg.id),
    supabase
      .from("company_entities")
      .select("id, title, type")
      .eq("organization_id", activeOrg.id),
  ]);

  const entities = (entitiesRes.data || []).map((e) => ({
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
