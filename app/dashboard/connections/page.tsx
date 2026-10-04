import { redirect } from "next/navigation";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyGraphData } from "@/lib/connections/queries";
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

  // Parallel data loading with lightweight metadata boundary (no heavy block contents)
  const [graphData, pagesRes, entitiesRes] = await Promise.all([
    getCompanyGraphData(activeOrg.id),
    supabase
      .from("pages")
      .select("id, title, icon, parent_page_id")
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false)
      .order("is_favorite", { ascending: false })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("company_entities")
      .select("id, title, type")
      .eq("organization_id", activeOrg.id),
  ]);

  const pages = (pagesRes.data || []).map((p) => ({
    id: p.id,
    title: p.title || "Untitled Page",
    icon: p.icon || "📄",
    parent_page_id: p.parent_page_id,
  }));

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
