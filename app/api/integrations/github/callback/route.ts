import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  verifyGitHubOAuthState,
  exchangeGitHubCodeForToken,
} from "@/lib/integrations/github/oauth";
import { encryptToken } from "@/lib/crypto/encryption";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("github-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const defaultRedirect = `${baseUrl}/dashboard?settings=integrations`;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on GitHub callback", { clientIp });
    return NextResponse.redirect(`${defaultRedirect}&error=rate_limit_exceeded`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    logger.warn("GitHub OAuth provider returned error", { error: errorParam });
    return NextResponse.redirect(`${defaultRedirect}&error=oauth_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_parameters`);
  }

  // 1. Verify CSRF HMAC State
  const statePayload = verifyGitHubOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired GitHub OAuth state token received");
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_state`);
  }

  const redirectTarget = statePayload.returnUrl
    ? (statePayload.returnUrl.startsWith("http") ? statePayload.returnUrl : `${baseUrl}${statePayload.returnUrl}`)
    : defaultRedirect;

  // 2. Verify Authenticated User matches state
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== statePayload.userId) {
    logger.warn("GitHub OAuth state user mismatch", {
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
    // 4. Exchange code for GitHub access token
    const tokenData = await exchangeGitHubCodeForToken(code);

    // 5. Fetch GitHub User Profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "BusinessBrain-App",
      },
    });

    if (!userRes.ok) {
      throw new Error(`Failed to fetch GitHub viewer profile (${userRes.status})`);
    }

    const githubUser = await userRes.json();

    // 6. Encrypt sensitive token with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const scopesList = tokenData.scope ? tokenData.scope.split(/[\s,]+/).filter(Boolean) : [];

    // 7. Store / Update integration in PostgreSQL
    const { error: upsertError } = await supabase
      .from("organization_integrations")
      .upsert(
        {
          organization_id: statePayload.organizationId,
          provider: "github",
          provider_account_id: String(githubUser.id),
          account_email: githubUser.email || githubUser.login,
          connected_by_user_id: currentUser.id,
          status: "connected",
          scopes: scopesList,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: null,
          token_expires_at: null,
          metadata: {
            github_login: githubUser.login,
            github_name: githubUser.name || githubUser.login,
            github_avatar: githubUser.avatar_url,
            github_html_url: githubUser.html_url,
          },
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id, provider, provider_account_id",
        }
      );

    if (upsertError) {
      logger.error("Failed to store GitHub integration in database", upsertError, {
        organizationId: statePayload.organizationId,
      });
      return NextResponse.redirect(`${redirectTarget}&error=database_error`);
    }

    revalidatePath("/dashboard", "layout");

    logger.info("Successfully connected GitHub integration", {
      organizationId: statePayload.organizationId,
      githubLogin: githubUser.login,
    });

    const separator = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${separator}status=connected&provider=github`);
  } catch (err: unknown) {
    logger.error("GitHub OAuth callback exception", err, {
      organizationId: statePayload.organizationId,
      userId: currentUser.id,
    });
    const separator = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${redirectTarget}${separator}error=exchange_failed`);
  }
}
