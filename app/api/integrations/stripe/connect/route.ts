import { NextResponse } from "next/server";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { generateStripeConnectAuthUrl } from "@/lib/integrations/stripe/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl, getStripeCallbackUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit by authenticated user ID
  const rl = await rateLimit("stripe-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on Stripe connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Strict role enforcement: Only Owner, Admin, or users with explicit integrations.connect permission
  const isAuthorized =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "integrations.connect"));

  if (!isAuthorized) {
    logger.warn("Unauthorized attempt to connect Stripe for organization", {
      userId: user.id,
      organizationId: activeOrg.id,
      role: activeOrg.role,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/dashboard?settings=integrations");

  try {
    const supabase = await createClient();
    const callbackUrl = getStripeCallbackUrl(request);
    const authUrl = await generateStripeConnectAuthUrl({
      supabase,
      organizationId: activeOrg.id,
      userId: user.id,
      returnUrl,
      redirectUri: callbackUrl,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    logger.error("Failed to generate Stripe Connect auth URL", err, {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=stripe_config_error", request.url)
    );
  }
}
