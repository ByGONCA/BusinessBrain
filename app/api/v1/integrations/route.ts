import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "read:integrations");
  if (!auth.authenticated) {
    return auth.response;
  }

  const supabase = createServiceClient();

  const [integrationsRes, syncLogsRes] = await Promise.all([
    supabase
      .from("organization_integrations")
      .select("id, provider, provider_account_id, account_email, status, scopes, last_sync_at, created_at")
      .eq("organization_id", auth.context.organizationId),
    supabase
      .from("integration_sync_logs")
      .select("id, provider, sync_type, status, items_synced, items_failed, error_message, started_at, completed_at")
      .eq("organization_id", auth.context.organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json(
    {
      organizationId: auth.context.organizationId,
      integrations: integrationsRes.data || [],
      recentSyncLogs: syncLogsRes.data || [],
    },
    { headers: auth.headers }
  );
}
