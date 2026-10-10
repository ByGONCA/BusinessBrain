import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyOAuthState,
  exchangeGoogleCodeForTokens,
  getGoogleUserInfo,
} from "@/lib/integrations/google/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("google-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectTarget = `${baseUrl}/dashboard?settings=integrations`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Google callback", { clientIp });
    return NextResponse.redirect(`${redirectTarget}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Google OAuth error or user cancellation safely
  if (errorParam) {
    logger.warn("Google OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${redirectTarget}&error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectTarget}&error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State
  const statePayload = verifyOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired OAuth state token received");
    return NextResponse.redirect(`${redirectTarget}&error=invalid_state`);
  }

  // 2. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("OAuth state user mismatch", {
      stateUserId: statePayload.userId,
      currentUserId: currentUser?.id,
    });
    return NextResponse.redirect(`${redirectTarget}&error=user_mismatch`);
  }

  const supabase = await createClient();

  // 3. Verify user has owner/admin membership in the target organization
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", statePayload.organizationId)
    .eq("user_id", currentUser.id)
    .single();

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.redirect(`${redirectTarget}&error=insufficient_permissions`);
  }

  try {
    // 4. Exchange code for Google tokens
    const tokens = await exchangeGoogleCodeForTokens(code);

    // 5. Get Google User Profile (email address and account ID)
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // 6. Encrypt sensitive tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const scopesList = tokens.scope ? tokens.scope.split(" ") : [];

    // 7. Store / Update integration in PostgreSQL
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: statePayload.service || "google",
          provider_account_id: userInfo.id || userInfo.email,
          account_email: userInfo.email,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: scopesList,
          encrypted_access_token: encryptedAccessToken,
          ...(encryptedRefreshToken ? { encrypted_refresh_token: encryptedRefreshToken } : {}),
          token_expires_at: tokenExpiresAt,
          metadata: {
            google_name: userInfo.name,
            google_picture: userInfo.picture,
          },
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id, provider, provider_account_id",
        }
      );

    if (upsertError) {
      logger.error("Failed to store Google integration in database", upsertError, {
        organizationId: statePayload.organizationId,
      });
      return NextResponse.redirect(`${redirectTarget}&error=database_error`);
    }

    // Restore any previously disconnected external Google Drive file references to 'ready'
    await supabase
      .from("organization_files")
      .update({
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", statePayload.organizationId)
      .eq("storage_provider", "google_drive")
      .eq("status", "unavailable");

    logger.info("Successfully connected Google integration", {
      organizationId: statePayload.organizationId,
      provider: statePayload.service || "google",
      accountEmail: userInfo.email,
    });

    return NextResponse.redirect(`${redirectTarget}&status=connected`);
  } catch (err: unknown) {
    logger.error("Google OAuth callback exception", err, {
      organizationId: statePayload.organizationId,
      userId: currentUser.id,
    });
    // Return a generic error code without leaking stack trace or internal exception strings
    return NextResponse.redirect(`${redirectTarget}&error=exchange_failed`);
  }
}
