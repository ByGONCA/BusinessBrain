import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifySentryOAuthState,
  consumeSentryOAuthNonceAtomic,
  exchangeSentryCodeForToken,
} from "@/lib/integrations/sentry/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl, getTrustedAppUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";
import { SENTRY_DEFAULT_API_BASE } from "@/lib/integrations/sentry/config";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("sentry-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams } = new URL(request.url);
  const baseUrl = getTrustedAppUrl(request);
  const defaultRedirect = `${baseUrl}/dashboard?settings=integrations&provider=sentry`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Sentry callback", { clientIp });
    return NextResponse.redirect(`${defaultRedirect}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    logger.warn("Sentry OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${defaultRedirect}&error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State
  const statePayload = verifySentryOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Sentry OAuth state token received");
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  // 1b. Validate single-use nonce cookie if present
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)cb_sentry_oauth_nonce=([^;]*)/);
  const cookieNonce = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  if (cookieNonce && cookieNonce !== statePayload.nonce) {
    logger.warn("Sentry OAuth state nonce mismatch with session cookie", {
      cookieNonce,
      stateNonce: statePayload.nonce,
    });
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  const safePath = sanitizeRedirectUrl(statePayload.returnUrl, "/dashboard?settings=integrations&provider=sentry");
  const redirectTarget = `${baseUrl}${safePath}`;

  // 2. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("Sentry OAuth state user mismatch", {
      stateUserId: statePayload.userId,
      currentUserId: currentUser?.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=user_mismatch`);
  }

  const supabase = await createClient();

  // 2b. Atomic Replay Protection
  const nonceConsumption = await consumeSentryOAuthNonceAtomic(
    statePayload.organizationId,
    statePayload.nonce
  );

  if (!nonceConsumption.success) {
    logger.warn("Sentry OAuth state replay detected: nonce already consumed", {
      nonce: statePayload.nonce,
      organizationId: statePayload.organizationId,
      reason: nonceConsumption.reason,
    });
    const errRes = NextResponse.redirect(`${defaultRedirect}&error=state_already_used`);
    errRes.cookies.delete("cb_sentry_oauth_nonce");
    return errRes;
  }

  // 3. Verify user has owner/admin membership or manage permission
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

  try {
    // 4. Exchange code for access & refresh tokens
    const tokenData = await exchangeSentryCodeForToken(code, request);

    // 5. Fetch Sentry user & organizations metadata
    let sentryOrgSlug: string | undefined;
    let sentryOrgName: string | undefined;
    let sentryOrgId: string | undefined;
    let accountEmail: string = tokenData.user?.email || currentUser.email || "connected-account";

    try {
      const orgsRes = await fetch(`${SENTRY_DEFAULT_API_BASE}/organizations/`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "KogSync-App/1.0",
        },
      });

      if (orgsRes.ok) {
        const orgs = await orgsRes.json();
        if (Array.isArray(orgs) && orgs.length > 0) {
          sentryOrgSlug = orgs[0].slug;
          sentryOrgName = orgs[0].name;
          sentryOrgId = String(orgs[0].id);
        }
      }
    } catch {
      // Fallback if organization list is deferred
    }

    // 6. Encrypt sensitive tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : null;
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const providerAccountId = sentryOrgId || tokenData.user?.id || `sentry_${Date.now()}`;

    // 7. Store / Update integration record in PostgreSQL
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: "sentry",
          provider_account_id: providerAccountId,
          account_email: accountEmail,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: Array.isArray(tokenData.scope) ? tokenData.scope : [String(tokenData.scope || "org:read")],
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          metadata: {
            sentry_org_id: sentryOrgId,
            sentry_org_slug: sentryOrgSlug,
            sentry_org_name: sentryOrgName,
            connected_user_id: tokenData.user?.id,
            connected_user_email: tokenData.user?.email,
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
      logger.error("Failed to persist Sentry integration record", upsertError, {
        organizationId: statePayload.organizationId,
      });
      const sep = redirectTarget.includes("?") ? "&" : "?";
      return NextResponse.redirect(`${redirectTarget}${sep}error=db_error`);
    }

    revalidatePath("/dashboard");

    const sep = redirectTarget.includes("?") ? "&" : "?";
    const res = NextResponse.redirect(`${redirectTarget}${sep}status=connected&provider=sentry`);
    res.cookies.delete("cb_sentry_oauth_nonce");
    return res;
  } catch (err: unknown) {
    logger.error("Sentry OAuth code exchange error", err, {
      organizationId: statePayload.organizationId,
      userId: currentUser.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    const res = NextResponse.redirect(`${redirectTarget}${sep}error=token_exchange_failed`);
    res.cookies.delete("cb_sentry_oauth_nonce");
    return res;
  }
}
