import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import {
  generateShopifyAuthUrl,
  verifyShopifyOAuthState,
} from "@/lib/integrations/shopify/oauth";
import { sanitizeShopDomain } from "@/lib/integrations/shopify/config";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit by authenticated user ID
  const rl = await rateLimit("shopify-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on Shopify connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Verify permission: requires integrations.connect or admin/owner role
  const hasManagePermission =
    activeOrg.role === "owner" ||
    activeOrg.role === "admin" ||
    (await hasPermission(user.id, activeOrg.id, "integrations.connect"));

  if (!hasManagePermission) {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const rawShop = searchParams.get("shop");
  const cleanShop = sanitizeShopDomain(rawShop);

  if (!cleanShop) {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=invalid_shop_domain", request.url)
    );
  }

  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/dashboard?settings=integrations&provider=shopify");

  try {
    const authUrl = generateShopifyAuthUrl({
      organizationId: activeOrg.id,
      userId: user.id,
      shop: cleanShop,
      returnUrl,
      request,
    });

    const response = NextResponse.redirect(authUrl);

    // Set single-use ephemeral state nonce cookie to reject OAuth replay attacks
    const stateParam = new URL(authUrl).searchParams.get("state");
    if (stateParam) {
      const statePayload = verifyShopifyOAuthState(stateParam);
      if (statePayload?.nonce) {
        response.cookies.set("cb_shopify_oauth_nonce", statePayload.nonce, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 900, // 15 minutes
        });
      }
    }

    return response;
  } catch (err: unknown) {
    logger.error("Failed to generate Shopify auth URL", err, {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=shopify_config_error", request.url)
    );
  }
}
