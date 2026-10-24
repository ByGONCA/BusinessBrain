import { NextResponse } from "next/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { hasPermission } from "@/lib/permissions/resolver";
import { verifyAndSyncCheckoutSession } from "@/lib/stripe/actions";

export async function GET(req: Request) {
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

    const canViewBilling =
      activeOrg.role === "owner" ||
      activeOrg.role === "admin" ||
      (await hasPermission(user.id, activeOrg.id, "billing.view"));

    if (!canViewBilling) {
      return NextResponse.json({ error: "Forbidden: Missing permission 'billing.view'" }, { status: 403 });
    }

    // Inspect optional session_id query parameter
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (sessionId) {
      if (!sessionId.startsWith("cs_") || sessionId.length > 255) {
        return NextResponse.json({ error: "Invalid session_id format." }, { status: 400 });
      }
    }

    let entitlement = await getOrganizationEntitlement(activeOrg.id);

    // If session_id is provided and the organization is not yet marked entitled
    // (e.g. user returned from Stripe Checkout before the asynchronous webhook finished)
    if (sessionId && !entitlement.isEntitled) {
      // Rate limit upstream Stripe session verification attempts to prevent API exhaustion
      const checkoutRl = await rateLimit("verify-checkout-session", `${user.id}:${sessionId}`, {
        limit: 4,
        windowSeconds: 20,
        failClosed: false,
      });

      if (!checkoutRl.success) {
        return NextResponse.json(
          {
            error: "Verification in progress. Please wait a moment for subscription confirmation.",
            entitlement,
          },
          { status: 429 }
        );
      }

      const syncResult = await verifyAndSyncCheckoutSession(sessionId);

      if (syncResult.error && syncResult.code?.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: syncResult.error }, { status: 403 });
      }

      if (syncResult.entitlement) {
        entitlement = syncResult.entitlement;
      }
    }

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
