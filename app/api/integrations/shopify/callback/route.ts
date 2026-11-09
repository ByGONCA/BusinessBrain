import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyShopifyOAuthState,
  verifyShopifyQueryHmac,
  consumeShopifyOAuthNonceAtomic,
  exchangeShopifyCodeForToken,
} from "@/lib/integrations/shopify/oauth";
import { getShopifyOAuthConfig, sanitizeShopDomain } from "@/lib/integrations/shopify/config";
import { ShopifyClient } from "@/lib/integrations/shopify/client";
import { syncShopifyOrganizationData } from "@/lib/integrations/shopify/sync-engine";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl, getTrustedAppUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("shopify-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams } = new URL(request.url);
  const baseUrl = getTrustedAppUrl(request);
  const defaultRedirect = `${baseUrl}/dashboard?settings=integrations&provider=shopify`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Shopify callback", { clientIp });
    return NextResponse.redirect(`${defaultRedirect}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const rawShop = searchParams.get("shop");
  const hmac = searchParams.get("hmac");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    logger.warn("Shopify OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${defaultRedirect}&error=oauth_cancelled`);
  }

  if (!code || !state || !rawShop) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_parameters`);
  }

  const cleanShop = sanitizeShopDomain(rawShop);
  if (!cleanShop) {
    logger.warn("Shopify callback received with invalid shop domain", { rawShop });
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_shop_domain`);
  }

  const { clientSecret } = getShopifyOAuthConfig(request);

  // 1. Verify Shopify Query HMAC signature
  if (clientSecret) {
    const isHmacValid = verifyShopifyQueryHmac(searchParams, clientSecret);
    if (!isHmacValid) {
      logger.warn("Shopify OAuth callback HMAC signature verification failed", { cleanShop });
      return NextResponse.redirect(`${defaultRedirect}&error=invalid_hmac`);
    }
  } else if (process.env.NODE_ENV === "production") {
    logger.error("SHOPIFY_API_SECRET missing in production during callback verification");
    return NextResponse.redirect(`${defaultRedirect}&error=config_error`);
  }

  // 2. Verify CSRF HMAC State
  const statePayload = verifyShopifyOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Shopify OAuth state token received");
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  // Confirm state shop matches query shop
  if (statePayload.shop !== cleanShop) {
    logger.warn("Shopify OAuth state shop domain mismatch", {
      stateShop: statePayload.shop,
      queryShop: cleanShop,
    });
    return NextResponse.redirect(`${defaultRedirect}&error=shop_mismatch`);
  }

  // 2b. Validate single-use nonce cookie if present
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)cb_shopify_oauth_nonce=([^;]*)/);
  const cookieNonce = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  if (cookieNonce && cookieNonce !== statePayload.nonce) {
    logger.warn("Shopify OAuth state nonce mismatch with session cookie", {
      cookieNonce,
      stateNonce: statePayload.nonce,
    });
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  const safePath = sanitizeRedirectUrl(statePayload.returnUrl, "/dashboard?settings=integrations&provider=shopify");
  const redirectTarget = `${baseUrl}${safePath}`;

  // 3. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("Shopify OAuth state user mismatch", {
      stateUserId: statePayload.userId,
      currentUserId: currentUser?.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=user_mismatch`);
  }

  const supabase = await createClient();

  // 4. Atomic Replay Protection via Nonce Ledger
  const nonceConsumption = await consumeShopifyOAuthNonceAtomic(
    statePayload.organizationId,
    statePayload.nonce
  );

  if (!nonceConsumption.success) {
    logger.warn("Shopify OAuth state replay detected: nonce already consumed", {
      nonce: statePayload.nonce,
      organizationId: statePayload.organizationId,
      reason: nonceConsumption.reason,
    });
    const errRes = NextResponse.redirect(`${defaultRedirect}&error=state_already_used`);
    errRes.cookies.delete("cb_shopify_oauth_nonce");
    return errRes;
  }

  // 5. Verify user has owner/admin membership or manage permission
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", statePayload.organizationId)
    .eq("user_id", currentUser.id)
    .single();

  const isAuthorized =
    member &&
    (member.role === "owner" ||
      member.role === "admin" ||
      (await hasPermission(currentUser.id, statePayload.organizationId, "integrations.connect")));

  if (!isAuthorized) {
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=insufficient_permissions`);
  }

  // 6. Anti-Hijacking Check: verify store is not claimed by another active organization
  const { data: existingShopClaim } = await supabase
    .from("organization_integrations")
    .select("organization_id, status")
    .eq("provider", "shopify")
    .eq("provider_account_id", cleanShop)
    .eq("status", "connected")
    .maybeSingle();

  if (existingShopClaim && existingShopClaim.organization_id !== statePayload.organizationId) {
    logger.warn("Attempt to connect Shopify store already active in another tenant", {
      shop: cleanShop,
      initiatingOrg: statePayload.organizationId,
      existingOrg: existingShopClaim.organization_id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=store_already_connected_to_another_organization`);
  }

  try {
    // 7. Exchange code for offline merchant access token
    const tokenData = await exchangeShopifyCodeForToken(cleanShop, code, request);

    // 8. Fetch verified shop metadata via direct client
    let shopName = cleanShop;
    let shopEmail = currentUser.email || "";
    let currency = "USD";
    let countryCode = "";
    let ianaTimezone = "";
    let shopId: number | undefined;

    try {
      const client = ShopifyClient.fromDirectCredentials(
        statePayload.organizationId,
        cleanShop,
        tokenData.access_token
      );
      const shopInfo = await client.getShop();
      if (shopInfo) {
        shopName = shopInfo.name || cleanShop;
        shopEmail = shopInfo.email || shopEmail;
        currency = shopInfo.currency || currency;
        countryCode = shopInfo.country_code || countryCode;
        ianaTimezone = shopInfo.iana_timezone || ianaTimezone;
        shopId = shopInfo.id;
      }
    } catch (err: unknown) {
      logger.warn("Could not pre-fetch shop metadata during OAuth callback", { error: String(err) });
    }

    // 9. Encrypt access token with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenData.access_token);

    // 10. Store / Update integration record in PostgreSQL
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: "shopify",
          provider_account_id: cleanShop,
          account_email: shopEmail,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: tokenData.scope ? tokenData.scope.split(",").map((s) => s.trim()) : ["read_products"],
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: null, // Shopify offline access tokens do not expire or use refresh tokens
          token_expires_at: null,
          metadata: {
            shop_id: shopId,
            shop_domain: cleanShop,
            shop_name: shopName,
            currency,
            country_code: countryCode,
            iana_timezone: ianaTimezone,
            connected_user_id: currentUser.id,
            connected_user_email: currentUser.email,
            last_synced_at: new Date().toISOString(),
          },
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,provider,provider_account_id",
        }
      );

    if (upsertError) {
      logger.error("Failed to persist Shopify integration record", upsertError, {
        organizationId: statePayload.organizationId,
        shop: cleanShop,
      });
      const sep = redirectTarget.includes("?") ? "&" : "?";
      return NextResponse.redirect(`${redirectTarget}${sep}error=db_error`);
    }

    revalidatePath("/dashboard");

    // Serverless-safe background execution: keeps runtime context alive until initial sync completes
    after(async () => {
      try {
        await syncShopifyOrganizationData(statePayload.organizationId, { forceFull: true });
      } catch (syncErr) {
        logger.warn("Initial background Shopify synchronization reported warning", {
          organizationId: statePayload.organizationId,
          error: String(syncErr),
        });
      }
    });

    const sep = redirectTarget.includes("?") ? "&" : "?";
    const res = NextResponse.redirect(`${redirectTarget}${sep}status=connected&provider=shopify`);
    res.cookies.delete("cb_shopify_oauth_nonce");
    return res;
  } catch (err: unknown) {
    logger.error("Shopify OAuth code exchange error", err, {
      organizationId: statePayload.organizationId,
      shop: cleanShop,
      userId: currentUser.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    const res = NextResponse.redirect(`${redirectTarget}${sep}error=token_exchange_failed`);
    res.cookies.delete("cb_shopify_oauth_nonce");
    return res;
  }
}
