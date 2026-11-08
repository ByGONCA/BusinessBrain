// ==============================================================================
// KogSync: Microsoft 365 Comprehensive Sync Service
// Syncs OneDrive documents and Teams meetings into organization knowledge layer
// ==============================================================================

import { syncOneDriveFiles } from "./onedrive";
import { syncTeamsMeetings } from "./teams";
import { createServiceClient } from "@/lib/supabase/server";

export async function syncMicrosoftWorkspaceAction(
  organizationId: string
): Promise<{ oneDriveSynced: number; teamsSynced: number; error?: string }> {
  const supabase = createServiceClient();

  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, account_email")
    .eq("organization_id", organizationId)
    .in("provider", ["microsoft", "onedrive", "teams", "outlook", "outlook_calendar"])
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) {
    throw new Error("No active Microsoft integration found.");
  }

  let oneDriveSynced = 0;
  let teamsSynced = 0;

  try {
    const driveRes = await syncOneDriveFiles(organizationId, integration.account_email || undefined).catch(
      () => ({ syncedCount: 0, failedCount: 0 })
    );
    oneDriveSynced = driveRes.syncedCount;

    const teamsRes = await syncTeamsMeetings(organizationId, integration.account_email || undefined).catch(
      () => ({ syncedCount: 0, failedCount: 0 })
    );
    teamsSynced = teamsRes.syncedCount;

    await supabase
      .from("organization_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id);

    return { oneDriveSynced, teamsSynced };
  } catch (err: any) {
    return { oneDriveSynced, teamsSynced, error: err.message };
  }
}
