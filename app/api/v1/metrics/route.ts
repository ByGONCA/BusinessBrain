import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "read:metrics");
  if (!auth.authenticated) {
    return auth.response;
  }

  const supabase = createServiceClient();

  // Aggregate project and document metrics
  const [
    { count: totalProjects },
    { count: totalPages },
    { count: totalIntegrations },
    { data: activeSubscription },
  ] = await Promise.all([
    supabase
      .from("company_entities")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", auth.context.organizationId)
      .eq("type", "project"),
    supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", auth.context.organizationId),
    supabase
      .from("organization_integrations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", auth.context.organizationId)
      .eq("status", "connected"),
    supabase
      .from("subscriptions")
      .select("plan_tier, status, current_period_end")
      .eq("organization_id", auth.context.organizationId)
      .maybeSingle(),
  ]);

  return NextResponse.json(
    {
      organization: {
        id: auth.context.organizationId,
        name: auth.context.organizationName,
      },
      metrics: {
        projectsCount: totalProjects || 0,
        documentsCount: totalPages || 0,
        activeIntegrationsCount: totalIntegrations || 0,
        subscription: activeSubscription || { plan_tier: "enterprise", status: "active" },
        syncedAt: new Date().toISOString(),
      },
    },
    { headers: auth.headers }
  );
}
