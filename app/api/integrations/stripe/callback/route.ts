import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyStripeOAuthState,
  consumeOAuthNonce,
  exchangeStripeConnectCode,
} from "@/lib/integrations/stripe/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import crypto from "crypto";
import { sanitizeRedirectUrl, getTrustedAppUrl, getStripeCallbackUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("stripe-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams } = new URL(request.url);
  const baseUrl = getTrustedAppUrl(request);
  const defaultRedirect = `${baseUrl}/dashboard?settings=integrations`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Stripe callback", { clientIp });
    return NextResponse.redirect(`${defaultRedirect}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    logger.warn("Stripe OAuth provider returned error", {
      error: errorParam,
      description: errorDescription,
    });
    return NextResponse.redirect(`${defaultRedirect}&error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State & Expiration
  const statePayload = verifyStripeOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Stripe OAuth state token received");
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  const safePath = sanitizeRedirectUrl(statePayload.returnUrl, "/dashboard?settings=integrations");
  const redirectTarget = `${baseUrl}${safePath}`;

  // 2. Verify Authenticated User matches initiating user
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("Stripe OAuth state user mismatch", {
      stateUserId: statePayload.userId,
      currentUserId: currentUser?.id,
    });
    return NextResponse.redirect(`${redirectTarget}&error=user_mismatch`);
  }

  const supabase = await createClient();

  // 3. Verify user has owner/admin membership or integrations.connect in the target organization
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", statePayload.organizationId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  const isAuthorized =
    member &&
    (member.role === "owner" ||
      member.role === "admin" ||
      (await hasPermission(currentUser.id, statePayload.organizationId, "integrations.connect")));

  if (!isAuthorized) {
    logger.warn("User lacks permission to complete Stripe connection for organization", {
      userId: currentUser.id,
      organizationId: statePayload.organizationId,
      role: member?.role,
    });
    return NextResponse.redirect(`${redirectTarget}&error=insufficient_permissions`);
  }

  // 4. Anti-Replay: Verify and atomically consume the one-time OAuth nonce
  const nonceValid = await consumeOAuthNonce(
    supabase,
    statePayload.nonce,
    statePayload.organizationId
  );

  if (!nonceValid) {
    logger.warn("OAuth state replay detected or nonce already consumed", {
      nonce: statePayload.nonce,
      organizationId: statePayload.organizationId,
    });
    return NextResponse.redirect(`${redirectTarget}&error=invalid_state_replayed`);
  }

  try {
    // 5. Exchange code for Stripe account ID and access tokens
    const callbackUrl = getStripeCallbackUrl(request);
    const tokenData = await exchangeStripeConnectCode(code, { redirectUri: callbackUrl });

    // 6. Encrypt sensitive tokens with authenticated AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : null;

    // Record strictly the scopes returned by Stripe Connect OAuth without inventing fallback scopes
    const grantedScopes: string[] =
      typeof tokenData.scope === "string" && tokenData.scope.trim().length > 0
        ? tokenData.scope.trim().split(/[\s,]+/).filter(Boolean)
        : [];

    if (grantedScopes.length === 0) {
      logger.warn("Stripe OAuth response did not return any granted scopes", {
        stripeUserId: tokenData.stripe_user_id,
        organizationId: statePayload.organizationId,
      });
    }

    // 7. Store / Update integration record for the organization
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: "stripe",
          provider_account_id: tokenData.stripe_user_id,
          account_email: `stripe:${tokenData.stripe_user_id}`,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: grantedScopes,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: null,
          metadata: {
            stripe_user_id: tokenData.stripe_user_id,
            livemode: tokenData.livemode,
            connected_at: new Date().toISOString(),
          },
        },
        { onConflict: "organization_id,provider,provider_account_id" }
      );

    if (upsertError) {
      logger.error("Failed to store Stripe integration record", upsertError, {
        organizationId: statePayload.organizationId,
      });
      return NextResponse.redirect(`${redirectTarget}&error=storage_error`);
    }

    // 8. Invalidate any existing outdated metric snapshots to trigger a fresh computation
    await supabase
      .from("organization_metric_snapshots")
      .delete()
      .eq("organization_id", statePayload.organizationId);

    logger.info("Successfully connected Stripe account for organization", {
      organizationId: statePayload.organizationId,
      stripeUserId: tokenData.stripe_user_id,
      connectedByUserId: currentUser.id,
    });

    return NextResponse.redirect(`${redirectTarget}&status=stripe_connected`);
  } catch (err: unknown) {
    const diagnosticId =
      (err as { diagnosticId?: string })?.diagnosticId ||
      `str_tok_${crypto.randomBytes(4).toString("hex")}`;

    logger.error("Failed to complete Stripe OAuth flow", err, {
      userId: currentUser.id,
      organizationId: statePayload.organizationId,
      diagnosticId,
    });

    // Provide generic error code and safe diagnostic correlation ID to user without raw Stripe internals or secrets
    return NextResponse.redirect(`${redirectTarget}&error=token_exchange_failed&diag_id=${diagnosticId}`);
  }
}
