import { headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { syncShopifyOrganizationData } from "@/lib/integrations/shopify/sync-engine";
import { logger } from "@/lib/security/logger";

function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const validSecrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.INTERNAL_MAINTENANCE_SECRET?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (validSecrets.length === 0) return false;

  for (const secret of validSecrets) {
    if (token.length === secret.length) {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Scheduled Periodic Reconciliation Route for Shopify Integrations
 * Discovers and catches up missing webhooks, reconciles catalog and order states.
 * Uses watermark overlap (last_sync_at - 60s) to guarantee zero missed boundary events.
 * Protected by CRON_SECRET or INTERNAL_MAINTENANCE_SECRET.
 */
export async function POST(req: Request) {
  const headerList = await headers();
  const authHeader = headerList.get("authorization");

  if (!isAuthorized(authHeader)) {
    logger.warn("Unauthorized Shopify reconciliation invocation attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetOrgId = typeof body.organizationId === "string" ? body.organizationId.trim() : null;

    const supabase = await createClient();

    let query = supabase
      .from("organization_integrations")
      .select("id, organization_id, provider_account_id, last_sync_at")
      .eq("provider", "shopify")
      .eq("status", "connected");

    if (targetOrgId) {
      query = query.eq("organization_id", targetOrgId);
    }

    const { data: stores, error } = await query;
    if (error) {
      logger.error("Failed to query connected Shopify integrations for reconciliation", error);
      return NextResponse.json({ error: "Database query failed" }, { status: 500 });
    }

    const results: Array<{
      organizationId: string;
      shop: string;
      success: boolean;
      itemsSynced?: number;
      error?: string;
    }> = [];

    for (const store of stores || []) {
      try {
        // Calculate watermark buffer (last_sync_at - 60s)
        let updatedAtMin: string | undefined = undefined;
        if (store.last_sync_at) {
          const watermarkDate = new Date(new Date(store.last_sync_at).getTime() - 60 * 1000);
          updatedAtMin = watermarkDate.toISOString();
        }

        const syncRes = await syncShopifyOrganizationData(store.organization_id, {
          updatedAtMin,
          forceFull: false,
        });

        results.push({
          organizationId: store.organization_id,
          shop: store.provider_account_id || "unknown",
          success: syncRes.success,
          itemsSynced: syncRes.itemsSynced,
          error: syncRes.errorMessage,
        });
      } catch (err: unknown) {
        results.push({
          organizationId: store.organization_id,
          shop: store.provider_account_id || "unknown",
          success: false,
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      reconciledStoresCount: results.length,
      results,
    });
  } catch (err: unknown) {
    logger.error("Periodic Shopify reconciliation failed with error", err);
    return NextResponse.json(
      { error: "Shopify reconciliation job encountered an error." },
      { status: 500 }
    );
  }
}
