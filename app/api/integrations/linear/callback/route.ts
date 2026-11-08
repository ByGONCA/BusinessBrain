import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyLinearOAuthState,
  consumeLinearOAuthNonceAtomic,
  exchangeLinearCodeForToken,
} from "@/lib/integrations/linear/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("linear-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const defaultRedirect = `${baseUrl}/dashboard/linear`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Linear callback", { clientIp });
    return NextResponse.redirect(`${defaultRedirect}?error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    logger.warn("Linear OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${defaultRedirect}?error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${defaultRedirect}?error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State
  const statePayload = verifyLinearOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Linear OAuth state token received");
    return NextResponse.redirect(`${defaultRedirect}?error=invalid_state`);
  }

  // 1b. Validate single-use nonce cookie if present (prevents cross-session replay)
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)cb_linear_oauth_nonce=([^;]*)/);
  const cookieNonce = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  if (cookieNonce && cookieNonce !== statePayload.nonce) {
    logger.warn("Linear OAuth state nonce mismatch with session cookie", {
      cookieNonce,
      stateNonce: statePayload.nonce,
    });
    return NextResponse.redirect(`${defaultRedirect}?error=invalid_state`);
  }

  const safePath = sanitizeRedirectUrl(statePayload.returnUrl, "/dashboard/linear");
  const redirectTarget = `${baseUrl}${safePath}`;

  // 2. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("Linear OAuth state user mismatch", {
      stateUserId: statePayload.userId,
      currentUserId: currentUser?.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=user_mismatch`);
  }

  const supabase = await createClient();

  // 2b. Atomic Replay Protection: reject if this nonce was already consumed or is being processed concurrently
  const nonceConsumption = await consumeLinearOAuthNonceAtomic(
    statePayload.organizationId,
    statePayload.nonce
  );

  if (!nonceConsumption.success) {
    logger.warn("Linear OAuth state replay detected: nonce already consumed", {
      nonce: statePayload.nonce,
      organizationId: statePayload.organizationId,
      reason: nonceConsumption.reason,
    });
    const errRes = NextResponse.redirect(`${defaultRedirect}?error=state_already_used`);
    errRes.cookies.delete("cb_linear_oauth_nonce");
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
      (await hasPermission(currentUser.id, statePayload.organizationId, "linear.manage_connection")) ||
      (await hasPermission(currentUser.id, statePayload.organizationId, "integrations.connect")));

  if (!isAuthorized) {
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${sep}error=insufficient_permissions`);
  }

  try {
    // 4. Exchange code for access & refresh tokens
    const tokenData = await exchangeLinearCodeForToken(code);

    // 5. Fetch Linear Viewer & Organization metadata via GraphQL
    const viewerQuery = JSON.stringify({
      query: `
        query {
          viewer {
            id
            name
            email
            avatarUrl
            organization {
              id
              name
              urlKey
            }
          }
        }
      `,
    });

    const viewerRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "KogSync-App",
      },
      body: viewerQuery,
    });

    if (!viewerRes.ok) {
      throw new Error(`Failed to fetch Linear viewer (${viewerRes.status})`);
    }

    const viewerJson = await viewerRes.json();
    const viewer = viewerJson.data?.viewer;
    if (!viewer) {
      throw new Error("Linear viewer data missing from response");
    }

    // 6. Encrypt sensitive tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : null;
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // 7. Store / Update integration record in PostgreSQL
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: "linear",
          provider_account_id: viewer.id,
          account_email: viewer.email || viewer.name,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: tokenData.scope || ["read"],
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          metadata: {
            workspace_id: viewer.organization?.id,
            workspace_name: viewer.organization?.name,
            workspace_url_key: viewer.organization?.urlKey,
            user_name: viewer.name,
            user_avatar: viewer.avatarUrl,
            last_oauth_nonce: statePayload.nonce,
          },
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id, provider, provider_account_id",
        }
      );

    if (upsertError) {
      logger.error("Failed to store Linear integration in database", upsertError, {
        organizationId: statePayload.organizationId,
      });
      const sep = redirectTarget.includes("?") ? "&" : "?";
      const errRes = NextResponse.redirect(`${redirectTarget}${sep}error=database_error`);
      errRes.cookies.delete("cb_linear_oauth_nonce");
      return errRes;
    }

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/linear");

    logger.info("Successfully connected Linear data provider integration", {
      organizationId: statePayload.organizationId,
      workspaceName: viewer.organization?.name,
    });

    const sep = redirectTarget.includes("?") ? "&" : "?";
    const successRes = NextResponse.redirect(`${redirectTarget}${sep}status=connected&provider=linear`);
    successRes.cookies.delete("cb_linear_oauth_nonce");
    return successRes;
  } catch (err: unknown) {
    logger.error("Linear OAuth callback exception", err, {
      organizationId: statePayload.organizationId,
      userId: currentUser.id,
    });
    const sep = redirectTarget.includes("?") ? "&" : "?";
    const failRes = NextResponse.redirect(`${redirectTarget}${sep}error=exchange_failed`);
    failRes.cookies.delete("cb_linear_oauth_nonce");
    return failRes;
  }
}
