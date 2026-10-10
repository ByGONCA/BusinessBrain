import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyMicrosoftOAuthState,
  exchangeMicrosoftCodeForTokens,
  getMicrosoftUserProfile,
} from "@/lib/integrations/microsoft/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("microsoft-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectTarget = `${baseUrl}/dashboard?settings=integrations`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Microsoft callback", { clientIp });
    return NextResponse.redirect(`${redirectTarget}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Microsoft OAuth error or user cancellation
  if (errorParam) {
    logger.warn("Microsoft OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${redirectTarget}&error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectTarget}&error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State
  const statePayload = verifyMicrosoftOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Microsoft OAuth state token received");
    return NextResponse.redirect(`${redirectTarget}&error=invalid_state`);
  }

  // 2. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("Microsoft OAuth state user mismatch", {
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
    // 4. Exchange code for Microsoft tokens
    const tokens = await exchangeMicrosoftCodeForTokens(code);

    // 5. Get Microsoft User Profile
    const userInfo = await getMicrosoftUserProfile(tokens.access_token);

    // 6. Encrypt sensitive tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const provider = statePayload.service === "outlook" ? "outlook" : "outlook_calendar";

    // 7. Upsert into organization_integrations
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider,
          provider_account_id: userInfo.id,
          account_email: userInfo.email,
          connected_by_user_id: currentUser.id,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          scopes: tokens.scope ? tokens.scope.split(" ") : [],
          status: "connected",
          metadata: {
            displayName: userInfo.displayName,
            connectedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,provider,provider_account_id",
        }
      );

    if (upsertError) {
      logger.error("Failed to save Microsoft integration to database", upsertError);
      return NextResponse.redirect(`${redirectTarget}&error=database_error`);
    }

    logger.info("Microsoft integration successfully connected", {
      organizationId: statePayload.organizationId,
      provider,
      email: userInfo.email,
    });

    return NextResponse.redirect(`${redirectTarget}&success=microsoft_connected`);
  } catch (err: unknown) {
    logger.error("Microsoft OAuth exchange error", err);
    return NextResponse.redirect(`${redirectTarget}&error=exchange_failed`);
  }
}
