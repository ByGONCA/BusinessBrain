import { NextResponse } from "next/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimit("billing-entitlement", user.id, RATE_LIMIT_PRESETS.API_STANDARD);
    if (!rl.success) {
      logger.warn("Rate limit exceeded on billing entitlement", { userId: user.id });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return NextResponse.json({ error: "No active organization" }, { status: 404 });
    }

    const entitlement = await getOrganizationEntitlement(activeOrg.id);
    return NextResponse.json({
      organizationId: activeOrg.id,
      organizationName: activeOrg.name,
      entitlement,
    });
  } catch (err: unknown) {
    logger.error("Error fetching billing entitlement", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
