// ==============================================================================
// Company Brain: Google Workspace Comprehensive Sync Service
// Syncs Drive documents and Google Meet events into organization knowledge layer
// ==============================================================================

import { syncGoogleDriveFiles } from "./drive";
import { syncGoogleMeetEvents } from "./meet";
import { createServiceClient } from "@/lib/supabase/server";

export async function syncGoogleWorkspaceAction(
  organizationId: string
): Promise<{ driveSynced: number; meetSynced: number; error?: string }> {
  const supabase = createServiceClient();

  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, account_email")
    .eq("organization_id", organizationId)
    .in("provider", ["google", "google_drive", "google_calendar"])
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) {
    throw new Error("No active Google Workspace integration found.");
  }

  let driveSynced = 0;
  let meetSynced = 0;

  try {
    const driveRes = await syncGoogleDriveFiles(organizationId, integration.account_email || undefined).catch(
      () => ({ syncedCount: 0, failedCount: 0 })
    );
    driveSynced = driveRes.syncedCount;

    const meetRes = await syncGoogleMeetEvents(organizationId, integration.account_email || undefined).catch(
      () => ({ syncedCount: 0, failedCount: 0 })
    );
    meetSynced = meetRes.syncedCount;

    await supabase
      .from("organization_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id);

    return { driveSynced, meetSynced };
  } catch (err: any) {
    return { driveSynced, meetSynced, error: err.message };
  }
}
